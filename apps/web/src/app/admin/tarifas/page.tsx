'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { Alert, Badge, Button, Card, Input, Modal, PageTitle, Spinner } from '@/components/ui';
import { formatCOP } from '@/lib/format';

interface Tariff {
  id: string;
  name: string;
  active: boolean;
  vehicleType: { name: string };
  versions: Array<{ id: string; version: number; rules: Rules; createdAt: string }>;
}

interface Rules {
  mode: string;
  unitPrice: number;
  fractionMinutes?: number;
  graceMinutes?: number;
  dailyMax?: number;
  dayPrice?: number;
  lostTicketFee?: number;
  taxPct?: number;
}

interface VehicleType {
  id: string;
  name: string;
}

const MODES = [
  { value: 'PER_MINUTE', label: 'Por minuto' },
  { value: 'PER_FRACTION', label: 'Por fracción' },
  { value: 'PER_HOUR', label: 'Por hora' },
  { value: 'PER_DAY', label: 'Por día' },
];

const EMPTY_FORM = {
  name: '',
  vehicleTypeId: '',
  mode: 'PER_HOUR',
  unitPrice: '',
  fractionMinutes: '',
  graceMinutes: '',
  dailyMax: '',
  dayPrice: '',
  lostTicketFee: '',
  taxPct: '',
};

export default function TarifasPage() {
  const [tariffs, setTariffs] = useState<Tariff[] | null>(null);
  const [types, setTypes] = useState<VehicleType[]>([]);
  const [modal, setModal] = useState<null | { tariffId?: string }>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<Tariff[]>('/tariffs').then(setTariffs).catch(() => setTariffs([]));
    api<VehicleType[]>('/catalog/vehicle-types').then(setTypes).catch(() => undefined);
  }, []);

  useEffect(load, [load]);

  function buildRules(): Rules {
    const rules: Rules = {
      mode: form.mode,
      unitPrice: Number(form.unitPrice) || 0,
    };
    if (form.fractionMinutes) rules.fractionMinutes = Number(form.fractionMinutes);
    if (form.graceMinutes) rules.graceMinutes = Number(form.graceMinutes);
    if (form.dailyMax) rules.dailyMax = Number(form.dailyMax);
    if (form.dayPrice) rules.dayPrice = Number(form.dayPrice);
    if (form.lostTicketFee) rules.lostTicketFee = Number(form.lostTicketFee);
    if (form.taxPct) rules.taxPct = Number(form.taxPct);
    return rules;
  }

  async function save() {
    setBusy(true);
    setError('');
    try {
      if (modal?.tariffId) {
        await api(`/tariffs/${modal.tariffId}/versions`, {
          method: 'POST',
          body: { rules: buildRules() },
        });
        setNotice('Nueva versión creada. Las estancias anteriores conservan la tarifa con la que se cobraron.');
      } else {
        await api('/tariffs', {
          method: 'POST',
          body: { name: form.name, vehicleTypeId: form.vehicleTypeId, rules: buildRules() },
        });
        setNotice('Tarifa creada.');
      }
      setModal(null);
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar.');
    } finally {
      setBusy(false);
    }
  }

  function openNewVersion(t: Tariff) {
    const rules = t.versions[0]?.rules;
    setForm({
      ...EMPTY_FORM,
      name: t.name,
      mode: rules?.mode ?? 'PER_HOUR',
      unitPrice: String(rules?.unitPrice ?? ''),
      fractionMinutes: rules?.fractionMinutes ? String(rules.fractionMinutes) : '',
      graceMinutes: rules?.graceMinutes ? String(rules.graceMinutes) : '',
      dailyMax: rules?.dailyMax ? String(rules.dailyMax) : '',
      dayPrice: rules?.dayPrice ? String(rules.dayPrice) : '',
      lostTicketFee: rules?.lostTicketFee ? String(rules.lostTicketFee) : '',
      taxPct: rules?.taxPct ? String(rules.taxPct) : '',
    });
    setModal({ tariffId: t.id });
  }

  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between">
        <PageTitle subtitle="Cada cambio crea una versión nueva — el histórico nunca se modifica">
          Tarifas
        </PageTitle>
        <Button
          size="md"
          onClick={() => {
            setForm({ ...EMPTY_FORM, vehicleTypeId: types[0]?.id ?? '' });
            setModal({});
          }}
        >
          + Nueva tarifa
        </Button>
      </div>

      {notice && <div className="mb-4"><Alert kind="success">{notice}</Alert></div>}
      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}

      {tariffs === null ? (
        <Spinner />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {tariffs.map((t) => {
            const rules = t.versions[0]?.rules;
            return (
              <Card key={t.id}>
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">{t.name}</h2>
                  <div className="flex gap-2">
                    <Badge color={t.active ? 'green' : 'gray'}>
                      {t.active ? 'Activa' : 'Inactiva'}
                    </Badge>
                    <Badge color="blue">v{t.versions[0]?.version ?? 1}</Badge>
                  </div>
                </div>
                <p className="text-sm text-slate-500">{t.vehicleType.name}</p>
                {rules && (
                  <dl className="mt-3 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Modo</dt>
                      <dd>{MODES.find((m) => m.value === rules.mode)?.label ?? rules.mode}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Precio unidad</dt>
                      <dd className="font-medium">{formatCOP(rules.unitPrice)}</dd>
                    </div>
                    {rules.dayPrice !== undefined && (
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Precio día</dt>
                        <dd>{formatCOP(rules.dayPrice)}</dd>
                      </div>
                    )}
                    {rules.graceMinutes !== undefined && (
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Gracia</dt>
                        <dd>{rules.graceMinutes} min</dd>
                      </div>
                    )}
                    {rules.dailyMax !== undefined && (
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Tope diario</dt>
                        <dd>{formatCOP(rules.dailyMax)}</dd>
                      </div>
                    )}
                    {rules.lostTicketFee !== undefined && (
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Ticket perdido</dt>
                        <dd>{formatCOP(rules.lostTicketFee)}</dd>
                      </div>
                    )}
                  </dl>
                )}
                <div className="mt-4">
                  <Button size="sm" variant="ghost" onClick={() => openNewVersion(t)}>
                    Modificar (nueva versión)
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={modal !== null}
        title={modal?.tariffId ? 'Nueva versión de tarifa' : 'Nueva tarifa'}
        onClose={() => setModal(null)}
      >
        <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto">
          {!modal?.tariffId && (
            <>
              <Input
                label="Nombre"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <div>
                <span className="mb-1 block text-sm font-medium text-slate-700">Tipo de vehículo</span>
                <select
                  value={form.vehicleTypeId}
                  onChange={(e) => setForm({ ...form, vehicleTypeId: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3"
                >
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
          <div>
            <span className="mb-1 block text-sm font-medium text-slate-700">Modo de cobro</span>
            <select
              value={form.mode}
              onChange={(e) => setForm({ ...form, mode: e.target.value })}
              className="w-full rounded-xl border border-slate-300 px-4 py-3"
            >
              {MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Precio por unidad (COP)" type="number" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} />
            {form.mode === 'PER_FRACTION' && (
              <Input label="Minutos por fracción" type="number" value={form.fractionMinutes} onChange={(e) => setForm({ ...form, fractionMinutes: e.target.value })} />
            )}
            {form.mode === 'PER_DAY' && (
              <Input label="Precio por día (COP)" type="number" value={form.dayPrice} onChange={(e) => setForm({ ...form, dayPrice: e.target.value })} />
            )}
            <Input label="Minutos de gracia" type="number" value={form.graceMinutes} onChange={(e) => setForm({ ...form, graceMinutes: e.target.value })} />
            <Input label="Tope máximo diario (COP)" type="number" value={form.dailyMax} onChange={(e) => setForm({ ...form, dailyMax: e.target.value })} />
            <Input label="Recargo ticket perdido" type="number" value={form.lostTicketFee} onChange={(e) => setForm({ ...form, lostTicketFee: e.target.value })} />
            <Input label="Impuesto % (0 = sin impuesto)" type="number" value={form.taxPct} onChange={(e) => setForm({ ...form, taxPct: e.target.value })} />
          </div>
          {error && <Alert kind="error">{error}</Alert>}
          <Button loading={busy} onClick={() => void save()}>
            Guardar
          </Button>
        </div>
      </Modal>
    </AppShell>
  );
}
