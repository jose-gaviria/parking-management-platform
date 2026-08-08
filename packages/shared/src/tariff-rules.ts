/**
 * Reglas del motor de tarifas. Se guardan como JSON en `tariff_versions.rules`
 * y se validan/interpretan en el backend. Todos los valores monetarios en COP enteros.
 */

export type TariffMode = 'PER_MINUTE' | 'PER_FRACTION' | 'PER_HOUR' | 'PER_DAY';

export interface TimeBandRate {
  /** "HH:mm" hora local de inicio de la franja (ej. "21:00") */
  from: string;
  /** "HH:mm" hora local de fin (puede cruzar medianoche, ej. "06:00") */
  to: string;
  /** Precio de la unidad dentro de la franja */
  unitPrice: number;
}

export interface WeekdayOverride {
  /** 0=domingo ... 6=sábado */
  days: number[];
  unitPrice?: number;
  dayPrice?: number;
}

export interface SpecialDateOverride {
  /** "YYYY-MM-DD" */
  date: string;
  unitPrice?: number;
  dayPrice?: number;
}

export interface TariffRules {
  mode: TariffMode;
  /** Precio por unidad (minuto, fracción u hora según mode) */
  unitPrice: number;
  /** Minutos por fracción (solo PER_FRACTION); la fracción iniciada se cobra completa */
  fractionMinutes?: number;
  /** Minutos de gracia: por debajo no se cobra */
  graceMinutes?: number;
  /** Tope máximo a cobrar por cada día calendario de permanencia */
  dailyMax?: number;
  /** Precio por día completo (PER_DAY y permanencias multi-día) */
  dayPrice?: number;
  /** Franjas horarias con precio distinto (ej. nocturna) */
  timeBands?: TimeBandRate[];
  /** Precios distintos por día de semana */
  weekdayOverrides?: WeekdayOverride[];
  /** Precios distintos en fechas puntuales */
  specialDates?: SpecialDateOverride[];
  /** Recargo por ticket perdido */
  lostTicketFee?: number;
  /** IVA u otro impuesto en % (0 si no aplica). El total ya lo incluye. */
  taxPct?: number;
}

export interface TariffCalculationResult {
  billedMinutes: number;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  /** Desglose legible de cómo se llegó al valor */
  breakdown: Array<{ label: string; amount: number }>;
}
