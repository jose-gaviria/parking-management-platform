import { buildTicketCode, checksumFor, normalizeTicketCode } from './ticket-code';

describe('código de ticket', () => {
  const date = new Date(2026, 7, 14, 10, 30); // 2026-08-14 local

  it('construye el código con fecha, consecutivo y checksum', () => {
    const code = buildTicketCode(date, 42);
    expect(code).toMatch(/^PK-20260814-000042-[0-9A-F]{4}$/);
  });

  it('acepta un código íntegro y lo marca verificado', () => {
    const code = buildTicketCode(date, 7);
    expect(normalizeTicketCode(code)).toEqual({ code, verified: true });
  });

  it('normaliza espacios y minúsculas del lector', () => {
    const code = buildTicketCode(date, 7);
    expect(normalizeTicketCode(`  ${code.toLowerCase()} `)).toEqual({ code, verified: true });
  });

  it('rechaza un código con el checksum alterado', () => {
    const code = buildTicketCode(date, 7);
    const base = code.slice(0, -4);
    const wrong = code.endsWith('0000') ? '1111' : '0000';
    expect(normalizeTicketCode(`${base}${wrong}`)).toBeNull();
  });

  it('rechaza un código con el consecutivo alterado', () => {
    const code = buildTicketCode(date, 7);
    const tampered = code.replace('000007', '000008');
    expect(normalizeTicketCode(tampered)).toBeNull();
  });

  it('rechaza basura del lector', () => {
    expect(normalizeTicketCode('')).toBeNull();
    expect(normalizeTicketCode('ABC123')).toBeNull();
    expect(normalizeTicketCode('PK-2026081-000007-ABCD')).toBeNull();
  });

  it('acepta el código corto digitado a mano, pero NO lo marca verificado', () => {
    // Digitación manual: el operador no puede teclear el checksum, así que se
    // recalcula. Ese camino no prueba autenticidad — solo que el ticket exista.
    const base = 'PK-20260814-000007';
    const result = normalizeTicketCode(base);
    expect(result).toEqual({ code: `${base}-${checksumFor(base)}`, verified: false });
  });
});
