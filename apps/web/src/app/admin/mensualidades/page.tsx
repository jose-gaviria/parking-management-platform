'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { Alert, Badge, Button, Card, Input, Modal, PageTitle, Spinner } from '@/components/ui';
import { formatCOP } from '@/lib/format';

interface Subscription {
  id: string;
  plate: string;
  status: string;
  startsAt: string;
  endsAt: string;
  price: number;
  customer: { name: string };
  vehicleType: { name: string };
}

interface Customer {
  id: string;
  name: string;
}

interface VehicleType {
  id: string;
  name: string;
}

const STATUS_COLOR: Record<string, 'green' | 'yellow' | 'red' | 'gray'> = {
  ACTIVE: 'green',
  SUSPENDED: 'yellow',
  EXPIRED: 'red',
  CANCELLED: 'gray',
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Activa',
  SUSPENDED: 'Suspendida',
  EXPIRED: 'Vencida',
  CANCELLED: 'Cancelada',
};

export default function MensualidadesPage() {
  const [subs, setSubs] = useState<Subscription[] | null>(null);
  const [expiring, setExpiring] = useState<Subscription[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [types, setTypes] = useState<VehicleType[]>([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ customerId: '', plate: '', vehicleTypeId: '', startsAt: '', endsAt: '', price: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<Subscription[]>('/customers/subscriptions').then(setSubs).catch(() => setSubs([]));
    api<Subscription[]>('/customers/subscriptions/expiring').then(setExpiring).catch(() => undefined);
    api<Customer[]>('/customers').then(setCustomers).catch(() => undefined);
    api<VehicleType[]>('/catalog/vehicle-types').then(setTypes).catch(() => undefined);
  }, []);

  useEffect(load, [load]);

  async function create() {
    setBusy(true);
    setError('');
    try {
      await api('/customers/subscriptions', {
        method: 'POST',
        body: {
          customerId: form.customerId,
          plate: form.plate,
          vehicleTypeId: form.vehicleTypeId,
          startsAt: new Date(form.startsAt).toISOString(),
          endsAt: new Date(`${form.endsAt}T23:59:59`).toISOString(),
          price: Number(form.price),
        },
      });
      setModal(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear la mensualidad.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between">
        <PageTitle>Mensualidades</PageTitle>
        <Button
          size="md"
          onClick={() => {
            setForm({
              customerId: customers[0]?.id ?? '',
              plate: '',
              vehicleTypeId: types[0]?.id ?? '',
              startsAt: new Date().toISOString().slice(0, 10),
              endsAt: '',
              price: '',
            });
            setModal(true);
          }}
        >
          + Nueva mensualidad
        </Button>
      </div>

      {expiring.length > 0 && (
        <div className="mb-4">
          <Alert kind="warning">
            {expiring.length} mensualidad(es) vencen en los próximos 7 días:{' '}
            {expiring.map((s) => s.plate).join(', ')}
          </Alert>
        </div>
      )}
      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}

      {subs === null ? (
        <Spinner />
      ) : (
        <Card>
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200 text-sm text-slate-500">
                <th className="py-2">Placa</th>
                <th>Cliente</th>
                <th>Tipo</th>
                <th>Vigencia</th>
                <th>Precio</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((s) => (
                <tr key={s.id} className="border-b border-slate-100">
                  <td className="py-3 font-mono font-bold">{s.plate}</td>
                  <td>{s.customer.name}</td>
                  <td>{s.vehicleType.name}</td>
                  <td className="text-sm">
                    {new Date(s.startsAt).toLocaleDateString('es-CO')} —{' '}
                    {new Date(s.endsAt).toLocaleDateString('es-CO')}
                  </td>
                  <td>{formatCOP(s.price)}</td>
                  <td>
                    <Badge color={STATUS_COLOR[s.status] ?? 'gray'}>
                      {STATUS_LABEL[s.status] ?? s.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {subs.length === 0 && <p className="py-4 text-center text-slate-400">Sin mensualidades.</p>}
        </Card>
      )}

      <Modal open={modal} title="Nueva mensualidad" onClose={() => setModal(false)}>
        <div className="flex flex-col gap-3">
          <div>
            <span className="mb-1 block text-sm font-medium text-slate-700">Cliente</span>
            <select
              value={form.customerId}
              onChange={(e) => setForm({ ...form, customerId: e.target.value })}
              className="w-full rounded-xl border border-slate-300 px-4 py-3"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <Input label="Placa" value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value.toUpperCase() })} className="font-mono uppercase" />
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
          <div className="grid grid-cols-2 gap-3">
            <Input label="Desde" type="date" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
            <Input label="Hasta" type="date" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
          </div>
          <Input label="Precio (COP)" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          {error && <Alert kind="error">{error}</Alert>}
          <Button loading={busy} onClick={() => void create()}>
            Crear mensualidad
          </Button>
        </div>
      </Modal>
    </AppShell>
  );
}
