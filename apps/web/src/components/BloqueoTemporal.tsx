// Reusable chip that marks a feature as temporarily blocked.
// Sober styling, no neon: refined green text on whisper white with a peridot dot.
interface BloqueoTemporalProps {
  motivo?: string;
}

export default function BloqueoTemporal({ motivo }: BloqueoTemporalProps): JSX.Element {
  // Keep the label fixed; only the short reason varies.
  const label = motivo ? `Bloqueado momentáneamente · ${motivo}` : 'Bloqueado momentáneamente';
  return (
    <span
      className="inline-flex items-center gap-2 text-sm font-semibold tracking-[0.01em] text-musgo bg-whisper border border-sereno rounded-full px-3 py-1.5 leading-[1.2] cursor-default"
      role="status"
      aria-label={label}
    >
      <span className="w-2 h-2 rounded-full bg-peridot flex-shrink-0" aria-hidden="true" />
      {label}
    </span>
  );
}
