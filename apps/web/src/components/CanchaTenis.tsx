interface CanchaTenisProps {
  className?: string;
}

/**
 * Cancha de tenis en SVG, con la geometría de la del login (`AuthMarca.tsx`)
 * rotada a horizontal: proporción 23.77/13.6, calle de dobles al 12.5% de
 * cada lado, líneas de saque a 23.07%/76.93% y red al 50% (vertical).
 *
 * Se dibuja en SVG y no con divs porque acá se repite una vez por celda del
 * calendario (28+): el trazo queda nítido a cualquier tamaño y no hacen falta
 * pseudo-elementos ni `aspect-ratio`. Los trazos usan `currentColor`, así el
 * estado de la celda se comunica con las utilidades de texto de Tailwind.
 */
export default function CanchaTenis({ className }: CanchaTenisProps): JSX.Element {
  return (
    <svg
      viewBox="0 0 236 136"
      className={className}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeLinecap="square"
    >
      {/* Perímetro de la cancha (doble). */}
      <rect x="1.5" y="1.5" width="233" height="133" strokeWidth="3" />
      {/* Calles de dobles: 12.5% del alto, arriba y abajo. */}
      <line x1="1.5" y1="18.125" x2="234.5" y2="18.125" strokeWidth="2.5" />
      <line x1="1.5" y1="117.875" x2="234.5" y2="117.875" strokeWidth="2.5" />
      {/* Líneas de saque: 6.40 m desde la red sobre 23.77 m. */}
      <line x1="55.25" y1="18.125" x2="55.25" y2="117.875" strokeWidth="2.5" />
      <line x1="180.75" y1="18.125" x2="180.75" y2="117.875" strokeWidth="2.5" />
      {/* Línea central de saque, entre las dos líneas anteriores. */}
      <line x1="55.25" y1="68" x2="180.75" y2="68" strokeWidth="2.5" />
      {/* Red, al medio y a todo el alto. */}
      <line x1="118" y1="0" x2="118" y2="136" strokeWidth="4" />
    </svg>
  );
}
