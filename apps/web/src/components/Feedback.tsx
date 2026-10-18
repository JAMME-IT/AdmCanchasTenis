// Shared feedback primitives: loading skeletons, error retry cards,
// empty states, semantic status pills and the cuota progress bar.
// Every page uses these instead of bare <p> so loading, error and
// empty states look and behave the same across the club front.
import type { CSSProperties, ReactNode } from 'react';

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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {Array.from({ length: rows }, (_, index) => (
          <div
            // eslint-disable-next-line react/no-array-index-key
            key={index}
            aria-hidden="true"
            className="feedback-skeleton-row"
            style={{
              height: '4.5rem',
              borderRadius: '1rem',
              border: '1px solid #8A9A93',
              backgroundColor: '#ECEEEB',
              backgroundImage:
                'linear-gradient(90deg, #ECEEEB 0px, #FFFFFF 100px, #ECEEEB 200px)',
              backgroundSize: '400px 100%',
              backgroundRepeat: 'no-repeat',
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
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #8A9A93',
        borderRadius: '1rem',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}
    >
      <p style={{ margin: 0, color: '#9B2C2C' }}>{message}</p>
      <button
        type="button"
        onClick={onRetry}
        style={{
          alignSelf: 'flex-start',
          minHeight: '44px',
          backgroundColor: '#328161',
          color: '#FFFFFF',
          border: 'none',
          borderRadius: '0.75rem',
          padding: '0.6rem 1rem',
          fontWeight: 700,
          cursor: 'pointer',
        }}
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
    <p role="status" style={{ margin: 0, color: '#5A6661' }}>
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
const PILL_STYLES: Record<string, CSSProperties> = {
  green: { backgroundColor: '#DDF0E3', color: '#1F6B45', border: '1px solid #328161' },
  gray: { backgroundColor: '#ECEEEB', color: '#5A6661', border: '1px solid #8A9A93' },
  amber: { backgroundColor: '#FDF0D5', color: '#7A5200', border: '1px solid #C99A2B' },
  red: { backgroundColor: '#FBE3E3', color: '#9B2C2C', border: '1px solid #9B2C2C' },
  neutral: { backgroundColor: '#F5F3EF', color: '#384543', border: '1px solid #8A9A93' },
};

function pillTone(estado: string): keyof typeof PILL_STYLES {
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
      style={{
        fontSize: '0.8rem',
        fontWeight: 700,
        borderRadius: '999px',
        padding: '0.25rem 0.75rem',
        whiteSpace: 'nowrap',
        ...PILL_STYLES[pillTone(estado)],
      }}
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
        aria-label={text}
        title={text}
        style={{
          height: '0.5rem',
          borderRadius: '999px',
          backgroundColor: '#ECEEEB',
          overflow: 'hidden',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: `${percent}%`,
            height: '100%',
            borderRadius: '999px',
            backgroundColor: '#328161',
          }}
        />
      </div>
      <span style={{ fontSize: '0.8rem', color: '#5A6661' }}>{text}</span>
    </div>
  );
}
