'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { Badge, Button, Card, PageTitle, Spinner } from '@/components/ui';
import { formatCOP, formatDateTime } from '@/lib/format';

interface Shift {
  id: string;
  status: string;
  openedAt: string;
  closedAt: string | null;
  openingCash: number;
  expectedCash: number | null;
  countedCash: number | null;
  difference: number | null;
  user: { fullName: string };
}

export default function TurnosPage() {
  const [shifts, setShifts] = useState<Shift[] | null>(null);

  useEffect(() => {
    api<Shift[]>('/shifts').then(setShifts).catch(() => setShifts([]));
  }, []);

  return (
    <AppShell>
      <PageTitle subtitle="Historial de turnos y diferencias de caja">Turnos</PageTitle>
      {shifts === null ? (
        <Spinner />
      ) : (
        <Card>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2">Operador</th>
                <th>Apertura</th>
                <th>Cierre</th>
                <th>Base</th>
                <th>Esperado</th>
                <th>Contado</th>
                <th>Diferencia</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((s) => (
                <tr key={s.id} className="border-b border-slate-100">
                  <td className="py-3">{s.user.fullName}</td>
                  <td>{formatDateTime(s.openedAt)}</td>
                  <td>
                    {s.status === 'OPEN' ? <Badge color="blue">Abierto</Badge> : formatDateTime(s.closedAt)}
                  </td>
                  <td>{formatCOP(s.openingCash)}</td>
                  <td>{formatCOP(s.expectedCash)}</td>
                  <td>{formatCOP(s.countedCash)}</td>
                  <td>
                    {s.difference === null ? (
                      '—'
                    ) : s.difference === 0 ? (
                      <Badge color="green">Cuadrada</Badge>
                    ) : (
                      <Badge color={s.difference < 0 ? 'red' : 'yellow'}>{formatCOP(s.difference)}</Badge>
                    )}
                  </td>
                  <td>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => window.open(`/print/shift/${s.id}`, '_blank', 'width=400,height=600')}
                    >
                      Resumen
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </AppShell>
  );
}
