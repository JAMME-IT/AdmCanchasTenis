// Design tokens del club: paleta, radios, espaciado y tipografias.
// Fuente display/body: Archivo / Archivo Black, ya cargadas en index.html.
// El resto del front importa estos valores en lugar de repetir hex codes.

export const tokens = {
  colors: {
    musgo: '#384543',
    whisper: '#F5F3EF',
    peridot: '#328161',
    sereno: '#8A9A93',
    blanco: '#FFFFFF',
    fairway: '#21875A',
    pelota: '#E9E633',
    error: '#9B2C2C',
  },
  radius: {
    sm: '0.5rem',
    md: '0.75rem',
    lg: '1rem',
    pill: '999px',
  },
  spacing: {
    xs: '0.5rem',
    sm: '0.75rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2.5rem',
  },
  fonts: {
    display: '"Archivo Black", "Archivo", system-ui, -apple-system, "Segoe UI", sans-serif',
    body: '"Archivo", system-ui, -apple-system, "Segoe UI", sans-serif',
    base: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  },
  shell: {
    maxWidth: '1400px',
    gutter: 'clamp(1rem, 4vw, 2.5rem)',
  },
} as const;

export type Tokens = typeof tokens;
