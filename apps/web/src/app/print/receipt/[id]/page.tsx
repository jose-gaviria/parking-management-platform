'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { formatCOP, formatDateTime, formatDuration } from '@/lib/format';

interface ReceiptData {
  id: string;
  receiptNumber: string;
  amount: number;
  receivedAmount: number | null;
  changeAmount: number | null;
  createdAt: string;
  operator: { fullName: string };
  allocations: Array<{ amount: number; paymentMethod: { name: string }; reference: string | null }>;
  session: {
    plate: string;
    vehicleType: { name: string };
    entryAt: string;
    exitAt: string | null;
    billedMinutes: number | null;
    subtotal: number | null;
    discount: number;
    tax: number;
    total: number | null;
    ticket: { code: string } | null;
  };
}

interface PublicSettings {
  parkingName?: string;
  address?: string;
  phone?: string;
}

export default function PrintReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ReceiptData | null>(null);
  const [settings, setSettings] = useState<PublicSettings>({});

  useEffect(() => {
    Promise.all([
      api<ReceiptData>(`/payments/${id}/receipt`),
      api<PublicSettings>('/settings/public'),
    ]).then(([d, cfg]) => {
      setData(d);
      setSettings(cfg);
      setTimeout(() => window.print(), 300);
    });
  }, [id]);

  if (!data) return <p className="p-4">Preparando comprobante…</p>;

  return (
    <div className="print-area mx-auto max-w-[300px] p-2 font-mono text-sm">
      <div className="text-center">
        <h1 className="text-base font-bold uppercase">{settings.parkingName ?? 'Parqueadero'}</h1>
        {settings.address && <p>{settings.address}</p>}
        {settings.phone && <p>Tel: {settings.phone}</p>}
        <hr className="my-2 border-dashed border-black" />
        <p className="font-bold">COMPROBANTE DE PAGO</p>
        <p className="font-bold">{data.receiptNumber}</p>
      </div>
      <div className="mt-2 space-y-0.5">
        <p>Placa: <strong>{data.session.plate}</strong> ({data.session.vehicleType.name})</p>
        <p>Ticket: {data.session.ticket?.code}</p>
        <p>Entrada: {formatDateTime(data.session.entryAt)}</p>
        <p>Salida: {formatDateTime(data.session.exitAt)}</p>
        <p>Tiempo: {formatDuration(data.session.billedMinutes)}</p>
      </div>
      <hr className="my-2 border-dashed border-black" />
      <div className="space-y-0.5">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{formatCOP(data.session.subtotal)}</span>
        </div>
        {data.session.discount > 0 && (
          <div className="flex justify-between">
            <span>Descuento</span>
            <span>-{formatCOP(data.session.discount)}</span>
          </div>
        )}
        {data.session.tax > 0 && (
          <div className="flex justify-between">
            <span>Impuesto</span>
            <span>{formatCOP(data.session.tax)}</span>
          </div>
        )}
        <div className="flex justify-between text-base font-bold">
          <span>TOTAL</span>
          <span>{formatCOP(data.amount)}</span>
        </div>
      </div>
      <hr className="my-2 border-dashed border-black" />
      <div className="space-y-0.5">
        {data.allocations.map((a, i) => (
          <div key={i} className="flex justify-between">
            <span>{a.paymentMethod.name}{a.reference ? ` (${a.reference})` : ''}</span>
            <span>{formatCOP(a.amount)}</span>
          </div>
        ))}
        {data.receivedAmount !== null && (
          <div className="flex justify-between">
            <span>Recibido</span>
            <span>{formatCOP(data.receivedAmount)}</span>
          </div>
        )}
        {data.changeAmount !== null && data.changeAmount > 0 && (
          <div className="flex justify-between font-bold">
            <span>Cambio</span>
            <span>{formatCOP(data.changeAmount)}</span>
          </div>
        )}
      </div>
      <hr className="my-2 border-dashed border-black" />
      <div className="text-center text-xs">
        <p>Atendido por: {data.operator.fullName}</p>
        <p>{formatDateTime(data.createdAt)}</p>
        <p className="mt-1">¡Gracias por su visita!</p>
      </div>
      <button
        onClick={() => window.print()}
        className="no-print mt-4 w-full rounded-lg bg-brand-600 px-4 py-2 font-sans text-white"
      >
        Imprimir de nuevo
      </button>
    </div>
  );
}
