'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Barcode } from '@/components/barcode';
import { formatDateTime } from '@/lib/format';

interface SessionDetail {
  id: string;
  plate: string;
  vehicleType: { name: string };
  entryAt: string;
  ticket: { code: string } | null;
}

interface PublicSettings {
  parkingName?: string;
  address?: string;
  phone?: string;
  ticketFooter?: string;
}

export default function PrintTicketPage() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [settings, setSettings] = useState<PublicSettings>({});

  useEffect(() => {
    Promise.all([
      api<SessionDetail>(`/sessions/${id}`),
      api<PublicSettings>('/settings/public'),
    ]).then(([s, cfg]) => {
      setSession(s);
      setSettings(cfg);
      setTimeout(() => window.print(), 300);
    });
  }, [id]);

  if (!session) return <p className="p-4">Preparando ticket…</p>;

  return (
    <div className="print-area mx-auto max-w-[300px] p-2 text-center font-mono text-sm">
      <h1 className="text-base font-bold uppercase">{settings.parkingName ?? 'Parqueadero'}</h1>
      {settings.address && <p>{settings.address}</p>}
      {settings.phone && <p>Tel: {settings.phone}</p>}
      <hr className="my-2 border-dashed border-black" />
      <p className="text-lg font-bold">TICKET DE ENTRADA</p>
      <p className="my-1 text-2xl font-bold tracking-wider">{session.plate}</p>
      <p>{session.vehicleType.name}</p>
      <p>Entrada: {formatDateTime(session.entryAt)}</p>
      <div className="my-3 flex justify-center">
        {session.ticket && <Barcode value={session.ticket.code} />}
      </div>
      <p className="font-bold">{session.ticket?.code}</p>
      <hr className="my-2 border-dashed border-black" />
      <p className="text-xs">{settings.ticketFooter ?? 'Conserve este ticket.'}</p>
      <button
        onClick={() => window.print()}
        className="no-print mt-4 rounded-lg bg-brand-600 px-4 py-2 font-sans text-white"
      >
        Imprimir de nuevo
      </button>
    </div>
  );
}
