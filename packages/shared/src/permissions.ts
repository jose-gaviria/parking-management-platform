/**
 * Catálogo de permisos por acción. El backend valida SIEMPRE contra estos códigos;
 * el frontend los usa solo para mostrar/ocultar acciones.
 */
export const PERMISSIONS = {
  // Estancias
  SESSIONS_CREATE: 'sessions.create',
  SESSIONS_VIEW: 'sessions.view',
  SESSIONS_CHECKOUT: 'sessions.checkout',
  SESSIONS_CANCEL: 'sessions.cancel',
  SESSIONS_LOST_TICKET: 'sessions.lost_ticket',
  SESSIONS_FIX_PLATE: 'sessions.fix_plate',

  // Pagos
  PAYMENTS_CONFIRM: 'payments.confirm',
  PAYMENTS_VOID: 'payments.void',
  PAYMENTS_DISCOUNT: 'payments.discount',

  // Caja y turnos
  SHIFTS_OPEN: 'shifts.open',
  SHIFTS_CLOSE: 'shifts.close',
  SHIFTS_VIEW_ALL: 'shifts.view_all',
  CASH_MOVEMENTS: 'cash.movements',

  // Tickets
  TICKETS_REPRINT: 'tickets.reprint',

  // Tarifas
  TARIFFS_VIEW: 'tariffs.view',
  TARIFFS_MANAGE: 'tariffs.manage',

  // Usuarios y roles
  USERS_MANAGE: 'users.manage',
  ROLES_MANAGE: 'roles.manage',

  // Clientes / convenios / mensualidades
  CUSTOMERS_MANAGE: 'customers.manage',
  AGREEMENTS_MANAGE: 'agreements.manage',
  SUBSCRIPTIONS_MANAGE: 'subscriptions.manage',

  // Reportes y auditoría
  REPORTS_VIEW: 'reports.view',
  REPORTS_EXPORT: 'reports.export',
  AUDIT_VIEW: 'audit.view',

  // Configuración
  SETTINGS_MANAGE: 'settings.manage',

  // Incidencias
  INCIDENTS_MANAGE: 'incidents.manage',
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ROLE_CODES = {
  OPERATOR: 'OPERATOR',
  SUPERVISOR: 'SUPERVISOR',
  ADMIN: 'ADMIN',
  AUDITOR: 'AUDITOR',
} as const;

export type RoleCode = (typeof ROLE_CODES)[keyof typeof ROLE_CODES];
