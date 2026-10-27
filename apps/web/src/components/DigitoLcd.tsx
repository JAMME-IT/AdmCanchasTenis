interface DigitoLcdProps {
  /** Un carácter `0`-`9` o `:`. Los demás se dibujan apagados. */
  digito: string;
  className?: string;
}

/** Segmentos encendidos por dígito, con la nomenclatura clásica del display. */
const SEGMENTOS: Record<string, string> = {
  '0': 'abcdef',
  '1': 'bc',
  '2': 'abdeg',
  '3': 'abcdg',
  '4': 'bcfg',
  '5': 'acdfg',
  '6': 'acdefg',
  '7': 'abc',
  '8': 'abcdefg',
  '9': 'abcdfg',
};

/**
 * Trazos de los 7 segmentos, en un viewBox de 40x72. Las coordenadas dejan un
 * aire en las esquinas para que se lea como un display y no como una caja.
 */
const TRAZOS: Record<string, [number, number, number, number]> = {
  a: [7, 6, 33, 6],
  b: [34, 8, 34, 33],
  c: [34, 39, 34, 64],
  d: [7, 66, 33, 66],
  e: [6, 39, 6, 64],
  f: [6, 8, 6, 33],
  g: [7, 36, 33, 36],
};

/**
 * Carácter de display LCD (7 segmentos) para el horario de los turnos.
 *
 * Se dibuja en SVG, igual que la cancha: escala nítido a cualquier tamaño y no
 * necesita una fuente externa. Los segmentos apagados quedan al 12% para
 * conservar la silueta del display, que es lo que da la sensación de reloj.
 * El `:` usa un viewBox más angosto para que no ocupe el ancho de un dígito.
 */
export default function DigitoLcd({ digito, className }: DigitoLcdProps): JSX.Element {
  if (digito === ':') {
    return (
      <svg
        viewBox="0 0 14 72"
        className={className}
        aria-hidden="true"
        focusable="false"
        fill="currentColor"
      >
        <circle cx="7" cy="26" r="5" />
        <circle cx="7" cy="52" r="5" />
      </svg>
    );
  }

  const encendidos = SEGMENTOS[digito] ?? '';
  return (
    <svg
      viewBox="0 0 40 72"
      className={className}
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="6"
    >
      {Object.entries(TRAZOS).map(([segmento, [x1, y1, x2, y2]]) => (
        <line
          key={segmento}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          opacity={encendidos.includes(segmento) ? 1 : 0.12}
        />
      ))}
    </svg>
  );
}
