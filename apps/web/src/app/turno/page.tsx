'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { Alert, Button, Card, Input, Modal, PageTitle, Spinner } from '@/components/ui';
import { formatCOP, formatDateTime } from '@/lib/format';

interface ShiftSummary {
  shift: {
    id: string;
    status: string;
    openedAt: string;
    openingCash: number;
    countedCash: number | null;
    difference: number | null;
  };
  totals: {
    totalSales: number;
    paymentsCount: number;
    byMethod: Record<string, { name: string; total: number; count: number }>;
    cashSales: number;
    movementsIn: number;
    movementsOut: number;
    expectedCash: number;
  };
  cashMovements: Array<{ id: string; type: string; amount: number; reason: string; createdAt: string }>;
}

export default function TurnoPage() {
  const [summary, setSummary] = useState<ShiftSummary | null | undefined>(undefined);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  const [openingCash, setOpeningCash] = useState('');
  const [closeModal, setCloseModal] = useState(false);
  const [countedCash, setCountedCash] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [movementModal, setMovementModal] = useState<null | 'IN' | 'OUT'>(null);
  const [movement, setMovement] = useState({ amount: '', reason: '' });

  const load = useCallback(() => {
    api<ShiftSummary | null>('/shifts/current')
      .then(setSummary)
      .catch(() => setSummary(null));
  }, []);

  useEffect(load, [load]);

  async function openShift() {
    setError('');
    setLoading(true);
    try {
      await api('/shifts/open', { method: 'POST', body: { openingCash: Number(openingCash) || 0 } });
      setNotice('Turno abierto. Ya puedes cobrar.');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo abrir el turno.');
    } finally {
      setLoading(false);
    }
  }

  async function closeShift() {
    setError('');
    setLoading(true);
    try {
      const res = await api<{ shift: { id: string } }>('/shifts/close', {
        method: 'POST',
        body: { countedCash: Number(countedCash) || 0, notes: closeNotes || undefined },
      });
      setCloseModal(false);
      setNotice('Turno cerrado correctamente.');
      window.open(`/print/shift/${res.shift.id}`, '_blank', 'width=400,height=600');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cerrar el turno.');
    } finally {
      setLoading(false);
    }
  }

  async function addMovement() {
    if (!movementModal) return;
    setError('');
    setLoading(true);
    try {
      await api('/shifts/cash-movements', {
        method: 'POST',
        body: { type: movementModal, amount: Number(movement.amount), reason: movement.reason },
      });
      setMovementModal(null);
      setMovement({ amount: '', reason: '' });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo registrar el movimiento.');
    } finally {
      setLoading(false);
    }
  }

  if (summary === undefined) {
    return (
      <AppShell>
        <Spinner />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageTitle>Caja y turno</PageTitle>

      {notice && (
        <div className="mb-4">
          <Alert kind="success">{notice}</Alert>
        </div>
      )}
      {error && (
        <div className="mb-4">
          <Alert kind="error">{error}</Alert>
        </div>
      )}

      {summary === null ? (
        <Card className="mx-auto max-w-md">
          <h2 className="mb-2 text-lg font-semibold">Abrir turno</h2>
          <p className="mb-4 text-slate-500">
            Registra la base inicial de efectivo con la que empiezas.
          </p>
          <div className="flex flex-col gap-4">
            <Input
              label="Base inicial (efectivo en caja)"
              type="number"
              inputMode="numeric"
              value={openingCash}
              onChange={(e) => setOpeningCash(e.target.value)}
              placeholder="50000"
              autoFocus
            />
            <Button loading={loading} onClick={() => void openShift()}>
              Abrir turno
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="mb-4 text-lg font-semibold">Resumen del turno</h2>
            <dl className="space-y-2">
              <div className="flex justify-between">
                <dt className="text-slate-500">Abierto</dt>
                <dd>{formatDateTime(summary.shift.openedAt)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Base inicial</dt>
                <dd className="font-medium">{formatCOP(summary.shift.openingCash)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Cobros</dt>
                <dd className="font-medium">{summary.totals.paymentsCount}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Ventas totales</dt>
                <dd className="font-bold text-emerald-700">{formatCOP(summary.totals.totalSales)}</dd>
              </div>
            </dl>
            <hr className="my-3" />
            <h3 className="mb-2 text-sm font-semibold text-slate-600">Por medio de pago</h3>
            <div className="space-y-1 text-sm">
              {Object.entries(summary.totals.byMethod).map(([code, m]) => (
                <div key={code} className="flex justify-between">
                  <span className="text-slate-500">
                    {m.name} ({m.count})
                  </span>
                  <span>{formatCOP(m.total)}</span>
                </div>
              ))}
              {Object.keys(summary.totals.byMethod).length === 0 && (
                <p className="text-slate-400">Sin cobros todavía.</p>
              )}
            </div>
            <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-100 px-4 py-3">
              <span className="font-medium">Efectivo esperado en caja</span>
              <span className="text-xl font-bold">{formatCOP(summary.totals.expectedCash)}</span>
            </div>
          </Card>

          <div className="flex flex-col gap-4">
            <Card>
              <h2 className="mb-3 text-lg font-semibold">Movimientos de caja</h2>
              <div className="mb-3 flex gap-2">
                <Button size="md" variant="ghost" onClick={() => setMovementModal('IN')}>
                  + Entrada de efectivo
                </Button>
                <Button size="md" variant="ghost" onClick={() => setMovementModal('OUT')}>
                  − Salida de efectivo
                </Button>
              </div>
              <div className="max-h-48 space-y-1 overflow-y-auto text-sm">
                {summary.cashMovements.map((m) => (
                  <div key={m.id} className="flex justify-between border-b border-slate-100 py-1.5">
                    <span className="text-slate-600">{m.reason}</span>
                    <span className={m.type === 'IN' ? 'text-emerald-700' : 'text-red-600'}>
                      {m.type === 'IN' ? '+' : '−'}
                      {formatCOP(m.amount)}
                    </span>
                  </div>
                ))}
                {summary.cashMovements.length === 0 && (
                  <p className="text-slate-400">Sin movimientos manuales.</p>
                )}
              </div>
            </Card>

            <Card>
              <h2 className="mb-3 text-lg font-semibold">Cerrar turno</h2>
              <p className="mb-3 text-sm text-slate-500">
                Cuenta el efectivo y regístralo. El sistema calculará la diferencia.
              </p>
              <Button variant="danger" onClick={() => setCloseModal(true)}>
                Cerrar turno
              </Button>
            </Card>
          </div>
        </div>
      )}

      <Modal open={closeModal} title="Cerrar turno" onClose={() => setCloseModal(false)}>
        <div className="flex flex-col gap-4">
          {summary && (
            <Alert kind="info">
              Efectivo esperado: <strong>{formatCOP(summary.totals.expectedCash)}</strong>
            </Alert>
          )}
          <Input
            label="Efectivo contado"
            type="number"
            inputMode="numeric"
            value={countedCash}
            onChange={(e) => setCountedCash(e.target.value)}
            autoFocus
          />
          {summary && countedCash !== '' && (
            <div
              className={`rounded-xl px-4 py-2 font-medium ${
                Number(countedCash) - summary.totals.expectedCash === 0
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-amber-50 text-amber-700'
              }`}
            >
              Diferencia: {formatCOP(Number(countedCash) - summary.totals.expectedCash)}
            </div>
          )}
          <Input
            label="Observaciones (opcional)"
            value={closeNotes}
            onChange={(e) => setCloseNotes(e.target.value)}
          />
          <Button variant="danger" loading={loading} onClick={() => void closeShift()}>
            Confirmar cierre
          </Button>
        </div>
      </Modal>

      <Modal
        open={movementModal !== null}
        title={movementModal === 'IN' ? 'Entrada de efectivo' : 'Salida de efectivo'}
        onClose={() => setMovementModal(null)}
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Valor"
            type="number"
            inputMode="numeric"
            value={movement.amount}
            onChange={(e) => setMovement({ ...movement, amount: e.target.value })}
            autoFocus
          />
          <Input
            label="Motivo"
            value={movement.reason}
            onChange={(e) => setMovement({ ...movement, reason: e.target.value })}
            placeholder="Ej: cambio para la caja, pago de domicilio…"
          />
          <Button loading={loading} onClick={() => void addMovement()}>
            Registrar movimiento
          </Button>
        </div>
      </Modal>
    </AppShell>
  );
}
