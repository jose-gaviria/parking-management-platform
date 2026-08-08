import { createHmac } from 'crypto';

/**
 * Código de ticket: PK-YYYYMMDD-NNNNNN-CCCC
 * - Identificador opaco: no contiene precio, tarifa ni datos sensibles.
 * - CCCC = checksum HMAC corto → un código inventado o alterado no valida.
 */

const SECRET = () => {
  const secret = process.env.TICKET_SIGNING_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'test') return 'test-only-signing-key';
  throw new Error('TICKET_SIGNING_SECRET es obligatoria');
};
const PREFIX = () => process.env.TICKET_PREFIX ?? 'PK';

export function checksumFor(base: string): string {
  return createHmac('sha256', SECRET()).update(base).digest('hex').slice(0, 4).toUpperCase();
}

export function buildTicketCode(date: Date, sequence: number): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const base = `${PREFIX()}-${y}${m}${d}-${String(sequence).padStart(6, '0')}`;
  return `${base}-${checksumFor(base)}`;
}

/**
 * Verifica formato y checksum. Devuelve el código normalizado o null si es inválido.
 * Acepta también el código sin checksum (digitación manual del número corto).
 */
export function normalizeTicketCode(raw: string): { code: string; verified: boolean } | null {
  const clean = raw.trim().toUpperCase();
  const full = /^([A-Z]{1,4}-\d{8}-\d{6})-([0-9A-F]{4})$/.exec(clean);
  if (full) {
    const [, base, cs] = full;
    if (checksumFor(base) !== cs) return null;
    return { code: clean, verified: true };
  }
  const short = /^([A-Z]{1,4}-\d{8}-\d{6})$/.exec(clean);
  if (short) {
    const base = short[1];
    return { code: `${base}-${checksumFor(base)}`, verified: false };
  }
  return null;
}
