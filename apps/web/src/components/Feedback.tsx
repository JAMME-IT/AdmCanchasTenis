// Shared feedback primitives: loading skeletons, error retry cards,
// empty states, semantic status pills and the cuota progress bar.
// Every page uses these instead of bare <p> so loading, error and
// empty states look and behave the same across the club front.
import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Skeleton rows (shimmer; disabled under prefers-reduced-motion).
// ---------------------------------------------------------------------------
const SHIMMER_KEYFRAMES = 'feedback-skeleton-shimmer';

export function Skeleton({
  rows = 3,
  label = 'Cargando…',
}: {
  rows?: number;
  label?: string;
}): JSX.Element {
  return (
    <div role="status" aria-label={label}>
      <style>{`
        @keyframes ${SHIMMER_KEYFRAMES} {
          0% { background-position: -200px 0; }
          100% { background-position: 200px 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .feedback-skeleton-row {
            animation: none !important;
          }
        }
      `}</style>
      <div className="flex flex-col gap-3">
        {Array.from({ length: rows }, (_, index) => (
          <div
            // eslint-disable-next-line react/no-array-index-key
            key={index}
            aria-hidden="true"
            className="feedback-skeleton-row h-[4.5rem] rounded-2xl border border-sereno bg-[#ECEEEB] bg-[length:400px_100%] bg-no-repeat"
            style={{
              backgroundImage: 'linear-gradient(90deg, #ECEEEB 0px, #FFFFFF 100px, #ECEEEB 200px)',
              animation: `${SHIMMER_KEYFRAMES} 1.4s ease-in-out infinite`,
            }}
          />
        ))}
        <span>{label}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ErrorCard: error text plus a Reintentar button (44px touch target).
// ---------------------------------------------------------------------------
export function ErrorCard({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}): JSX.Element {
  return (
    <div
      role="alert"
      className="bg-white border border-sereno rounded-2xl p-5 flex flex-col gap-3"
    >
      <p className="m-0 text-error">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="self-start min-h-[44px] bg-peridot text-white border-none rounded-xl px-4 py-2.5 font-bold cursor-pointer"
      >
        Reintentar
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EmptyState: quiet centered message when a list has nothing to show.
// ---------------------------------------------------------------------------
export function EmptyState({ message }: { message: string }): JSX.Element {
  return (
    <p role="status" className="m-0 text-[#5A6661]">
      {message}
    </p>
  );
}

// ---------------------------------------------------------------------------
// StatusPill: semantic colors per estado.
// green: confirmado / finalizado / pagada · gray: cancelado / cancelada
// amber: adeudada / pendiente / parcial · red: vencida / no_asistio
// Color never stands alone: the estado label is always rendered as text.
// ---------------------------------------------------------------------------
const PILL_CLASSES: Record<string, string> = {
  green: 'bg-[#DDF0E3] text-[#1F6B45] border border-peridot',
  gray: 'bg-[#ECEEEB] text-[#5A6661] border border-sereno',
  amber: 'bg-[#FDF0D5] text-[#7A5200] border border-[#C99A2B]',
  red: 'bg-[#FBE3E3] text-error border border-error',
  neutral: 'bg-whisper text-musgo border border-sereno',
};

function pillTone(estado: string): keyof typeof PILL_CLASSES {
  const key = estado.trim().toLowerCase();
  if (key === 'confirmado' || key === 'confirmada' || key === 'finalizado' || key === 'pagada') {
    return 'green';
  }
  if (key === 'cancelado' || key === 'cancelada') {
    return 'gray';
  }
  if (
    key === 'adeudada' ||
    key === 'adeudado' ||
    key === 'pendiente' ||
    key === 'parcial'
  ) {
    return 'amber';
  }
  if (key === 'vencida' || key === 'vencido' || key === 'no_asistio') {
    return 'red';
  }
  return 'neutral';
}

export function StatusPill({
  estado,
  label,
}: {
  estado: string;
  label?: ReactNode;
}): JSX.Element {
  return (
    <span
      className={`text-xs font-bold rounded-full px-3 py-1 whitespace-nowrap ${PILL_CLASSES[pillTone(estado)]}`}
    >
      {label ?? estado}
    </span>
  );
}

// ---------------------------------------------------------------------------
// CuotaProgress: paid-vs-total bar (role=progressbar, labelled).
// ---------------------------------------------------------------------------
export function CuotaProgress({
  pagado,
  total,
  label,
}: {
  pagado: number;
  total: number;
  label?: string;
}): JSX.Element {
  const percent = total > 0 ? Math.min(100, Math.max(0, (pagado / total) * 100)) : 0;
  const text = label ?? `${Math.round(percent)} % pagado`;
  return (
    <div className="flex flex-col gap-1">
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
        aria-label={text}
        title={text}
        className="h-2 rounded-full bg-[#ECEEEB] overflow-hidden"
      >
        <div
          aria-hidden="true"
          className="h-full rounded-full bg-peridot"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-xs text-[#5A6661]">{text}</span>
    </div>
  );
}
