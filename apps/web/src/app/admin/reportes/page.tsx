'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { api, apiUrl, getToken } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { Button, Card, Input, PageTitle } from '@/components/ui';
import { formatCOP } from '@/lib/format';

interface Row {
  label: string;
  total: number;
  count: number;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ReportesPage() {
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [groupBy, setGroupBy] = useState<'day' | 'operator' | 'method'>('day');
  const [rows, setRows] = useState<Row[]>([]);
  const [byType, setByType] = useState<Row[]>([]);
  const [hours, setHours] = useState<Array<{ hour: number; entries: number }>>([]);

  const load = useCallback(() => {
    const params = `?from=${from}T00:00:00&to=${to}T23:59:59`;
    api<Row[]>(`/reports/sales${params}&groupBy=${groupBy}`).then(setRows).catch(() => setRows([]));
    api<Row[]>(`/reports/sales-by-vehicle-type${params}`).then(setByType).catch(() => undefined);
    api<Array<{ hour: number; entries: number }>>(`/reports/occupancy-by-hour${params}`)
      .then(setHours)
      .catch(() => undefined);
  }, [from, to, groupBy]);

  useEffect(load, [load]);

  async function downloadCsv() {
    const res = await fetch(
      apiUrl(`/reports/sessions.csv?from=${from}T00:00:00&to=${to}T23:59:59`),
      { headers: { Authorization: `Bearer ${getToken()}` } },
    );
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `estancias_${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const maxEntries = Math.max(1, ...hours.map((h) => h.entries));
  const totalSales = rows.reduce((s, r) => s + r.total, 0);

  return (
    <AppShell>
      <PageTitle>Reportes</PageTitle>

      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <Input label="Desde" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input label="Hasta" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <div>
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Agrupar por</span>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as never)}
              className="rounded-xl border border-slate-300 px-4 py-3"
            >
              <option value="day">Día</option>
              <option value="operator">Operador</option>
              <option value="method">Medio de pago</option>
            </select>
          </div>
          <Button size="md" variant="ghost" onClick={() => void downloadCsv()}>
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">
            Ventas — total {formatCOP(totalSales)}
          </h2>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2">
                  {groupBy === 'day' ? 'Fecha' : groupBy === 'operator' ? 'Operador' : 'Medio'}
                </th>
                <th className="text-right">Cobros</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-b border-slate-100">
                  <td className="py-2">{r.label}</td>
                  <td className="text-right">{r.count}</td>
                  <td className="text-right font-medium">{formatCOP(r.total)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-4 text-center text-slate-400">
                    Sin datos en el periodo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <h2 className="mb-3 font-semibold">Ingresos por tipo de vehículo</h2>
            <div className="space-y-2 text-sm">
              {byType.map((r) => (
                <div key={r.label} className="flex justify-between">
                  <span className="text-slate-600">
                    {r.label} ({r.count})
                  </span>
                  <span className="font-medium">{formatCOP(r.total)}</span>
                </div>
              ))}
              {byType.length === 0 && <p className="text-slate-400">Sin datos.</p>}
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 font-semibold">Entradas por hora</h2>
            <div className="flex h-32 items-end gap-0.5" role="img" aria-label="Histograma de entradas por hora">
              {hours.map((h) => (
                <div key={h.hour} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t bg-brand-500"
                    style={{ height: `${(h.entries / maxEntries) * 100}%`, minHeight: h.entries > 0 ? 4 : 0 }}
                    title={`${h.hour}:00 — ${h.entries} entradas`}
                  />
                  {h.hour % 6 === 0 && <span className="text-[10px] text-slate-400">{h.hour}</span>}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
