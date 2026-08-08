'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, hasPermission } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { Alert, Badge, Button, Card, PageTitle, Spinner } from '@/components/ui';
import { formatDateTime } from '@/lib/format';

interface Invoice {
  id: string;
  number: string;
  status: string;
  provider: string;
  providerRef: string | null;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  session: { plate: string };
}

const STATUS: Record<string, { label: string; color: 'green' | 'yellow' | 'red' | 'gray' | 'blue' }> = {
  PENDING: { label: 'Pendiente', color: 'yellow' },
  SENT: { label: 'Enviada', color: 'blue' },
  ACCEPTED: { label: 'Aceptada', color: 'green' },
  REJECTED: { label: 'Rechazada', color: 'red' },
  CANCELLED: { label: 'Anulada', color: 'gray' },
};

export default function FacturasPage() {
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [notice, setNotice] = useState('');

  const load = useCallback(() => {
    api<Invoice[]>('/billing/invoices').then(setInvoices).catch(() => setInvoices([]));
  }, []);

  useEffect(load, [load]);

  async function retry() {
    const res = await api<{ retried: number }>('/billing/retry-pending', { method: 'POST' });
    setNotice(`Se reintentaron ${res.retried} factura(s) pendiente(s).`);
    load();
  }

  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between">
        <PageTitle subtitle="Proveedor simulado activo — la integración real se configura por adaptador">
          Facturas
        </PageTitle>
        {hasPermission('settings.manage') && (
          <Button size="md" variant="ghost" onClick={() => void retry()}>
            Reintentar pendientes
          </Button>
        )}
      </div>

      {notice && <div className="mb-4"><Alert kind="success">{notice}</Alert></div>}

      {invoices === null ? (
        <Spinner />
      ) : (
        <Card>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2">Número</th>
                <th>Placa</th>
                <th>Fecha</th>
                <th>Proveedor</th>
                <th>Estado</th>
                <th>Intentos</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((i) => {
                const st = STATUS[i.status] ?? { label: i.status, color: 'gray' as const };
                return (
                  <tr key={i.id} className="border-b border-slate-100">
                    <td className="py-3 font-mono">{i.number}</td>
                    <td className="font-mono">{i.session.plate}</td>
                    <td>{formatDateTime(i.createdAt)}</td>
                    <td>{i.provider}</td>
                    <td>
                      <Badge color={st.color}>{st.label}</Badge>
                      {i.lastError && <span className="ml-2 text-xs text-red-500">{i.lastError}</span>}
                    </td>
                    <td>{i.attempts}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {invoices.length === 0 && <p className="py-4 text-center text-slate-400">Sin facturas.</p>}
        </Card>
      )}
    </AppShell>
  );
}
