export const SESSION_STATUS = {
  ACTIVE: 'ACTIVE',
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  PAID: 'PAID',
  CLOSED: 'CLOSED',
  CANCELLED: 'CANCELLED',
  INCIDENT: 'INCIDENT',
} as const;

export type SessionStatus = (typeof SESSION_STATUS)[keyof typeof SESSION_STATUS];
