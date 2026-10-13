// Reusable chip that marks a feature as temporarily blocked.
// Sober styling, no neon: refined green text on whisper white with a peridot dot.
interface BloqueoTemporalProps {
  motivo?: string;
}

const chipStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.5rem',
  fontSize: '0.8rem',
  fontWeight: 600,
  letterSpacing: '0.01em',
  color: '#384543',
  backgroundColor: '#F5F3EF',
  border: '1px solid #8A9A93',
  borderRadius: '999px',
  padding: '0.3rem 0.75rem',
  lineHeight: 1.2,
};

const dotStyle: React.CSSProperties = {
  width: '0.5rem',
  height: '0.5rem',
  borderRadius: '999px',
  backgroundColor: '#328161',
  flexShrink: 0,
};

export default function BloqueoTemporal({ motivo }: BloqueoTemporalProps): JSX.Element {
  // Keep the label fixed; only the short reason varies.
  const label = motivo ? `Bloqueado momentáneamente · ${motivo}` : 'Bloqueado momentáneamente';
  return (
    <span style={chipStyle} role="status" aria-label={label}>
      <span style={dotStyle} aria-hidden="true" />
      {label}
    </span>
  );
}
