'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  CarFront,
  CircleParking,
  LucideIcon,
  ScanLine,
  WalletCards,
} from 'lucide-react';
import { api, getUser } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { Alert, Card } from '@/components/ui';
import { formatCOP } from '@/lib/format';

interface ShiftSummary {
  shift: { id: string; openedAt: string; openingCash: number };
  totals: { totalSales: number; paymentsCount: number; expectedCash: number };
}

interface Action {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  tone: string;
}

export default function PanelPage() {
  const [inside, setInside] = useState<number | null>(null);
  const [shift, setShift] = useState<ShiftSummary | null | undefined>(undefined);
  const user = typeof window !== 'undefined' ? getUser() : null;

  useEffect(() => {
    api<unknown[]>('/sessions/inside').then((sessions) => setInside(sessions.length)).catch(() => setInside(null));
    api<ShiftSummary | null>('/shifts/current').then(setShift).catch(() => setShift(null));
  }, []);

  const actions: Action[] = [
    {
      href: '/entrada',
      title: 'Registrar entrada',
      description: 'Ingresa un nuevo vehículo',
      icon: CarFront,
      tone: 'bg-brand-50 text-brand-700',
    },
    {
      href: '/cobrar',
      title: 'Cobrar salida',
      description: 'Escanea el ticket y cobra',
      icon: ScanLine,
      tone: 'bg-emerald-50 text-emerald-700',
    },
    {
      href: '/dentro',
      title: 'Vehículos dentro',
      description: inside === null ? 'Consultando ocupación' : `${inside} en este momento`,
      icon: CircleParking,
      tone: 'bg-slate-100 text-slate-700',
    },
    {
      href: '/turno',
      title: 'Caja y turno',
      description: shift ? 'Turno abierto' : 'Sin turno abierto',
      icon: WalletCards,
      tone: 'bg-amber-50 text-amber-700',
    },
  ];

  return (
    <AppShell>
      <div className="mb-8 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="mb-1 text-sm font-medium text-slate-400">Panel operativo</p>
          <h1 className="text-3xl font-semibold tracking-[-0.03em] text-slate-950">
            Hola, {user?.fullName?.split(' ')[0]}
          </h1>
          <p className="mt-2 text-sm text-slate-500">Todo lo que necesitas para operar el parqueadero.</p>
        </div>
        <p className="text-sm font-medium text-slate-400">
          {new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}
        </p>
      </div>

      {shift === null && (
        <div className="mb-6">
          <Alert kind="warning">
            No tienes un turno abierto. Para realizar cobros debes{' '}
            <Link href="/turno" className="font-semibold underline underline-offset-2">
              abrir un turno
            </Link>
            .
          </Alert>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lift focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-100"
            >
              <div className="mb-8 flex items-start justify-between">
                <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${action.tone}`}>
                  <Icon className="h-5 w-5" strokeWidth={1.9} />
                </span>
                <ArrowUpRight className="h-4 w-4 text-slate-300 transition-colors group-hover:text-slate-600" />
              </div>
              <span className="block text-base font-semibold tracking-tight text-slate-900">{action.title}</span>
              <span className="mt-1 block text-sm text-slate-500">{action.description}</span>
            </Link>
          );
        })}
      </div>

      {shift && (
        <Card className="mt-6 overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
            <div>
              <h2 className="font-semibold text-slate-900">Turno actual</h2>
              <p className="mt-0.5 text-xs text-slate-400">Resumen de tu operación en curso</p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Abierto
            </span>
          </div>
          <div className="grid divide-y divide-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <div className="px-6 py-5">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Ventas</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                {formatCOP(shift.totals.totalSales)}
              </p>
            </div>
            <div className="px-6 py-5">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Cobros</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{shift.totals.paymentsCount}</p>
            </div>
            <div className="px-6 py-5">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Efectivo esperado</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                {formatCOP(shift.totals.expectedCash)}
              </p>
            </div>
          </div>
        </Card>
      )}
    </AppShell>
  );
}
