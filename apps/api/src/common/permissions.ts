/**
 * Catálogo de permisos — fuente de verdad del backend.
 * Mantener sincronizado con packages/shared/src/permissions.ts (mismo contenido).
 */
export const PERMISSIONS = {
  SESSIONS_CREATE: 'sessions.create',
  SESSIONS_VIEW: 'sessions.view',
  SESSIONS_CHECKOUT: 'sessions.checkout',
  SESSIONS_CANCEL: 'sessions.cancel',
  SESSIONS_LOST_TICKET: 'sessions.lost_ticket',
  SESSIONS_FIX_PLATE: 'sessions.fix_plate',

  PAYMENTS_CONFIRM: 'payments.confirm',
  PAYMENTS_VOID: 'payments.void',
  PAYMENTS_DISCOUNT: 'payments.discount',

  SHIFTS_OPEN: 'shifts.open',
  SHIFTS_CLOSE: 'shifts.close',
  SHIFTS_VIEW_ALL: 'shifts.view_all',
  CASH_MOVEMENTS: 'cash.movements',

  TICKETS_REPRINT: 'tickets.reprint',

  TARIFFS_VIEW: 'tariffs.view',
  TARIFFS_MANAGE: 'tariffs.manage',

  USERS_MANAGE: 'users.manage',
  ROLES_MANAGE: 'roles.manage',

  CUSTOMERS_MANAGE: 'customers.manage',
  AGREEMENTS_MANAGE: 'agreements.manage',
  SUBSCRIPTIONS_MANAGE: 'subscriptions.manage',

  REPORTS_VIEW: 'reports.view',
  REPORTS_EXPORT: 'reports.export',
  AUDIT_VIEW: 'audit.view',

  SETTINGS_MANAGE: 'settings.manage',
  INCIDENTS_MANAGE: 'incidents.manage',
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
