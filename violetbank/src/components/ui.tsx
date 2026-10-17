import clsx from 'clsx';
import { AlertTriangle, CheckCircle2, ChevronRight, Info, Loader2, X, XCircle, type LucideIcon } from 'lucide-react';
import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft' | 'dark';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-white shadow-glow hover:bg-brand-deep active:scale-[.98]',
  secondary: 'bg-surface text-ink border border-line hover:bg-raised active:scale-[.98]',
  ghost: 'text-ink hover:bg-raised',
  danger: 'bg-danger text-white hover:brightness-95 active:scale-[.98]',
  soft: 'bg-brand-soft text-brand-ink hover:brightness-[.97] active:scale-[.98]',
  dark: 'bg-ink text-bg hover:opacity-90 active:scale-[.98]',
};
const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm rounded-xl gap-1.5',
  md: 'h-11 px-5 text-[15px] rounded-2xl gap-2',
  lg: 'h-14 px-6 text-base rounded-2xl gap-2.5',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: LucideIcon;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon: IconCmp, block, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={clsx(
        'inline-flex select-none items-center justify-center whitespace-nowrap font-semibold transition duration-150 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none',
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="animate-spin" size={18} aria-hidden /> : IconCmp ? <IconCmp size={size === 'sm' ? 16 : 18} aria-hidden /> : null}
      {children}
    </button>
  );
});

export function IconButton({ icon: IconCmp, label, className, ...rest }: { icon: LucideIcon; label: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={clsx('inline-flex h-10 w-10 items-center justify-center rounded-2xl text-ink transition hover:bg-raised disabled:opacity-40', className)}
      {...rest}
    >
      <IconCmp size={19} aria-hidden />
    </button>
  );
}

export function Card({ className, children, as: As = 'div', ...rest }: { className?: string; children: ReactNode; as?: 'div' | 'section' | 'article' } & Record<string, unknown>) {
  return (
    <As className={clsx('card', className)} {...rest}>
      {children}
    </As>
  );
}

export function SectionTitle({ title, action, subtitle }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-lg font-bold tracking-tight">{title}</h2>
        {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function SeeAll({ to, children = 'Tout voir' }: { to: string; children?: ReactNode }) {
  return (
    <Link to={to} className="inline-flex shrink-0 items-center gap-0.5 rounded-lg text-sm font-semibold text-brand-ink hover:underline">
      {children}
      <ChevronRight size={16} aria-hidden />
    </Link>
  );
}

export function PageHeader({ title, subtitle, actions, icon: IconCmp }: { title: string; subtitle?: ReactNode; actions?: ReactNode; icon?: LucideIcon }) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        {IconCmp && (
          <span className="mt-0.5 hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand-ink sm:inline-flex">
            <IconCmp size={22} aria-hidden />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
          {subtitle && <div className="mt-1 text-sm text-muted sm:text-[15px]">{subtitle}</div>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

type Tone = 'brand' | 'ok' | 'danger' | 'warn' | 'info' | 'neutral';
const TONES: Record<Tone, string> = {
  brand: 'bg-brand-soft text-brand-ink',
  ok: 'bg-ok/15 text-ok',
  danger: 'bg-danger/15 text-danger',
  warn: 'bg-warn/20 text-[rgb(170,105,20)] dark:text-warn',
  info: 'bg-info/15 text-info',
  neutral: 'bg-raised text-muted',
};
export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={clsx('chip', TONES[tone], className)}>{children}</span>;
}

export function Field({ label, error, hint, children, htmlFor }: { label: ReactNode; error?: string | null; hint?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="mt-1.5 flex items-center gap-1 text-sm font-medium text-danger">
          <AlertTriangle size={14} aria-hidden /> {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(function TextInput(
  { className, invalid, ...rest },
  ref,
) {
  return <input ref={ref} className={clsx('input', invalid && 'border-danger focus:border-danger focus:ring-danger/15', className)} aria-invalid={invalid || undefined} {...rest} />;
});

export function TextArea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={clsx('input min-h-[88px] resize-y', className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={clsx('input appearance-none bg-[length:16px] bg-[right_14px_center] bg-no-repeat pr-10', className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2392929D' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }} {...rest}>
      {children}
    </select>
  );
}

export function Switch({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: ReactNode; disabled?: boolean }) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <label htmlFor={id} className="block cursor-pointer font-medium">
          {label}
        </label>
        {description && <p className="text-sm text-muted">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={clsx('relative h-7 w-12 shrink-0 rounded-full transition', checked ? 'bg-brand' : 'bg-line', disabled && 'opacity-50')}
      >
        <span className={clsx('absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all', checked ? 'left-6' : 'left-1')} />
      </button>
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options, label, size = 'md', block }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; label: string; size?: 'sm' | 'md'; block?: boolean }) {
  return (
    <div role="radiogroup" aria-label={label} className={clsx('max-w-full overflow-x-auto rounded-2xl bg-raised p-1 scrollbar-none', block ? 'flex w-full' : 'inline-flex')}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            'whitespace-nowrap rounded-xl font-semibold transition',
            block && 'flex-1',
            size === 'sm' ? 'px-3 py-1.5 text-xs' : block ? 'px-2 py-2 text-sm sm:px-4' : 'px-4 py-2 text-sm',
            value === o.value ? 'bg-surface text-ink shadow-soft' : 'text-muted hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Progress({ value, color, className, label }: { value: number; color?: string; className?: string; label?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={clsx('h-2.5 w-full overflow-hidden rounded-full bg-raised', className)} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="h-full origin-left animate-grow rounded-full transition-[width] duration-700" style={{ width: `${pct}%`, background: color ?? 'rgb(var(--brand))' }} />
    </div>
  );
}

export function EmptyState({ icon: IconCmp, title, children, action }: { icon: LucideIcon; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="relative mb-5">
        <div className="absolute inset-0 rounded-[28px] bg-brand/20 blur-xl" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-[22px] bg-gradient-to-br from-[#B9A7FF] via-brand to-brand-deep text-white shadow-glow">
          <IconCmp size={28} aria-hidden />
        </div>
      </div>
      <h3 className="text-lg font-bold">{title}</h3>
      {children && <div className="mt-1 max-w-sm text-sm text-muted">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

const CALLOUT: Record<'info' | 'warn' | 'danger' | 'ok' | 'brand', { cls: string; icon: LucideIcon }> = {
  info: { cls: 'border-info/30 bg-info/10', icon: Info },
  warn: { cls: 'border-warn/40 bg-warn/10', icon: AlertTriangle },
  danger: { cls: 'border-danger/30 bg-danger/10', icon: XCircle },
  ok: { cls: 'border-ok/30 bg-ok/10', icon: CheckCircle2 },
  brand: { cls: 'border-brand/25 bg-brand-soft/60', icon: Info },
};
export function Callout({ tone = 'info', title, children, className }: { tone?: keyof typeof CALLOUT; title?: ReactNode; children?: ReactNode; className?: string }) {
  const { cls, icon: IconCmp } = CALLOUT[tone];
  return (
    <div className={clsx('flex gap-3 rounded-2xl border p-4 text-sm', cls, className)} role={tone === 'danger' ? 'alert' : undefined}>
      <IconCmp size={18} className="mt-0.5 shrink-0" aria-hidden />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={clsx(title && 'mt-0.5', 'text-ink/80')}>{children}</div>}
      </div>
    </div>
  );
}

/** Fenêtre modale accessible : piège du focus, Échap, retour du focus, verrouillage du défilement. */
export function Modal({ open, onClose, title, children, footer, size = 'md', description }: { open: boolean; onClose: () => void; title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' }) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusFirst = () => {
      const el = panel.current?.querySelector<HTMLElement>('[autofocus], input:not([type=hidden]), select, textarea, button:not([data-close])');
      (el ?? panel.current)?.focus();
    };
    const t = setTimeout(focusFirst, 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
      if (e.key === 'Tab' && panel.current) {
        const items = [...panel.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])')];
        if (!items.length) return;
        const first = items[0] as HTMLElement;
        const last = items[items.length - 1] as HTMLElement;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      previous?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  const widths = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' };
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 animate-fade bg-[#101014]/55 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={clsx('relative flex max-h-[92dvh] w-full animate-sheet flex-col rounded-t-[28px] bg-surface shadow-lift sm:animate-pop sm:rounded-[28px]', widths[size])}
      >
        <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-5">
          <div className="min-w-0">
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line sm:hidden" aria-hidden />
            <h2 id={titleId} className="text-xl font-bold tracking-tight">
              {title}
            </h2>
            {description && <div className="mt-1 text-sm text-muted">{description}</div>}
          </div>
          <IconButton icon={X} label="Fermer" onClick={onClose} data-close className="-mr-2 shrink-0" />
        </div>
        <div className="overflow-y-auto px-6 pb-6 pt-2">{children}</div>
        {footer && <div className="flex flex-col-reverse gap-2 border-t border-line px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel = 'Confirmer',
  tone = 'primary',
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  tone?: 'primary' | 'danger';
  loading?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Annuler
          </Button>
          <Button variant={tone} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-[15px] text-ink/80">{children}</div>
    </Modal>
  );
}

export function KeyValue({ label, value, strong, tone }: { label: ReactNode; value: ReactNode; strong?: boolean; tone?: 'ok' | 'danger' | 'muted' }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className={clsx('num text-right', strong ? 'text-base font-bold' : 'text-sm font-semibold', tone === 'ok' && 'text-ok', tone === 'danger' && 'text-danger', tone === 'muted' && 'text-muted')}>{value}</dd>
    </div>
  );
}

export function StatTile({ label, value, icon: IconCmp, hint, tone = 'brand', to }: { label: string; value: ReactNode; icon: LucideIcon; hint?: ReactNode; tone?: Tone; to?: string }) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-muted">{label}</span>
        <span className={clsx('flex h-8 w-8 items-center justify-center rounded-xl', TONES[tone])}>
          <IconCmp size={16} aria-hidden />
        </span>
      </div>
      <div className="num mt-2 truncate text-xl font-bold tracking-tight">{value}</div>
      {hint && <div className="mt-0.5 truncate text-xs text-muted">{hint}</div>}
    </>
  );
  const cls = 'card block p-4 transition hover:-translate-y-0.5 hover:shadow-lift';
  return to ? (
    <Link to={to} className={cls}>
      {body}
    </Link>
  ) : (
    <div className="card p-4">{body}</div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('skeleton', className)} aria-hidden />;
}

export function Avatar({ emoji, color, size = 40, label }: { emoji: string; color: string; size?: number; label?: string }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full"
      style={{ width: size, height: size, background: `${color}26`, fontSize: size * 0.48 }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {emoji}
    </span>
  );
}

export function SuccessCheck({ size = 72 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" aria-hidden>
      <circle cx="36" cy="36" r="34" fill="rgb(var(--ok) / .15)" />
      <circle cx="36" cy="36" r="26" fill="rgb(var(--ok))" />
      <path d="m24 37 8 8 16-17" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="48" className="animate-check" />
    </svg>
  );
}
