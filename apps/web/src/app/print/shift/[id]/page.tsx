'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { formatCOP, formatDateTime } from '@/lib/format';

interface ShiftSummary {
  shift: {
    openedAt: string;
    closedAt: string | null;
    openingCash: number;
    countedCash: number | null;
    difference: number | null;
    closingNotes: string | null;
    user: { fullName: string };
  };
  totals: {
    totalSales: number;
    paymentsCount: number;
    byMethod: Record<string, { name: string; total: number; count: number }>;
    cashSales: number;
    movementsIn: number;
    movementsOut: number;
    expectedCash: number;
  };
}

export default function PrintShiftPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ShiftSummary | null>(null);

  useEffect(() => {
    api<ShiftSummary>(`/shifts/${id}/summary`).then((d) => {
      setData(d);
      setTimeout(() => window.print(), 300);
    });
  }, [id]);

  if (!data) return <p className="p-4">Preparando cierre…</p>;

  return (
    <div className="print-area mx-auto max-w-[300px] p-2 font-mono text-sm">
      <div className="text-center">
        <p className="text-base font-bold">CIERRE DE TURNO</p>
        <p>{data.shift.user.fullName}</p>
        <p className="text-xs">
          {formatDateTime(data.shift.openedAt)} → {formatDateTime(data.shift.closedAt)}
        </p>
      </div>
      <hr className="my-2 border-dashed border-black" />
      <div className="space-y-0.5">
        <div className="flex justify-between">
          <span>Base inicial</span>
          <span>{formatCOP(data.shift.openingCash)}</span>
        </div>
        <div className="flex justify-between">
          <span>Cobros ({data.totals.paymentsCount})</span>
          <span>{formatCOP(data.totals.totalSales)}</span>
        </div>
        {Object.entries(data.totals.byMethod).map(([code, m]) => (
          <div key={code} className="flex justify-between pl-2 text-xs">
            <span>{m.name} ({m.count})</span>
            <span>{formatCOP(m.total)}</span>
          </div>
        ))}
        <div className="flex justify-between">
          <span>Entradas caja</span>
          <span>{formatCOP(data.totals.movementsIn)}</span>
        </div>
        <div className="flex justify-between">
          <span>Salidas caja</span>
          <span>-{formatCOP(data.totals.movementsOut)}</span>
        </div>
      </div>
      <hr className="my-2 border-dashed border-black" />
      <div className="space-y-0.5 font-bold">
        <div className="flex justify-between">
          <span>Efectivo esperado</span>
          <span>{formatCOP(data.totals.expectedCash)}</span>
        </div>
        <div className="flex justify-between">
          <span>Efectivo contado</span>
          <span>{formatCOP(data.shift.countedCash)}</span>
        </div>
        <div className="flex justify-between">
          <span>Diferencia</span>
          <span>{formatCOP(data.shift.difference)}</span>
        </div>
      </div>
      {data.shift.closingNotes && (
        <>
          <hr className="my-2 border-dashed border-black" />
          <p className="text-xs">Obs: {data.shift.closingNotes}</p>
        </>
      )}
      <hr className="my-2 border-dashed border-black" />
      <p className="mt-4 text-center text-xs">Firma: ______________________</p>
      <button
        onClick={() => window.print()}
        className="no-print mt-4 w-full rounded-lg bg-brand-600 px-4 py-2 font-sans text-white"
      >
        Imprimir de nuevo
      </button>
    </div>
  );
}
