'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BadgePercent, Bike, CarFront, Hotel, LucideIcon } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { Alert, Button, Card, Input, PageTitle } from '@/components/ui';

interface VehicleType {
  id: string;
  code: string;
  name: string;
}

interface EntryResult {
  id: string;
  plate: string;
  ticket: { id: string; code: string };
  vehicleType: { name: string };
  entryAt: string;
}

function vehicleIcon(code: string): LucideIcon {
  if (code.includes('MOTORCYCLE')) return Bike;
  return CarFront;
}

export default function EntradaPage() {
  const router = useRouter();
  const plateRef = useRef<HTMLInputElement>(null);
  const [types, setTypes] = useState<VehicleType[]>([]);
  const [plate, setPlate] = useState('');
  const [typeId, setTypeId] = useState('');
  const [showOptional, setShowOptional] = useState(false);
  const [optional, setOptional] = useState({ color: '', brand: '', spotNumber: '', notes: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<EntryResult | null>(null);

  useEffect(() => {
    api<VehicleType[]>('/catalog/vehicle-types').then((t) => {
      setTypes(t);
      if (t.length > 0) setTypeId(t[0].id);
    });
    plateRef.current?.focus();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      const session = await api<EntryResult>('/sessions/entry', {
        method: 'POST',
        body: {
          plate: plate.trim() || undefined,
          vehicleTypeId: typeId,
          color: optional.color || undefined,
          brand: optional.brand || undefined,
          spotNumber: optional.spotNumber || undefined,
          notes: optional.notes || undefined,
        },
      });
      setDone(session);
      // Abrir ticket para imprimir en nueva pestaña
      window.open(`/print/ticket/${session.id}`, '_blank', 'width=400,height=600');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo registrar la entrada.');
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setDone(null);
    setPlate('');
    setOptional({ color: '', brand: '', spotNumber: '', notes: '' });
    setError('');
    setTimeout(() => plateRef.current?.focus(), 50);
  }

  if (done) {
    return (
      <AppShell>
        <div className="mx-auto max-w-xl">
          <Alert kind="success">
            <div className="text-lg font-bold">Entrada registrada</div>
            <div>
              Placa <span className="font-mono font-bold">{done.plate}</span> — ticket{' '}
              <span className="font-mono">{done.ticket.code}</span>
            </div>
          </Alert>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button onClick={reset} className="flex-1" autoFocus>
              Registrar otra entrada
            </Button>
            <Button
              variant="ghost"
              onClick={() => window.open(`/print/ticket/${done.id}`, '_blank', 'width=400,height=600')}
            >
              Volver a imprimir
            </Button>
            <Button variant="ghost" onClick={() => router.push('/panel')}>
              Ir al panel
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-xl">
        <PageTitle subtitle="Solo necesitas placa y tipo de vehículo">Registrar entrada</PageTitle>
        <Card>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <Input
              ref={plateRef}
              label="Placa"
              name="plate"
              placeholder="ABC123 — deja vacío si no tiene placa"
              value={plate}
              onChange={(e) => setPlate(e.target.value.toUpperCase())}
              className="font-mono text-2xl tracking-widest uppercase"
              maxLength={10}
            />

            <div>
              <span className="mb-2 block text-sm font-medium text-slate-700">Tipo de vehículo</span>
              <div className="grid grid-cols-2 gap-3">
                {types.map((type) => {
                  const Icon = vehicleIcon(type.code);
                  const isHotel = type.code.startsWith('HOTEL_');
                  const selected = typeId === type.id;
                  return (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setTypeId(type.id)}
                      className={`relative min-h-32 rounded-2xl border p-4 text-left transition-all ${
                        selected
                          ? 'border-brand-500 bg-brand-50 shadow-[0_0_0_3px_rgba(99,102,241,0.08)]'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-soft'
                      }`}
                      aria-pressed={selected}
                    >
                      <div className="mb-5 flex items-start justify-between">
                        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${selected ? 'bg-white text-brand-700' : 'bg-slate-100 text-slate-600'}`}>
                          <Icon className="h-5 w-5" strokeWidth={1.8} />
                        </span>
                        {isHotel && (
                          <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                            <Hotel className="h-3 w-3" />
                            Hotel
                          </span>
                        )}
                      </div>
                      <span className={`block text-base font-semibold ${selected ? 'text-brand-900' : 'text-slate-800'}`}>
                        {type.name}
                      </span>
                      {isHotel && (
                        <span className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                          <BadgePercent className="h-3.5 w-3.5" />
                          50% de descuento
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowOptional(!showOptional)}
              className="text-left text-sm font-medium text-brand-700 hover:underline"
            >
              {showOptional ? '− Ocultar datos opcionales' : '+ Agregar datos opcionales (color, marca, espacio…)'}
            </button>

            {showOptional && (
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Color"
                  value={optional.color}
                  onChange={(e) => setOptional({ ...optional, color: e.target.value })}
                />
                <Input
                  label="Marca"
                  value={optional.brand}
                  onChange={(e) => setOptional({ ...optional, brand: e.target.value })}
                />
                <Input
                  label="Espacio"
                  value={optional.spotNumber}
                  onChange={(e) => setOptional({ ...optional, spotNumber: e.target.value })}
                />
                <Input
                  label="Observación"
                  value={optional.notes}
                  onChange={(e) => setOptional({ ...optional, notes: e.target.value })}
                />
              </div>
            )}

            {error && <Alert kind="error">{error}</Alert>}

            <Button type="submit" loading={loading} disabled={!typeId}>
              Registrar e imprimir ticket
            </Button>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
