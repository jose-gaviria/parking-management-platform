'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { Alert, Badge, Button, Card, Input, Modal, PageTitle, Spinner } from '@/components/ui';

interface Customer {
  id: string;
  kind: 'PERSON' | 'COMPANY';
  name: string;
  idNumber: string | null;
  phone: string | null;
  subscriptions: unknown[];
  agreements: unknown[];
}

export default function ClientesPage() {
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ kind: 'PERSON' as 'PERSON' | 'COMPANY', name: '', idNumber: '', phone: '', email: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<Customer[]>(`/customers${search ? `?search=${encodeURIComponent(search)}` : ''}`)
      .then(setCustomers)
      .catch(() => setCustomers([]));
  }, [search]);

  useEffect(load, [load]);

  async function create() {
    setBusy(true);
    setError('');
    try {
      await api('/customers', {
        method: 'POST',
        body: {
          kind: form.kind,
          name: form.name,
          idNumber: form.idNumber || undefined,
          phone: form.phone || undefined,
          email: form.email || undefined,
        },
      });
      setModal(false);
      setForm({ kind: 'PERSON', name: '', idNumber: '', phone: '', email: '' });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear el cliente.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between">
        <PageTitle>Clientes</PageTitle>
        <Button size="md" onClick={() => setModal(true)}>
          + Nuevo cliente
        </Button>
      </div>

      <div className="mb-4 max-w-sm">
        <Input placeholder="Buscar por nombre o documento…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {customers === null ? (
        <Spinner />
      ) : (
        <Card>
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200 text-sm text-slate-500">
                <th className="py-2">Nombre</th>
                <th>Documento</th>
                <th>Teléfono</th>
                <th>Beneficios activos</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-b border-slate-100">
                  <td className="py-3">
                    {c.name}{' '}
                    <Badge color="gray">{c.kind === 'COMPANY' ? 'Empresa' : 'Persona'}</Badge>
                  </td>
                  <td>{c.idNumber ?? '—'}</td>
                  <td>{c.phone ?? '—'}</td>
                  <td>
                    <div className="flex gap-1">
                      {c.subscriptions.length > 0 && (
                        <Badge color="green">{c.subscriptions.length} mensualidad(es)</Badge>
                      )}
                      {c.agreements.length > 0 && (
                        <Badge color="blue">{c.agreements.length} convenio(s)</Badge>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {customers.length === 0 && <p className="py-4 text-center text-slate-400">Sin clientes.</p>}
        </Card>
      )}

      <Modal open={modal} title="Nuevo cliente" onClose={() => setModal(false)}>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            {(['PERSON', 'COMPANY'] as const).map((k) => (
              <button
                key={k}
                onClick={() => setForm({ ...form, kind: k })}
                className={`rounded-xl border-2 px-4 py-3 font-semibold ${
                  form.kind === k ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-slate-200 text-slate-600'
                }`}
              >
                {k === 'PERSON' ? 'Persona' : 'Empresa'}
              </button>
            ))}
          </div>
          <Input label="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Documento / NIT" value={form.idNumber} onChange={(e) => setForm({ ...form, idNumber: e.target.value })} />
          <Input label="Teléfono" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input label="Correo" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          {error && <Alert kind="error">{error}</Alert>}
          <Button loading={busy} onClick={() => void create()}>
            Crear cliente
          </Button>
        </div>
      </Modal>
    </AppShell>
  );
}
