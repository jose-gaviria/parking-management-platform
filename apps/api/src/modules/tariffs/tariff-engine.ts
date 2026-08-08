/**
 * Motor de tarifas — funciones puras, sin acceso a BD.
 * Todo el dinero en COP enteros. Tiempos en hora local del servidor
 * (el servidor de la sede debe tener la zona horaria del parqueadero).
 */

export type TariffMode = 'PER_MINUTE' | 'PER_FRACTION' | 'PER_HOUR' | 'PER_DAY';

export interface TimeBandRate {
  from: string; // "HH:mm"
  to: string; // "HH:mm" — puede cruzar medianoche
  unitPrice: number;
}

export interface WeekdayOverride {
  days: number[]; // 0=domingo ... 6=sábado
  unitPrice?: number;
  dayPrice?: number;
}

export interface SpecialDateOverride {
  date: string; // "YYYY-MM-DD"
  unitPrice?: number;
  dayPrice?: number;
}

export interface TariffRules {
  mode: TariffMode;
  unitPrice: number;
  fractionMinutes?: number;
  graceMinutes?: number;
  dailyMax?: number;
  dayPrice?: number;
  timeBands?: TimeBandRate[];
  weekdayOverrides?: WeekdayOverride[];
  specialDates?: SpecialDateOverride[];
  lostTicketFee?: number;
  taxPct?: number;
}

export interface CalculationOptions {
  lostTicket?: boolean;
  /** Descuento porcentual autorizado (0-100) */
  discountPct?: number;
  /** Descuento de valor fijo */
  flatDiscount?: number;
  /** Mensualidad activa cubre la estancia completa */
  subscriptionActive?: boolean;
  /** Cortesía total autorizada */
  courtesy?: boolean;
}

export interface CalculationBreakdownItem {
  label: string;
  amount: number;
}

export interface TariffCalculationResult {
  billedMinutes: number;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  breakdown: CalculationBreakdownItem[];
}

const MS_PER_MINUTE = 60_000;

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseHHmm(s: string): number {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
}

/** Precio de unidad vigente en un instante dado, considerando franjas, día de semana y fechas especiales. */
export function unitPriceAt(rules: TariffRules, at: Date): number {
  let price = rules.unitPrice;

  const weekday = at.getDay();
  const override = rules.weekdayOverrides?.find((o) => o.days.includes(weekday));
  if (override?.unitPrice !== undefined) price = override.unitPrice;

  const special = rules.specialDates?.find((s) => s.date === localDateKey(at));
  if (special?.unitPrice !== undefined) price = special.unitPrice;

  if (rules.timeBands?.length) {
    const minutes = at.getHours() * 60 + at.getMinutes();
    for (const band of rules.timeBands) {
      const from = parseHHmm(band.from);
      const to = parseHHmm(band.to);
      const inBand =
        from <= to ? minutes >= from && minutes < to : minutes >= from || minutes < to;
      if (inBand) return band.unitPrice;
    }
  }
  return price;
}

function dayPriceAt(rules: TariffRules, at: Date): number {
  let price = rules.dayPrice ?? rules.unitPrice;
  const weekday = at.getDay();
  const override = rules.weekdayOverrides?.find((o) => o.days.includes(weekday));
  if (override?.dayPrice !== undefined) price = override.dayPrice;
  const special = rules.specialDates?.find((s) => s.date === localDateKey(at));
  if (special?.dayPrice !== undefined) price = special.dayPrice;
  return price;
}

/** Número de días calendario locales que toca la estancia (mínimo 1). */
export function calendarDaysTouched(entryAt: Date, exitAt: Date): number {
  const start = new Date(entryAt.getFullYear(), entryAt.getMonth(), entryAt.getDate());
  const end = new Date(exitAt.getFullYear(), exitAt.getMonth(), exitAt.getDate());
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

function computeBaseCharge(
  rules: TariffRules,
  entryAt: Date,
  exitAt: Date,
  billedMinutes: number,
  breakdown: CalculationBreakdownItem[],
): number {
  switch (rules.mode) {
    case 'PER_MINUTE': {
      if (rules.timeBands?.length || rules.weekdayOverrides?.length || rules.specialDates?.length) {
        // Recorrido minuto a minuto para respetar franjas y overrides
        let sum = 0;
        const cursor = new Date(entryAt.getTime());
        for (let i = 0; i < billedMinutes; i++) {
          sum += unitPriceAt(rules, cursor);
          cursor.setTime(cursor.getTime() + MS_PER_MINUTE);
        }
        breakdown.push({ label: `${billedMinutes} min (franjas aplicadas)`, amount: sum });
        return sum;
      }
      const sum = billedMinutes * rules.unitPrice;
      breakdown.push({ label: `${billedMinutes} min × $${rules.unitPrice}`, amount: sum });
      return sum;
    }
    case 'PER_FRACTION': {
      const fraction = Math.max(1, rules.fractionMinutes ?? 15);
      const fractions = Math.ceil(billedMinutes / fraction);
      let sum = 0;
      const cursor = new Date(entryAt.getTime());
      for (let i = 0; i < fractions; i++) {
        sum += unitPriceAt(rules, cursor);
        cursor.setTime(cursor.getTime() + fraction * MS_PER_MINUTE);
      }
      breakdown.push({
        label: `${fractions} fracción(es) de ${fraction} min`,
        amount: sum,
      });
      return sum;
    }
    case 'PER_HOUR': {
      const hours = Math.ceil(billedMinutes / 60);
      let sum = 0;
      const cursor = new Date(entryAt.getTime());
      for (let i = 0; i < hours; i++) {
        sum += unitPriceAt(rules, cursor);
        cursor.setTime(cursor.getTime() + 60 * MS_PER_MINUTE);
      }
      breakdown.push({ label: `${hours} hora(s)`, amount: sum });
      return sum;
    }
    case 'PER_DAY': {
      const days = calendarDaysTouched(entryAt, exitAt);
      let sum = 0;
      const cursor = new Date(entryAt.getFullYear(), entryAt.getMonth(), entryAt.getDate(), 12);
      for (let i = 0; i < days; i++) {
        sum += dayPriceAt(rules, cursor);
        cursor.setDate(cursor.getDate() + 1);
      }
      breakdown.push({ label: `${days} día(s)`, amount: sum });
      return sum;
    }
  }
}

/**
 * Calcula el cobro de una estancia. Determinista: mismas entradas → mismo resultado.
 */
export function calculateCharge(
  rules: TariffRules,
  entryAt: Date,
  exitAt: Date,
  opts: CalculationOptions = {},
): TariffCalculationResult {
  if (exitAt.getTime() < entryAt.getTime()) {
    throw new Error('La hora de salida no puede ser anterior a la de entrada');
  }

  const breakdown: CalculationBreakdownItem[] = [];
  const rawMinutes = Math.ceil((exitAt.getTime() - entryAt.getTime()) / MS_PER_MINUTE);
  const billedMinutes = Math.max(rawMinutes, 0);

  // Mensualidad o cortesía → total 0, sin recargos
  if (opts.subscriptionActive) {
    return {
      billedMinutes,
      subtotal: 0,
      discount: 0,
      tax: 0,
      total: 0,
      breakdown: [{ label: 'Mensualidad activa', amount: 0 }],
    };
  }
  if (opts.courtesy) {
    return {
      billedMinutes,
      subtotal: 0,
      discount: 0,
      tax: 0,
      total: 0,
      breakdown: [{ label: 'Cortesía autorizada', amount: 0 }],
    };
  }

  // Tiempo de gracia
  const grace = rules.graceMinutes ?? 0;
  let subtotal: number;
  if (billedMinutes <= grace) {
    subtotal = 0;
    breakdown.push({ label: `Dentro del tiempo de gracia (${grace} min)`, amount: 0 });
  } else {
    subtotal = computeBaseCharge(rules, entryAt, exitAt, billedMinutes, breakdown);

    // Tope diario: máximo por día calendario tocado
    if (rules.dailyMax !== undefined && rules.dailyMax > 0) {
      const cap = rules.dailyMax * calendarDaysTouched(entryAt, exitAt);
      if (subtotal > cap) {
        breakdown.push({ label: 'Tope máximo diario aplicado', amount: cap - subtotal });
        subtotal = cap;
      }
    }
  }

  // Recargo por ticket perdido
  if (opts.lostTicket && rules.lostTicketFee) {
    subtotal += rules.lostTicketFee;
    breakdown.push({ label: 'Recargo ticket perdido', amount: rules.lostTicketFee });
  }

  // Descuentos (porcentual primero, luego fijo), nunca por debajo de 0
  let discount = 0;
  if (opts.discountPct && opts.discountPct > 0) {
    discount += Math.round((subtotal * Math.min(opts.discountPct, 100)) / 100);
  }
  if (opts.flatDiscount && opts.flatDiscount > 0) {
    discount += opts.flatDiscount;
  }
  discount = Math.min(discount, subtotal);
  if (discount > 0) breakdown.push({ label: 'Descuento', amount: -discount });

  const taxable = subtotal - discount;
  const taxPct = rules.taxPct ?? 0;
  const tax = taxPct > 0 ? Math.round((taxable * taxPct) / 100) : 0;
  if (tax > 0) breakdown.push({ label: `Impuesto ${taxPct}%`, amount: tax });

  const total = taxable + tax;

  return { billedMinutes, subtotal, discount, tax, total, breakdown };
}

/** Validación básica de reglas al guardar una tarifa. Devuelve lista de problemas. */
export function validateRules(rules: TariffRules): string[] {
  const errors: string[] = [];
  const modes: TariffMode[] = ['PER_MINUTE', 'PER_FRACTION', 'PER_HOUR', 'PER_DAY'];
  if (!modes.includes(rules.mode)) errors.push('Modo de cobro inválido');
  if (!Number.isInteger(rules.unitPrice) || rules.unitPrice < 0)
    errors.push('El precio por unidad debe ser un entero no negativo');
  if (rules.mode === 'PER_FRACTION' && (!rules.fractionMinutes || rules.fractionMinutes < 1))
    errors.push('Las fracciones requieren minutos por fracción');
  if (rules.mode === 'PER_DAY' && (rules.dayPrice === undefined || rules.dayPrice < 0))
    errors.push('El cobro diario requiere precio por día');
  if (rules.graceMinutes !== undefined && rules.graceMinutes < 0)
    errors.push('El tiempo de gracia no puede ser negativo');
  if (rules.taxPct !== undefined && (rules.taxPct < 0 || rules.taxPct > 100))
    errors.push('El impuesto debe estar entre 0 y 100');
  for (const band of rules.timeBands ?? []) {
    if (!/^\d{2}:\d{2}$/.test(band.from) || !/^\d{2}:\d{2}$/.test(band.to))
      errors.push('Las franjas horarias deben usar formato HH:mm');
  }
  return errors;
}
