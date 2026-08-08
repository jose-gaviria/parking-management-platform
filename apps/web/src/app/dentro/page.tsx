'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { Badge, Card, Input, PageTitle, Spinner } from '@/components/ui';
import { formatDuration, formatTime, minutesSince } from '@/lib/format';

interface InsideSession {
  id: string;
  plate: string;
  isTempPlate: boolean;
  vehicleType: { name: string };
  entryAt: string;
  ticket: { code: string } | null;
  spotNumber: string | null;
}

export default function DentroPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<InsideSession[] | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = () =>
      api<InsideSession[]>(`/sessions/inside${search ? `?search=${encodeURIComponent(search)}` : ''}`)
        .then(setSessions)
        .catch(() => setSessions([]));
    load();
    const interval = setInterval(load, 30_000); // refresco automático
    return () => clearInterval(interval);
  }, [search]);

  return (
    <AppShell>
      <PageTitle subtitle={sessions ? `${sessions.length} vehículo(s) en este momento` : undefined}>
        Vehículos dentro
      </PageTitle>

      <div className="mb-4 max-w-sm">
        <Input
          placeholder="Filtrar por placa…"
          value={search}
          onChange={(e) => setSearch(e.target.value.toUpperCase())}
          className="font-mono uppercase"
          aria-label="Filtrar por placa"
        />
      </div>

      {sessions === null ? (
        <Spinner />
      ) : sessions.length === 0 ? (
        <Card className="text-center text-slate-500">No hay vehículos dentro.</Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => router.push(`/estancia/${s.id}`)}
              className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-brand-400"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xl font-bold">{s.plate}</span>
                {s.isTempPlate && <Badge color="yellow">Sin placa</Badge>}
              </div>
              <div className="mt-1 text-sm text-slate-500">
                {s.vehicleType.name}
                {s.spotNumber ? ` · Espacio ${s.spotNumber}` : ''}
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-slate-500">Entró {formatTime(s.entryAt)}</span>
                <Badge color="blue">{formatDuration(minutesSince(s.entryAt))}</Badge>
              </div>
            </button>
          ))}
        </div>
      )}
    </AppShell>
  );
}
