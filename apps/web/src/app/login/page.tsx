'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, CarFront, ShieldCheck, SquareParking } from 'lucide-react';
import { api, ApiError, setSession } from '@/lib/api';
import { Alert, Button, Input } from '@/components/ui';

interface LoginResponse {
  token: string;
  user: { id: string; fullName: string; roles: string[]; permissions: string[] };
  openShift: { id: string } | null;
}

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [demo, setDemo] = useState<{ username: string; password: string } | null>(null);

  // En el demo la API publica un acceso fijo: se muestra y se deja escrito en el formulario.
  useEffect(() => {
    api<{ username: string; password: string }>('/auth/demo')
      .then((access) => {
        setDemo(access);
        setUsername(access.username);
        setPassword(access.password);
      })
      .catch(() => undefined);
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api<LoginResponse>('/auth/login', {
        method: 'POST',
        body: { username, password },
      });
      setSession(res.token, res.user);
      router.replace('/panel');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo iniciar sesión.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-[minmax(420px,0.85fr)_1.15fr]">
      <section className="relative hidden overflow-hidden bg-slate-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 opacity-60" aria-hidden>
          <div className="absolute -right-32 top-1/2 h-[34rem] w-[34rem] -translate-y-1/2 rounded-full border border-white/10" />
          <div className="absolute -right-16 top-1/2 h-[24rem] w-[24rem] -translate-y-1/2 rounded-full border border-white/10" />
          <div className="absolute bottom-20 right-20 h-36 w-24 rotate-12 rounded-3xl border border-brand-400/20 bg-brand-500/5" />
        </div>

        <div className="relative flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-slate-950">
            <SquareParking className="h-7 w-7" strokeWidth={1.8} />
          </span>
          <div>
            <p className="font-semibold tracking-tight">Parqueadero</p>
            <p className="text-xs text-slate-400">Gestión operativa</p>
          </div>
        </div>

        <div className="relative max-w-lg">
          <span className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-brand-300">
            <CarFront className="h-6 w-6" />
          </span>
          <h1 className="text-4xl font-semibold leading-tight tracking-[-0.035em] xl:text-5xl">
            Control claro para cada entrada y salida.
          </h1>
          <p className="mt-5 max-w-md text-base leading-7 text-slate-400">
            Operación de parqueadero, cobros, turnos y reportes en un solo lugar.
          </p>
        </div>

        <div className="relative flex items-center gap-2 text-sm text-slate-400">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          Acceso seguro para personal autorizado
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center bg-[var(--background)] px-5 py-10 sm:px-10">
        <div className="w-full max-w-[430px]">
          <div className="mb-10 lg:hidden">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-950 text-white">
              <SquareParking className="h-7 w-7" />
            </span>
          </div>
          <p className="mb-2 text-sm font-semibold text-brand-700">Bienvenido</p>
          <h2 className="text-3xl font-semibold tracking-[-0.025em] text-slate-950">Inicia sesión</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Ingresa tus credenciales para acceder al sistema.
          </p>

          {demo && (
            <div className="mt-6">
              <Alert kind="info">
                Demo de prueba — usuario <strong>{demo.username}</strong>, contraseña{' '}
                <strong>{demo.password}</strong>.
              </Alert>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
            <Input
              label="Usuario"
              name="username"
              autoComplete="username"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <Input
              label="Contraseña"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {error && <Alert kind="error">{error}</Alert>}
            <Button type="submit" loading={loading} className="mt-1 w-full justify-center">
              Entrar al sistema
              {!loading && <ArrowRight className="h-4 w-4" />}
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-slate-400">
            Sistema privado de gestión · Todos los accesos quedan registrados
          </p>
        </div>
      </section>
    </main>
  );
}
