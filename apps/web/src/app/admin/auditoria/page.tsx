'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { Button, Card, Input, PageTitle, Spinner } from '@/components/ui';
import { formatDateTime } from '@/lib/format';

interface AuditItem {
  id: string;
  action: string;
  module: string;
  entityType: string | null;
  entityId: string | null;
  reason: string | null;
  terminal: string | null;
  createdAt: string;
  user: { username: string; fullName: string } | null;
  authorizer: { username: string } | null;
  newValue: unknown;
}

interface AuditResponse {
  items: AuditItem[];
  total: number;
  page: number;
  pageSize: number;
}

export default function AuditoriaPage() {
  const [data, setData] = useState<AuditResponse | null>(null);
  const [filters, setFilters] = useState({ from: '', to: '', action: '', module: '' });
  const [page, setPage] = useState(1);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (filters.from) params.set('from', `${filters.from}T00:00:00`);
    if (filters.to) params.set('to', `${filters.to}T23:59:59`);
    if (filters.action) params.set('action', filters.action);
    if (filters.module) params.set('module', filters.module);
    params.set('page', String(page));
    api<AuditResponse>(`/audit?${params}`).then(setData).catch(() => undefined);
  }, [filters, page]);

  useEffect(load, [load]);

  return (
    <AppShell>
      <PageTitle subtitle="Registro completo de acciones del sistema">Auditoría</PageTitle>

      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <Input label="Desde" type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
          <Input label="Hasta" type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
          <Input label="Acción" placeholder="PAYMENT_CONFIRM…" value={filters.action} onChange={(e) => setFilters({ ...filters, action: e.target.value.toUpperCase() })} />
          <Input label="Módulo" placeholder="payments…" value={filters.module} onChange={(e) => setFilters({ ...filters, module: e.target.value })} />
          <Button size="md" variant="ghost" onClick={() => { setPage(1); load(); }}>
            Filtrar
          </Button>
        </div>
      </Card>

      {data === null ? (
        <Spinner />
      ) : (
        <Card>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2">Fecha</th>
                <th>Usuario</th>
                <th>Acción</th>
                <th>Módulo</th>
                <th>Entidad</th>
                <th>Motivo / autorizó</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((i) => (
                <tr key={i.id} className="border-b border-slate-100 align-top">
                  <td className="py-2 whitespace-nowrap">{formatDateTime(i.createdAt)}</td>
                  <td>{i.user?.username ?? 'sistema'}</td>
                  <td className="font-mono text-xs">{i.action}</td>
                  <td>{i.module}</td>
                  <td className="font-mono text-xs">{i.entityType ?? ''}</td>
                  <td className="text-xs text-slate-500">
                    {i.reason && <div>{i.reason}</div>}
                    {i.authorizer && <div>Autorizó: {i.authorizer.username}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
            <span>
              {data.total} registro(s) — página {data.page}
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                ← Anterior
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={page * data.pageSize >= data.total}
                onClick={() => setPage(page + 1)}
              >
                Siguiente →
              </Button>
            </div>
          </div>
        </Card>
      )}
    </AppShell>
  );
}
