/**
 * Datos semilla — SOLO para desarrollo y demostración.
 * Las credenciales se leen del entorno; nunca deben vivir en el repositorio.
 */
import { Prisma, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHmac } from 'crypto';
import { BCRYPT_COST } from '../src/common/hashing';

const prisma = new PrismaClient();

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno obligatoria ${name}`);
  return value;
}

const PERMISSIONS: Record<string, string> = {
  'sessions.create': 'Registrar entradas',
  'sessions.view': 'Consultar estancias',
  'sessions.checkout': 'Cobrar salidas',
  'sessions.cancel': 'Anular estancias',
  'sessions.lost_ticket': 'Gestionar ticket perdido',
  'sessions.fix_plate': 'Corregir placas',
  'sessions.allow_duplicate': 'Autorizar segundo ingreso de una placa ya activa',
  'payments.confirm': 'Confirmar pagos',
  'payments.void': 'Anular pagos',
  'payments.discount': 'Autorizar descuentos',
  'shifts.open': 'Abrir turno',
  'shifts.close': 'Cerrar turno',
  'shifts.view_all': 'Ver todos los turnos',
  'cash.movements': 'Movimientos de caja',
  'tickets.reprint': 'Reimprimir tickets',
  'tariffs.view': 'Ver tarifas',
  'tariffs.manage': 'Gestionar tarifas',
  'users.manage': 'Gestionar usuarios',
  'roles.manage': 'Gestionar roles',
  'customers.manage': 'Gestionar clientes',
  'agreements.manage': 'Gestionar convenios',
  'subscriptions.manage': 'Gestionar mensualidades',
  'reports.view': 'Ver reportes',
  'reports.export': 'Exportar reportes',
  'audit.view': 'Ver auditoría',
  'settings.manage': 'Configurar el sistema',
  'incidents.manage': 'Gestionar incidencias',
};

const ROLE_PERMS: Record<string, string[]> = {
  OPERATOR: [
    'sessions.create',
    'sessions.view',
    'sessions.checkout',
    'payments.confirm',
    'shifts.open',
    'shifts.close',
    'cash.movements',
    'tickets.reprint',
    'tariffs.view',
  ],
  SUPERVISOR: [
    'sessions.create',
    'sessions.view',
    'sessions.checkout',
    'sessions.cancel',
    'sessions.lost_ticket',
    'sessions.fix_plate',
    'sessions.allow_duplicate',
    'payments.confirm',
    'payments.void',
    'payments.discount',
    'shifts.open',
    'shifts.close',
    'shifts.view_all',
    'cash.movements',
    'tickets.reprint',
    'tariffs.view',
    'reports.view',
    'incidents.manage',
  ],
  ADMIN: Object.keys(PERMISSIONS),
  AUDITOR: ['sessions.view', 'shifts.view_all', 'tariffs.view', 'reports.view', 'reports.export', 'audit.view'],
};

function ticketCode(date: Date, seq: number): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const base = `PK-${y}${m}${d}-${String(seq).padStart(6, '0')}`;
  const secret = requiredEnv('TICKET_SIGNING_SECRET');
  const cs = createHmac('sha256', secret).update(base).digest('hex').slice(0, 4).toUpperCase();
  return `${base}-${cs}`;
}

async function main() {
  console.log('Sembrando datos de demostración…');

  // Permisos y roles
  for (const [code, description] of Object.entries(PERMISSIONS)) {
    await prisma.permission.upsert({
      where: { code },
      create: { code, description },
      update: { description },
    });
  }
  const roleNames: Record<string, string> = {
    OPERATOR: 'Operador',
    SUPERVISOR: 'Supervisor',
    ADMIN: 'Administrador',
    AUDITOR: 'Auditor',
  };
  for (const [code, permCodes] of Object.entries(ROLE_PERMS)) {
    const role = await prisma.role.upsert({
      where: { code },
      create: { code, name: roleNames[code] },
      update: {},
    });
    const perms = await prisma.permission.findMany({ where: { code: { in: permCodes } } });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })),
    });
  }

  // Usuarios demo
  const users: Array<{ username: string; fullName: string; password: string; pin?: string; role: string }> = [
    { username: 'admin', fullName: 'Ana Administradora', password: requiredEnv('SEED_ADMIN_PASSWORD'), pin: requiredEnv('SEED_ADMIN_PIN'), role: 'ADMIN' },
    { username: 'supervisor', fullName: 'Samuel Supervisor', password: requiredEnv('SEED_SUPERVISOR_PASSWORD'), pin: requiredEnv('SEED_SUPERVISOR_PIN'), role: 'SUPERVISOR' },
    { username: 'operador1', fullName: 'Olga Operadora', password: requiredEnv('SEED_OPERATOR_PASSWORD'), role: 'OPERATOR' },
    { username: 'operador2', fullName: 'Óscar Operador', password: requiredEnv('SEED_OPERATOR_PASSWORD'), role: 'OPERATOR' },
    { username: 'auditor', fullName: 'Aída Auditora', password: requiredEnv('SEED_AUDITOR_PASSWORD'), role: 'AUDITOR' },
  ];
  const userIds: Record<string, string> = {};
  for (const u of users) {
    const role = await prisma.role.findUniqueOrThrow({ where: { code: u.role } });
    const user = await prisma.user.upsert({
      where: { username: u.username },
      create: {
        username: u.username,
        fullName: u.fullName,
        passwordHash: await bcrypt.hash(u.password, BCRYPT_COST),
        pinHash: u.pin ? await bcrypt.hash(u.pin, BCRYPT_COST) : undefined,
        roles: { create: { roleId: role.id } },
      },
      update: {},
    });
    userIds[u.username] = user.id;
  }

  // Tipos de vehículo
  const vehicleTypes = [
    { code: 'CAR', name: 'Carro', icon: 'car', sortOrder: 1 },
    { code: 'MOTORCYCLE', name: 'Moto', icon: 'motorcycle', sortOrder: 2 },
    { code: 'HOTEL_MOTORCYCLE', name: 'Moto hotel', icon: 'motorcycle', sortOrder: 3 },
    { code: 'HOTEL_CAR', name: 'Carro hotel', icon: 'car', sortOrder: 4 },
  ];
  const vtIds: Record<string, string> = {};
  for (const vt of vehicleTypes) {
    const created = await prisma.vehicleType.upsert({
      where: { code: vt.code },
      create: vt,
      update: { name: vt.name, icon: vt.icon, sortOrder: vt.sortOrder, active: true },
    });
    vtIds[vt.code] = created.id;
  }

  // Medios de pago
  const methods = [
    { code: 'CASH', name: 'Efectivo', isCash: true },
    { code: 'CARD', name: 'Tarjeta', isCash: false },
    { code: 'TRANSFER', name: 'Transferencia', isCash: false },
    { code: 'AGREEMENT', name: 'Convenio', isCash: false },
    { code: 'SUBSCRIPTION', name: 'Mensualidad', isCash: false },
    { code: 'COURTESY', name: 'Cortesía', isCash: false },
  ];
  for (const m of methods) {
    await prisma.paymentMethod.upsert({ where: { code: m.code }, create: m, update: {} });
  }

  // Tarifas de ejemplo (COP)
  const tariffs: Array<{ name: string; vt: string; rules: Record<string, unknown> }> = [
    {
      name: 'Carro — por hora',
      vt: 'CAR',
      rules: {
        mode: 'PER_HOUR',
        unitPrice: 4000,
        graceMinutes: 10,
        dailyMax: 25000,
        lostTicketFee: 15000,
        taxPct: 0,
        timeBands: [{ from: '21:00', to: '06:00', unitPrice: 2500 }],
      },
    },
    {
      name: 'Moto — por hora',
      vt: 'MOTORCYCLE',
      rules: {
        mode: 'PER_HOUR',
        unitPrice: 2000,
        graceMinutes: 10,
        dailyMax: 12000,
        lostTicketFee: 10000,
        taxPct: 0,
      },
    },
    {
      name: 'Moto hotel — tarifa especial',
      vt: 'HOTEL_MOTORCYCLE',
      rules: {
        mode: 'PER_HOUR',
        unitPrice: 1000,
        graceMinutes: 10,
        dailyMax: 6000,
        lostTicketFee: 10000,
        taxPct: 0,
      },
    },
    {
      name: 'Carro hotel — tarifa especial',
      vt: 'HOTEL_CAR',
      rules: {
        mode: 'PER_HOUR',
        unitPrice: 2000,
        graceMinutes: 10,
        dailyMax: 12500,
        lostTicketFee: 15000,
        taxPct: 0,
        timeBands: [{ from: '21:00', to: '06:00', unitPrice: 1250 }],
      },
    },
  ];
  for (const t of tariffs) {
    const existing = await prisma.tariff.findFirst({ where: { name: t.name } });
    if (!existing) {
      await prisma.tariff.create({
        data: {
          name: t.name,
          vehicleTypeId: vtIds[t.vt],
          versions: { create: { version: 1, rules: t.rules as Prisma.InputJsonValue } },
        },
      });
    }
  }

  // Configuración del establecimiento (datos de demostración)
  const settings: Record<string, unknown> = {
    parkingName: 'Parqueadero Demo',
    address: 'Dirección pendiente de configurar',
    phone: 'Teléfono pendiente',
    ticketFooter: 'Conserve este ticket. Se requiere para retirar el vehículo.',
    currency: 'COP',
    lostTicketRequiresAuth: true,
    subscriptionExpiryAlertDays: 7,
  };
  for (const [key, value] of Object.entries(settings)) {
    await prisma.systemSetting.upsert({
      where: { key },
      create: { key, value: value as never },
      update: {},
    });
  }

  // Clientes, convenio y mensualidad demo
  const customer1 = await prisma.customer.upsert({
    where: { id: 'seed-customer-1' },
    create: {
      id: 'seed-customer-1',
      kind: 'PERSON',
      name: 'Carlos Cliente',
      idNumber: '1000000001',
      phone: '3000000001',
    },
    update: {},
  });
  const customer2 = await prisma.customer.upsert({
    where: { id: 'seed-customer-2' },
    create: {
      id: 'seed-customer-2',
      kind: 'COMPANY',
      name: 'Empresa Convenio SAS',
      idNumber: '900000000-1',
    },
    update: {},
  });
  await prisma.agreement.upsert({
    where: { id: 'seed-agreement-1' },
    create: {
      id: 'seed-agreement-1',
      customerId: customer2.id,
      name: 'Convenio Empresa 20%',
      discountPct: 20,
      startsAt: new Date(Date.now() - 30 * 86400000),
    },
    update: {},
  });
  const now = new Date();
  await prisma.subscription.upsert({
    where: { id: 'seed-subscription-1' },
    create: {
      id: 'seed-subscription-1',
      customerId: customer1.id,
      plate: 'MEN123',
      vehicleTypeId: vtIds.CAR,
      startsAt: new Date(now.getFullYear(), now.getMonth(), 1),
      endsAt: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
      price: 180000,
    },
    update: {},
  });

  // Estancias activas de demostración (para probar cobro inmediatamente)
  const activeSeeds = [
    { plate: 'ABC123', vt: 'CAR', hoursAgo: 2, seq: 900001 },
    { plate: 'XYZ789', vt: 'MOTORCYCLE', hoursAgo: 5, seq: 900002 },
    { plate: 'MEN123', vt: 'CAR', hoursAgo: 1, seq: 900003 }, // tiene mensualidad
  ];
  for (const s of activeSeeds) {
    const code = ticketCode(now, s.seq);
    const exists = await prisma.ticket.findUnique({ where: { code } });
    if (!exists) {
      await prisma.parkingSession.create({
        data: {
          plate: s.plate,
          vehicleTypeId: vtIds[s.vt],
          entryAt: new Date(now.getTime() - s.hoursAgo * 3600000),
          entryOperatorId: userIds.operador1,
          ticket: { create: { code } },
        },
      });
    }
  }

  console.log('Datos semilla listos.');
  console.log('Tickets activos de prueba:');
  for (const s of activeSeeds) {
    console.log(`  ${s.plate}: ${ticketCode(now, s.seq)}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
