'use client';

import { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, forwardRef } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Info,
  LoaderCircle,
  TriangleAlert,
  X,
  type LucideIcon,
} from 'lucide-react';

/** Botón grande, táctil, con prevención de doble clic vía disabled + loading. */
export function Button({
  variant = 'primary',
  size = 'lg',
  loading = false,
  className = '',
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'success' | 'danger' | 'warning' | 'ghost';
  size?: 'lg' | 'md' | 'sm';
  loading?: boolean;
}) {
  const variants: Record<string, string> = {
    primary: 'border border-brand-600 bg-brand-600 text-white shadow-sm hover:bg-brand-700',
    success: 'border border-emerald-700 bg-emerald-700 text-white shadow-sm hover:bg-emerald-800',
    danger: 'border border-red-600 bg-red-600 text-white shadow-sm hover:bg-red-700',
    warning: 'border border-amber-500 bg-amber-500 text-slate-950 shadow-sm hover:bg-amber-400',
    ghost: 'border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50',
  };
  const sizes: Record<string, string> = {
    lg: 'min-h-[52px] px-5 py-3 text-base',
    md: 'min-h-[42px] px-4 py-2 text-sm',
    sm: 'min-h-[34px] px-3 py-1.5 text-sm',
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold tracking-[-0.01em] transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }>(
  function Input({ label, error, className = '', id, ...props }, ref) {
    const inputId = id ?? props.name;
    return (
      <div className="flex flex-col gap-2">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-slate-700">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`min-h-[48px] rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-brand-400 focus:ring-4 focus:ring-brand-100/70 ${error ? 'border-red-400' : ''} ${className}`}
          {...props}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  },
);

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-200/90 bg-white p-6 shadow-soft ${className}`}>
      {children}
    </div>
  );
}

export function Badge({
  color = 'gray',
  children,
}: {
  color?: 'green' | 'yellow' | 'red' | 'blue' | 'gray';
  children: ReactNode;
}) {
  const colors: Record<string, string> = {
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    yellow: 'border-amber-200 bg-amber-50 text-amber-700',
    red: 'border-red-200 bg-red-50 text-red-700',
    blue: 'border-brand-200 bg-brand-50 text-brand-700',
    gray: 'border-slate-200 bg-slate-50 text-slate-600',
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${colors[color]}`}>
      {children}
    </span>
  );
}

export function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="w-full max-w-lg rounded-3xl border border-white/60 bg-white p-6 shadow-lift"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-slate-950">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Alerta grande con icono — estados operativos claros sin depender solo del color. */
export function Alert({
  kind,
  children,
}: {
  kind: 'success' | 'warning' | 'error' | 'info';
  children: ReactNode;
}) {
  const styles: Record<string, { box: string; icon: LucideIcon }> = {
    success: { box: 'border-emerald-200 bg-emerald-50 text-emerald-900', icon: CheckCircle2 },
    warning: { box: 'border-amber-200 bg-amber-50 text-amber-900', icon: TriangleAlert },
    error: { box: 'border-red-200 bg-red-50 text-red-900', icon: AlertCircle },
    info: { box: 'border-brand-200 bg-brand-50 text-brand-900', icon: Info },
  };
  const s = styles[kind];
  const Icon = s.icon;
  return (
    <div className={`flex items-start gap-3 rounded-2xl border p-4 text-sm ${s.box}`} role="alert">
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function Spinner() {
  return (
    <div className="flex justify-center p-8" role="status" aria-label="Cargando">
      <LoaderCircle className="h-7 w-7 animate-spin text-brand-600" />
    </div>
  );
}

export function PageTitle({ children, subtitle }: { children: ReactNode; subtitle?: string }) {
  return (
    <div className="mb-7">
      <h1 className="text-2xl font-semibold tracking-[-0.035em] text-slate-950 md:text-3xl">{children}</h1>
      {subtitle && <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{subtitle}</p>}
    </div>
  );
}
