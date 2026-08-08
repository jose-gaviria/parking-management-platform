'use client';

/**
 * Cliente HTTP del frontend. Maneja token, errores de negocio y sesión expirada.
 * Los errores llegan con { code, message } — message siempre es apto para el operador.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('parking_token');
}

export function setSession(token: string, user: unknown) {
  localStorage.setItem('parking_token', token);
  localStorage.setItem('parking_user', JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem('parking_token');
  localStorage.removeItem('parking_user');
}

export interface StoredUser {
  id: string;
  username: string;
  fullName: string;
  roles: string[];
  permissions: string[];
}

export function getUser(): StoredUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('parking_user');
  return raw ? (JSON.parse(raw) as StoredUser) : null;
}

export function hasPermission(permission: string): boolean {
  return getUser()?.permissions.includes(permission) ?? false;
}

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401) {
    clearSession();
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
    throw new ApiError('UNAUTHORIZED', 'Tu sesión expiró. Inicia sesión de nuevo.', 401);
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new ApiError(
      data?.code ?? 'ERROR',
      data?.message ?? 'No se pudo completar la operación.',
      res.status,
    );
  }
  return data as T;
}

export function apiUrl(path: string): string {
  return `${API_URL}${path}`;
}
