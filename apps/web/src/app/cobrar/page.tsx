'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, ScanLine } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { Alert, Badge, Button, Card, Input, Modal, PageTitle } from '@/components/ui';
import { formatCOP, formatDuration, formatTime } from '@/lib/format';

interface Quote {
  session: {
    id: string;
    plate: string;
    vehicleType: { name: string };
    entryAt: string;
    ticketCode?: string;
  };
  serverTime: string;
  tariff: { name: string; version: number };
  subscription: { customer: string; endsAt: string } | null;
  calculation: {
    billedMinutes: number;
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    breakdown: Array<{ label: string; amount: number }>;
  };
}

interface PaymentMethod {
  id: string;
  code: string;
  name: string;
  isCash: boolean;
}

interface PaymentResult {
  payment: { id: string; receiptNumber: string; amount: number; changeAmount: number | null };
  duplicated: boolean;
}

interface ActiveSession {
  id: string;
  plate: string;
  vehicleType: { name: string };
  entryAt: string;
}

const SCAN_DEBOUNCE_MS = 4000;

export default function CobrarPage() {
  const scanRef = useRef<HTMLInputElement>(null);
  const lastScanRef = useRef<{ code: string; at: number }>({ code: '', at: 0 });

  const [scanValue, setScanValue] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  // Pago
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [methodCode, setMethodCode] = useState('CASH');
  const [received, setReceived] = useState('');
  const [mixed, setMixed] = useState(false);
  const [mixedRows, setMixedRows] = useState<Array<{ methodCode: string; amount: string }>>([]);
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [paying, setPaying] = useState(false);
  const [result, setResult] = useState<PaymentResult | null>(null);

  // Descuento / autorización
  const [discountModal, setDiscountModal] = useState(false);
  const [discountPct, setDiscountPct] = useState('');
  const [authorizer, setAuthorizer] = useState({ username: '', pin: '' });
  const [appliedDiscount, setAppliedDiscount] = useState<{
    pct: number;
    username: string;
    pin: string;
  } | null>(null);

  // Ticket perdido / búsqueda por placa
  const [plateSearch, setPlateSearch] = useState('');
  const [plateResults, setPlateResults] = useState<ActiveSession[] | null>(null);
  const [lostModal, setLostModal] = useState(false);
  const [lostReason, setLostReason] = useState('');

  useEffect(() => {
    api<PaymentMethod[]>('/payments/methods').then(setMethods).catch(() => undefined);
  }, []);

  // Foco permanente para el lector: recupera tras cerrar modales u operaciones
  const refocus = useCallback(() => {
    setTimeout(() => {
      const active = document.activeElement;
      const isFormField =
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLSelectElement;
      if (!isFormField || active === scanRef.current) {
        scanRef.current?.focus();
      }
    }, 100);
  }, []);

  useEffect(() => {
    refocus();
    const onVisibility = () => refocus();
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [refocus]);

  const doScan = useCallback(
    async (code: string, opts: { lostTicket?: boolean; sessionId?: string } = {}) => {
      const clean = code.trim();
      if (!clean && !opts.sessionId) return;

      // Anti doble lectura del mismo código
      const now = Date.now();
      if (
        clean &&
        lastScanRef.current.code === clean &&
        now - lastScanRef.current.at < SCAN_DEBOUNCE_MS
      ) {
        setScanValue('');
        return;
      }
      lastScanRef.current = { code: clean, at: now };

      setError('');
      setInfo('');
      setResult(null);
      setLoading(true);
      try {
        const q = opts.sessionId
          ? await api<Quote>(
              `/sessions/${opts.sessionId}/quote${opts.lostTicket ? '?lostTicket=true' : ''}`,
            )
          : await api<Quote>('/sessions/scan', { method: 'POST', body: { code: clean } });
        setQuote(q);
        setIdempotencyKey(crypto.randomUUID());
        setAppliedDiscount(null);
        setReceived('');
        setMixed(false);
        setMethodCode('CASH');
        setPlateResults(null);
      } catch (err) {
        setQuote(null);
        if (err instanceof ApiError) {
          if (err.code === 'ALREADY_PAID' || err.code === 'CANCELLED') {
            setInfo(err.message);
          } else {
            setError(err.message);
          }
        } else {
          setError('No se pudo procesar la lectura.');
        }
      } finally {
        setLoading(false);
        setScanValue('');
        refocus();
      }
    },
    [refocus],
  );

  async function searchPlate() {
    if (!plateSearch.trim()) return;
    setError('');
    try {
      const res = await api<{ active: ActiveSession[] }>(
        `/sessions/by-plate/${encodeURIComponent(plateSearch.trim())}`,
      );
      setPlateResults(res.active);
      if (res.active.length === 0) {
        setInfo(`No hay vehículos activos con placa que contenga "${plateSearch.trim().toUpperCase()}".`);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo buscar.');
    }
  }

  async function applyDiscount() {
    if (!quote) return;
    const pct = Number(discountPct);
    if (!pct || pct < 1 || pct > 100) {
      setError('El descuento debe estar entre 1 y 100 %.');
      return;
    }
    setDiscountModal(false);
    setError('');
    setLoading(true);
    try {
      // Recotizar con descuento (la autorización se valida al confirmar el pago)
      const q = await api<Quote>(`/sessions/${quote.session.id}/quote?discountPct=${pct}`);
      setQuote(q);
      setAppliedDiscount({ pct, username: authorizer.username, pin: authorizer.pin });
      setIdempotencyKey(crypto.randomUUID());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo aplicar el descuento.');
    } finally {
      setLoading(false);
    }
  }

  async function markLost() {
    if (!quote) return;
    setLostModal(false);
    setLoading(true);
    setError('');
    try {
      const q = await api<Quote>(`/sessions/${quote.session.id}/lost-ticket`, {
        method: 'POST',
        body: {
          authorizerUsername: authorizer.username,
          authorizerPin: authorizer.pin,
          reason: lostReason || 'Ticket perdido',
        },
      });
      setQuote(q);
      setIdempotencyKey(crypto.randomUUID());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo aplicar ticket perdido.');
    } finally {
      setLoading(false);
    }
  }

  async function confirmPayment() {
    if (!quote || paying) return;
    const total = quote.calculation.total;

    let allocations: Array<{ methodCode: string; amount: number }>;
    if (total === 0) {
      allocations = [];
    } else if (mixed) {
      allocations = mixedRows
        .filter((r) => Number(r.amount) > 0)
        .map((r) => ({ methodCode: r.methodCode, amount: Number(r.amount) }));
      const sum = allocations.reduce((s, a) => s + a.amount, 0);
      if (sum !== total) {
        setError(`La suma del pago mixto (${formatCOP(sum)}) debe ser igual al total (${formatCOP(total)}).`);
        return;
      }
    } else {
      allocations = [{ methodCode, amount: total }];
    }

    const isCash = allocations.some(
      (a) => methods.find((m) => m.code === a.methodCode)?.isCash,
    );
    const receivedAmount = isCash && received ? Number(received) : undefined;

    setPaying(true);
    setError('');
    try {
      const res = await api<PaymentResult>('/payments', {
        method: 'POST',
        body: {
          sessionId: quote.session.id,
          idempotencyKey,
          allocations,
          receivedAmount,
          discountPct: appliedDiscount?.pct,
          authorizerUsername: appliedDiscount?.username,
          authorizerPin: appliedDiscount?.pin,
        },
      });
      setResult(res);
      setQuote(null);
      window.open(`/print/receipt/${res.payment.id}`, '_blank', 'width=400,height=600');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo registrar el pago.');
    } finally {
      setPaying(false);
      refocus();
    }
  }

  function resetAll() {
    setQuote(null);
    setResult(null);
    setError('');
    setInfo('');
    setPlateResults(null);
    refocus();
  }

  const cashSelected =
    !mixed && methods.find((m) => m.code === methodCode)?.isCash && (quote?.calculation.total ?? 0) > 0;
  const change =
    cashSelected && received && quote ? Number(received) - quote.calculation.total : null;

  return (
    <AppShell>
      <PageTitle subtitle="Escanea el ticket — el campo siempre está listo para el lector">
        Cobrar salida
      </PageTitle>

      {/* Campo de escaneo permanente */}
      <Card className="mb-4 border-2 border-dashed border-brand-300 bg-brand-50/50">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void doScan(scanValue);
          }}
          className="flex items-center gap-3"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-brand-700 shadow-sm" aria-hidden>
            <ScanLine className="h-6 w-6" />
          </span>
          <input
            ref={scanRef}
            value={scanValue}
            onChange={(e) => setScanValue(e.target.value)}
            onBlur={refocus}
            placeholder="Escanea el código o digítalo y presiona Enter"
            className="flex-1 rounded-xl border border-brand-300 bg-white px-4 py-3 font-mono text-lg focus:outline-none focus:ring-4 focus:ring-brand-200"
            autoComplete="off"
            aria-label="Código del ticket"
          />
          <Button type="submit" size="md" loading={loading}>
            Buscar
          </Button>
        </form>
        <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
          <span>¿Ticket ilegible o perdido?</span>
          <input
            value={plateSearch}
            onChange={(e) => setPlateSearch(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void searchPlate();
              }
            }}
            placeholder="Buscar por placa"
            className="rounded-lg border border-slate-300 px-3 py-1.5 font-mono uppercase"
            aria-label="Buscar por placa"
          />
          <Button size="sm" variant="ghost" onClick={() => void searchPlate()}>
            Buscar placa
          </Button>
        </div>
      </Card>

      {info && (
        <div className="mb-4">
          <Alert kind="info">{info}</Alert>
        </div>
      )}
      {error && (
        <div className="mb-4">
          <Alert kind="error">{error}</Alert>
        </div>
      )}

      {/* Resultados de búsqueda por placa */}
      {plateResults && plateResults.length > 0 && (
        <Card className="mb-4">
          <h3 className="mb-3 font-semibold">Vehículos activos encontrados</h3>
          <div className="flex flex-col gap-2">
            {plateResults.map((s) => (
              <button
                key={s.id}
                onClick={() => void doScan('', { sessionId: s.id })}
                className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-left hover:border-brand-400 hover:bg-brand-50"
              >
                <span className="font-mono text-lg font-bold">{s.plate}</span>
                <span className="text-slate-500">
                  {s.vehicleType.name} · entró {formatTime(s.entryAt)}
                </span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Resultado del pago */}
      {result && (
        <Card className="mb-4 border-2 border-emerald-300">
          <div className="text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" aria-hidden />
            <h2 className="mt-2 text-2xl font-bold text-emerald-700">
              {result.duplicated ? 'Este pago ya estaba registrado' : 'Pago registrado'}
            </h2>
            <p className="text-slate-500">Comprobante {result.payment.receiptNumber}</p>
            {result.payment.changeAmount !== null && result.payment.changeAmount > 0 && (
              <div className="mx-auto mt-4 max-w-xs rounded-2xl bg-amber-50 p-4">
                <div className="text-sm font-medium text-amber-700">CAMBIO A ENTREGAR</div>
                <div className="text-4xl font-bold text-amber-800">
                  {formatCOP(result.payment.changeAmount)}
                </div>
              </div>
            )}
            <div className="mt-5 flex justify-center gap-3">
              <Button onClick={resetAll} autoFocus>
                Listo — siguiente vehículo
              </Button>
              <Button
                variant="ghost"
                onClick={() =>
                  window.open(`/print/receipt/${result.payment.id}`, '_blank', 'width=400,height=600')
                }
              >
                Reimprimir comprobante
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Cotización */}
      {quote && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Resumen de la estancia</h2>
              {quote.subscription ? (
                <Badge color="green">Mensualidad — {quote.subscription.customer}</Badge>
              ) : (
                <Badge color="blue">{quote.tariff.name}</Badge>
              )}
            </div>
            <dl className="space-y-2">
              <div className="flex justify-between">
                <dt className="text-slate-500">Placa</dt>
                <dd className="font-mono text-2xl font-bold">{quote.session.plate}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Tipo</dt>
                <dd className="font-medium">{quote.session.vehicleType.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Entrada</dt>
                <dd>{formatTime(quote.session.entryAt)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Hora actual</dt>
                <dd>{formatTime(quote.serverTime)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Tiempo</dt>
                <dd className="font-semibold">{formatDuration(quote.calculation.billedMinutes)}</dd>
              </div>
            </dl>
            <hr className="my-4" />
            <div className="space-y-1 text-sm">
              {quote.calculation.breakdown.map((b, i) => (
                <div key={i} className="flex justify-between text-slate-600">
                  <span>{b.label}</span>
                  <span>{formatCOP(b.amount)}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-900 px-4 py-3 text-white">
              <span className="text-lg font-medium">TOTAL</span>
              <span className="text-3xl font-bold">{formatCOP(quote.calculation.total)}</span>
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setDiscountModal(true)}>
                Aplicar descuento
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setLostModal(true)}>
                Ticket perdido
              </Button>
            </div>
          </Card>

          <Card>
            <h2 className="mb-4 text-lg font-semibold">Registrar pago</h2>
            {quote.calculation.total === 0 ? (
              <Alert kind="success">
                No hay valor a cobrar{quote.subscription ? ' — mensualidad activa' : ''}. Confirma
                para registrar la salida.
              </Alert>
            ) : (
              <>
                {!mixed && (
                  <div className="mb-4 grid grid-cols-3 gap-2">
                    {methods
                      .filter((m) => !['SUBSCRIPTION', 'COURTESY', 'AGREEMENT'].includes(m.code))
                      .map((m) => (
                        <button
                          key={m.code}
                          onClick={() => setMethodCode(m.code)}
                          className={`rounded-xl border-2 px-3 py-3 font-semibold ${
                            methodCode === m.code
                              ? 'border-brand-600 bg-brand-50 text-brand-800'
                              : 'border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                          aria-pressed={methodCode === m.code}
                        >
                          {m.name}
                        </button>
                      ))}
                  </div>
                )}
                <label className="mb-4 flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={mixed}
                    onChange={(e) => {
                      setMixed(e.target.checked);
                      if (e.target.checked) {
                        setMixedRows([
                          { methodCode: 'CASH', amount: String(quote.calculation.total) },
                          { methodCode: 'CARD', amount: '0' },
                        ]);
                      }
                    }}
                    className="h-5 w-5"
                  />
                  Pago mixto (dividir entre dos medios)
                </label>

                {mixed && (
                  <div className="mb-4 space-y-2">
                    {mixedRows.map((row, i) => (
                      <div key={i} className="flex gap-2">
                        <select
                          value={row.methodCode}
                          onChange={(e) => {
                            const next = [...mixedRows];
                            next[i] = { ...row, methodCode: e.target.value };
                            setMixedRows(next);
                          }}
                          className="rounded-xl border border-slate-300 px-3 py-2"
                          aria-label={`Medio de pago ${i + 1}`}
                        >
                          {methods
                            .filter((m) => !['SUBSCRIPTION', 'COURTESY'].includes(m.code))
                            .map((m) => (
                              <option key={m.code} value={m.code}>
                                {m.name}
                              </option>
                            ))}
                        </select>
                        <input
                          type="number"
                          value={row.amount}
                          onChange={(e) => {
                            const next = [...mixedRows];
                            next[i] = { ...row, amount: e.target.value };
                            setMixedRows(next);
                          }}
                          className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-right"
                          aria-label={`Valor ${i + 1}`}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {cashSelected && (
                  <div className="mb-4">
                    <Input
                      label="Efectivo recibido"
                      type="number"
                      inputMode="numeric"
                      value={received}
                      onChange={(e) => setReceived(e.target.value)}
                      placeholder={String(quote.calculation.total)}
                    />
                    {change !== null && change >= 0 && (
                      <div className="mt-2 flex justify-between rounded-xl bg-amber-50 px-4 py-2 text-lg">
                        <span className="font-medium text-amber-700">Cambio</span>
                        <span className="font-bold text-amber-800">{formatCOP(change)}</span>
                      </div>
                    )}
                    {change !== null && change < 0 && (
                      <p className="mt-2 text-sm font-medium text-red-600">
                        Falta {formatCOP(-change)} para completar el pago.
                      </p>
                    )}
                  </div>
                )}
              </>
            )}

            <Button
              variant="success"
              className="w-full"
              loading={paying}
              onClick={() => void confirmPayment()}
              disabled={Boolean(cashSelected && received && change !== null && change < 0)}
            >
              {quote.calculation.total === 0
                ? 'Confirmar salida'
                : `Confirmar pago de ${formatCOP(quote.calculation.total)}`}
            </Button>
          </Card>
        </div>
      )}

      {/* Modal descuento */}
      <Modal
        open={discountModal}
        title="Descuento — requiere supervisor"
        onClose={() => {
          setDiscountModal(false);
          refocus();
        }}
      >
        <div className="flex flex-col gap-3">
          <Input
            label="Porcentaje de descuento (%)"
            type="number"
            min={1}
            max={100}
            value={discountPct}
            onChange={(e) => setDiscountPct(e.target.value)}
          />
          <Input
            label="Usuario del supervisor"
            value={authorizer.username}
            onChange={(e) => setAuthorizer({ ...authorizer, username: e.target.value })}
          />
          <Input
            label="PIN del supervisor"
            type="password"
            value={authorizer.pin}
            onChange={(e) => setAuthorizer({ ...authorizer, pin: e.target.value })}
          />
          <Button onClick={() => void applyDiscount()}>Aplicar descuento</Button>
        </div>
      </Modal>

      {/* Modal ticket perdido */}
      <Modal
        open={lostModal}
        title="Ticket perdido — requiere supervisor"
        onClose={() => {
          setLostModal(false);
          refocus();
        }}
      >
        <div className="flex flex-col gap-3">
          <Alert kind="warning">
            Se aplicará el recargo configurado por ticket perdido y quedará registrado en auditoría.
          </Alert>
          <Input
            label="Motivo / observación"
            value={lostReason}
            onChange={(e) => setLostReason(e.target.value)}
          />
          <Input
            label="Usuario del supervisor"
            value={authorizer.username}
            onChange={(e) => setAuthorizer({ ...authorizer, username: e.target.value })}
          />
          <Input
            label="PIN del supervisor"
            type="password"
            value={authorizer.pin}
            onChange={(e) => setAuthorizer({ ...authorizer, pin: e.target.value })}
          />
          <Button variant="warning" onClick={() => void markLost()}>
            Aplicar recargo por ticket perdido
          </Button>
        </div>
      </Modal>
    </AppShell>
  );
}
