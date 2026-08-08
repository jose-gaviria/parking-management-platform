'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { Card, PageTitle, Spinner } from '@/components/ui';
import { formatCOP, formatDuration } from '@/lib/format';

interface Summary {
  totalSales: number;
  paymentsCount: number;
  entries: number;
  exits: number;
  currentlyInside: number;
  avgStayMinutes: number;
  totalDiscounts: number;
  voidedPayments: number;
  lostTickets: number;
}

export default function AdminDashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    api<Summary>('/reports/summary').then(setSummary).catch(() => undefined);
  }, []);

  if (!summary) {
    return (
      <AppShell>
        <Spinner />
      </AppShell>
    );
  }

  const cards = [
    { label: 'Ventas de hoy', value: formatCOP(summary.totalSales), accent: 'text-emerald-700' },
    { label: 'Cobros', value: String(summary.paymentsCount) },
    { label: 'Entradas hoy', value: String(summary.entries) },
    { label: 'Salidas hoy', value: String(summary.exits) },
    { label: 'Dentro ahora', value: String(summary.currentlyInside), accent: 'text-brand-700' },
    { label: 'Permanencia promedio', value: formatDuration(summary.avgStayMinutes) },
    { label: 'Descuentos', value: formatCOP(summary.totalDiscounts) },
    { label: 'Tickets perdidos', value: String(summary.lostTickets) },
  ];

  return (
    <AppShell>
      <PageTitle subtitle="Resumen del día">Dashboard</PageTitle>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className="text-center">
            <div className={`text-2xl font-bold ${c.accent ?? ''}`}>{c.value}</div>
            <div className="mt-1 text-sm text-slate-500">{c.label}</div>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
