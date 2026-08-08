'use client';

import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart3,
  CalendarClock,
  CarFront,
  ChevronRight,
  CircleParking,
  ClipboardList,
  Contact,
  Gauge,
  LayoutDashboard,
  LogOut,
  LucideIcon,
  ReceiptText,
  ScanLine,
  Settings,
  SquareParking,
  Tags,
  Users,
  WalletCards,
} from 'lucide-react';
import { clearSession, getToken, getUser, hasPermission, StoredUser } from '@/lib/api';

interface NavigationLink {
  href: string;
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
  permission?: string;
}

const OPERATOR_LINKS: NavigationLink[] = [
  { href: '/panel', label: 'Panel principal', shortLabel: 'Panel', icon: LayoutDashboard },
  { href: '/entrada', label: 'Registrar entrada', shortLabel: 'Entrada', icon: CarFront },
  { href: '/cobrar', label: 'Cobrar salida', shortLabel: 'Cobrar', icon: ScanLine },
  { href: '/dentro', label: 'Vehículos dentro', shortLabel: 'Dentro', icon: CircleParking },
  { href: '/turno', label: 'Caja y turno', shortLabel: 'Turno', icon: WalletCards },
];

const ADMIN_LINKS: NavigationLink[] = [
  { href: '/admin', label: 'Resumen', icon: Gauge, permission: 'reports.view' },
  { href: '/admin/tarifas', label: 'Tarifas', icon: Tags, permission: 'tariffs.manage' },
  { href: '/admin/usuarios', label: 'Usuarios', icon: Users, permission: 'users.manage' },
  { href: '/admin/clientes', label: 'Clientes', icon: Contact, permission: 'customers.manage' },
  {
    href: '/admin/mensualidades',
    label: 'Mensualidades',
    icon: CalendarClock,
    permission: 'subscriptions.manage',
  },
  { href: '/admin/turnos', label: 'Turnos', icon: ClipboardList, permission: 'shifts.view_all' },
  { href: '/admin/reportes', label: 'Reportes', icon: BarChart3, permission: 'reports.view' },
  { href: '/admin/facturas', label: 'Facturas', icon: ReceiptText, permission: 'reports.view' },
  { href: '/admin/auditoria', label: 'Auditoría', icon: Settings, permission: 'audit.view' },
];

function isActive(pathname: string, href: string) {
  if (href === '/panel' || href === '/admin') return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavItem({ link, active }: { link: NavigationLink; active: boolean }) {
  const Icon = link.icon;
  return (
    <Link
      href={link.href}
      aria-current={active ? 'page' : undefined}
      className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
        active
          ? 'bg-brand-50 text-brand-700'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
      }`}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={active ? 2.25 : 1.8} />
      <span className="flex-1 truncate">{link.label}</span>
      {active && <ChevronRight className="h-4 w-4 text-brand-400" />}
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    setUser(getUser());
    setReady(true);
  }, [router]);

  if (!ready) return null;

  const adminLinks = ADMIN_LINKS.filter((link) => hasPermission(link.permission!));
  const isAdminArea = pathname.startsWith('/admin');
  const firstName = user?.fullName?.split(' ')[0] ?? 'Usuario';

  function logout() {
    clearSession();
    router.replace('/login');
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <aside className="no-print fixed inset-y-0 left-0 z-40 hidden w-[272px] border-r border-slate-200/80 bg-white lg:flex lg:flex-col">
        <div className="flex h-20 items-center border-b border-slate-100 px-6">
          <Link href="/panel" className="flex items-center gap-3" aria-label="Ir al panel">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-white shadow-sm">
              <SquareParking className="h-6 w-6" strokeWidth={1.8} />
            </span>
            <span>
              <span className="block text-sm font-semibold tracking-tight text-slate-950">Parqueadero</span>
              <span className="block text-xs text-slate-400">Gestión operativa</span>
            </span>
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5">
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Operación
          </p>
          <nav className="space-y-1" aria-label="Navegación operativa">
            {OPERATOR_LINKS.map((link) => (
              <NavItem key={link.href} link={link} active={isActive(pathname, link.href)} />
            ))}
          </nav>

          {adminLinks.length > 0 && (
            <>
              <div className="my-5 border-t border-slate-100" />
              <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Administración
              </p>
              <nav className="space-y-1" aria-label="Navegación administrativa">
                {adminLinks.map((link) => (
                  <NavItem key={link.href} link={link} active={isActive(pathname, link.href)} />
                ))}
              </nav>
            </>
          )}
        </div>

        <div className="border-t border-slate-100 p-4">
          <div className="mb-2 flex items-center gap-3 rounded-xl px-3 py-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">
              {firstName.slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-slate-800">{user?.fullName}</span>
              <span className="block truncate text-xs text-slate-400">Sesión activa</span>
            </span>
          </div>
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-700"
          >
            <LogOut className="h-[18px] w-[18px]" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <header className="no-print sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur lg:hidden">
        <div className="flex h-16 items-center justify-between px-4">
          <Link href="/panel" className="flex items-center gap-2.5 font-semibold text-slate-950">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-white">
              <SquareParking className="h-5 w-5" />
            </span>
            Parqueadero
          </Link>
          <div className="flex items-center gap-1">
            {adminLinks.length > 0 && (
              <Link
                href="/admin"
                aria-label="Administración"
                className={`rounded-xl p-2.5 ${
                  isAdminArea ? 'bg-brand-50 text-brand-700' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                <Settings className="h-5 w-5" />
              </Link>
            )}
            <button
              type="button"
              onClick={logout}
              aria-label="Cerrar sesión"
              className="rounded-xl p-2.5 text-slate-500 hover:bg-slate-100"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
        {isAdminArea && adminLinks.length > 0 && (
          <nav className="flex gap-1 overflow-x-auto border-t border-slate-100 px-3 py-2" aria-label="Administración">
            {adminLinks.map((link) => {
              const Icon = link.icon;
              const active = isActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${
                    active ? 'bg-brand-50 text-brand-700' : 'text-slate-500'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {link.label}
                </Link>
              );
            })}
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-[1480px] px-4 py-6 pb-28 sm:px-6 lg:ml-[272px] lg:px-8 lg:py-8 lg:pb-10">
        {children}
      </main>

      <nav className="no-print fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-slate-200 bg-white/95 px-1 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur lg:hidden" aria-label="Navegación móvil">
        {OPERATOR_LINKS.map((link) => {
          const Icon = link.icon;
          const active = isActive(pathname, link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? 'page' : undefined}
              className={`flex min-w-0 flex-col items-center gap-1 rounded-lg px-1 py-2 text-[10px] font-medium ${
                active ? 'text-brand-700' : 'text-slate-400'
              }`}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.3 : 1.8} />
              <span className="max-w-full truncate">{link.shortLabel}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
