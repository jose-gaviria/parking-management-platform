import {
  calculateCharge,
  calendarDaysTouched,
  TariffRules,
  unitPriceAt,
  validateRules,
} from './tariff-engine';

const at = (y: number, mo: number, d: number, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi);

describe('Motor de tarifas', () => {
  describe('cobro por minuto', () => {
    const rules: TariffRules = { mode: 'PER_MINUTE', unitPrice: 100 };

    it('cobra minutos exactos', () => {
      const r = calculateCharge(rules, at(2026, 7, 18, 10, 0), at(2026, 7, 18, 10, 30));
      expect(r.billedMinutes).toBe(30);
      expect(r.total).toBe(3000);
    });

    it('redondea minuto iniciado hacia arriba', () => {
      const entry = at(2026, 7, 18, 10, 0);
      const exit = new Date(entry.getTime() + 30 * 60000 + 1000); // 30 min 1 s
      const r = calculateCharge(rules, entry, exit);
      expect(r.billedMinutes).toBe(31);
    });

    it('rechaza salida anterior a entrada', () => {
      expect(() =>
        calculateCharge(rules, at(2026, 7, 18, 10, 0), at(2026, 7, 18, 9, 0)),
      ).toThrow();
    });
  });

  describe('tiempo de gracia', () => {
    const rules: TariffRules = { mode: 'PER_MINUTE', unitPrice: 100, graceMinutes: 10 };

    it('no cobra dentro de gracia', () => {
      const r = calculateCharge(rules, at(2026, 7, 18, 10, 0), at(2026, 7, 18, 10, 10));
      expect(r.total).toBe(0);
    });

    it('cobra completo pasada la gracia', () => {
      const r = calculateCharge(rules, at(2026, 7, 18, 10, 0), at(2026, 7, 18, 10, 11));
      expect(r.total).toBe(1100); // los 11 minutos, no solo el excedente
    });
  });

  describe('cobro por fracción', () => {
    const rules: TariffRules = { mode: 'PER_FRACTION', unitPrice: 1500, fractionMinutes: 15 };

    it('fracción iniciada se cobra completa', () => {
      const r = calculateCharge(rules, at(2026, 7, 18, 10, 0), at(2026, 7, 18, 10, 16));
      expect(r.total).toBe(3000); // 2 fracciones
    });

    it('una fracción justa', () => {
      const r = calculateCharge(rules, at(2026, 7, 18, 10, 0), at(2026, 7, 18, 10, 15));
      expect(r.total).toBe(1500);
    });
  });

  describe('cobro por hora', () => {
    const rules: TariffRules = { mode: 'PER_HOUR', unitPrice: 4000 };

    it('hora iniciada se cobra completa', () => {
      const r = calculateCharge(rules, at(2026, 7, 18, 8, 0), at(2026, 7, 18, 10, 5));
      expect(r.total).toBe(12000); // 3 horas
    });
  });

  describe('cobro diario y multi-día', () => {
    const rules: TariffRules = { mode: 'PER_DAY', unitPrice: 0, dayPrice: 20000 };

    it('mismo día = 1 día', () => {
      const r = calculateCharge(rules, at(2026, 7, 18, 8, 0), at(2026, 7, 18, 20, 0));
      expect(r.total).toBe(20000);
    });

    it('cruce de medianoche = 2 días', () => {
      const r = calculateCharge(rules, at(2026, 7, 18, 22, 0), at(2026, 7, 19, 2, 0));
      expect(r.total).toBe(40000);
    });

    it('permanencia de varios días', () => {
      const r = calculateCharge(rules, at(2026, 7, 15, 9, 0), at(2026, 7, 18, 9, 0));
      expect(r.total).toBe(80000); // 15,16,17,18 → 4 días
    });
  });

  describe('tope máximo diario', () => {
    const rules: TariffRules = {
      mode: 'PER_HOUR',
      unitPrice: 4000,
      dailyMax: 20000,
    };

    it('aplica tope en estancia larga de un día', () => {
      const r = calculateCharge(rules, at(2026, 7, 18, 6, 0), at(2026, 7, 18, 20, 0));
      // 14 horas × 4000 = 56000 → tope 20000
      expect(r.total).toBe(20000);
    });

    it('tope escala con días tocados', () => {
      const r = calculateCharge(rules, at(2026, 7, 18, 6, 0), at(2026, 7, 19, 20, 0));
      expect(r.total).toBe(40000); // 2 días × tope
    });
  });

  describe('franja nocturna', () => {
    const rules: TariffRules = {
      mode: 'PER_HOUR',
      unitPrice: 4000,
      timeBands: [{ from: '21:00', to: '06:00', unitPrice: 2000 }],
    };

    it('usa precio nocturno dentro de la franja', () => {
      expect(unitPriceAt(rules, at(2026, 7, 18, 23, 0))).toBe(2000);
      expect(unitPriceAt(rules, at(2026, 7, 18, 3, 0))).toBe(2000);
      expect(unitPriceAt(rules, at(2026, 7, 18, 12, 0))).toBe(4000);
    });

    it('cobra mixto cruzando la franja', () => {
      // 20:00 → 23:00 = horas que inician 20 (diurna), 21, 22 (nocturnas)
      const r = calculateCharge(rules, at(2026, 7, 18, 20, 0), at(2026, 7, 18, 23, 0));
      expect(r.total).toBe(4000 + 2000 + 2000);
    });
  });

  describe('ticket perdido', () => {
    const rules: TariffRules = { mode: 'PER_HOUR', unitPrice: 4000, lostTicketFee: 15000 };

    it('agrega recargo configurado', () => {
      const r = calculateCharge(rules, at(2026, 7, 18, 10, 0), at(2026, 7, 18, 11, 0), {
        lostTicket: true,
      });
      expect(r.total).toBe(19000);
    });
  });

  describe('descuentos', () => {
    const rules: TariffRules = { mode: 'PER_HOUR', unitPrice: 10000 };

    it('descuento porcentual', () => {
      const r = calculateCharge(rules, at(2026, 7, 18, 10, 0), at(2026, 7, 18, 11, 0), {
        discountPct: 20,
      });
      expect(r.discount).toBe(2000);
      expect(r.total).toBe(8000);
    });

    it('descuento nunca deja total negativo', () => {
      const r = calculateCharge(rules, at(2026, 7, 18, 10, 0), at(2026, 7, 18, 11, 0), {
        flatDiscount: 999999,
      });
      expect(r.total).toBe(0);
    });
  });

  describe('mensualidad y cortesía', () => {
    const rules: TariffRules = { mode: 'PER_HOUR', unitPrice: 4000, lostTicketFee: 15000 };

    it('mensualidad activa → total 0', () => {
      const r = calculateCharge(rules, at(2026, 7, 10, 8, 0), at(2026, 7, 18, 18, 0), {
        subscriptionActive: true,
      });
      expect(r.total).toBe(0);
    });

    it('cortesía → total 0', () => {
      const r = calculateCharge(rules, at(2026, 7, 18, 8, 0), at(2026, 7, 18, 18, 0), {
        courtesy: true,
      });
      expect(r.total).toBe(0);
    });
  });

  describe('impuestos', () => {
    const rules: TariffRules = { mode: 'PER_HOUR', unitPrice: 10000, taxPct: 19 };

    it('agrega IVA sobre base con descuento', () => {
      const r = calculateCharge(rules, at(2026, 7, 18, 10, 0), at(2026, 7, 18, 11, 0), {
        discountPct: 10,
      });
      expect(r.subtotal).toBe(10000);
      expect(r.discount).toBe(1000);
      expect(r.tax).toBe(1710);
      expect(r.total).toBe(10710);
    });
  });

  describe('precio por día de semana', () => {
    const rules: TariffRules = {
      mode: 'PER_HOUR',
      unitPrice: 4000,
      weekdayOverrides: [{ days: [0, 6], unitPrice: 6000 }], // fin de semana
    };

    it('sábado usa precio de fin de semana', () => {
      // 2026-07-18 es sábado
      const r = calculateCharge(rules, at(2026, 7, 18, 10, 0), at(2026, 7, 18, 12, 0));
      expect(r.total).toBe(12000);
    });

    it('viernes usa precio normal', () => {
      const r = calculateCharge(rules, at(2026, 7, 17, 10, 0), at(2026, 7, 17, 12, 0));
      expect(r.total).toBe(8000);
    });
  });

  describe('días calendario', () => {
    it('cuenta días tocados correctamente', () => {
      expect(calendarDaysTouched(at(2026, 7, 18, 23, 59), at(2026, 7, 19, 0, 1))).toBe(2);
      expect(calendarDaysTouched(at(2026, 7, 18, 0, 0), at(2026, 7, 18, 23, 59))).toBe(1);
    });
  });

  describe('validación de reglas', () => {
    it('acepta reglas correctas', () => {
      expect(validateRules({ mode: 'PER_HOUR', unitPrice: 4000 })).toEqual([]);
    });

    it('rechaza fracción sin minutos', () => {
      expect(validateRules({ mode: 'PER_FRACTION', unitPrice: 100 }).length).toBeGreaterThan(0);
    });

    it('rechaza precios negativos', () => {
      expect(validateRules({ mode: 'PER_HOUR', unitPrice: -5 }).length).toBeGreaterThan(0);
    });
  });
});
