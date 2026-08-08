export function formatCOP(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

export function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '—';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h < 24) return m > 0 ? `${h} h ${m} min` : `${h} h`;
  const d = Math.floor(h / 24);
  return `${d} día${d > 1 ? 's' : ''} ${h % 24} h`;
}

/** Minutos transcurridos desde una fecha hasta ahora. */
export function minutesSince(value: string | Date): number {
  const d = typeof value === 'string' ? new Date(value) : value;
  return Math.max(0, Math.ceil((Date.now() - d.getTime()) / 60000));
}
