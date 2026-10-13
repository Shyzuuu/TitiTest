import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

export function PageHeader({ title, subtitle, back, actions }: { title: ReactNode; subtitle?: ReactNode; back?: string; actions?: ReactNode }) {
  const navigate = useNavigate();
  return (
    <header className="flex min-h-[60px] shrink-0 items-center gap-2 border-b border-line bg-panel px-3 sm:px-5">
      {back && (
        <button className="icon-btn -ml-1" aria-label="Retour" onClick={() => navigate(back)}>
          <ArrowLeft size={20} />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold">{title}</h1>
        {subtitle && <div className="truncate text-xs text-muted">{subtitle}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </header>
  );
}
