import type { ReactNode } from 'react';

// Paleta del club (misma que el resto del front):
// verde fairway #21875A (panel de marca, verde diagramado en Stitch),
// blanco whisper #F5F3EF (fondo), acento peridot #328161 (botones),
// gris sereno #8A9A93 (bordes), verde musgo #384543 (texto).
//
// Forma de `appearance` verificada contra lo instalado:
// - variables: ClerkAppearanceTheme -> Theme { variables?: Variables },
//   con Variables { colorPrimary, colorForeground, colorBackground,
//   colorInputForeground, colorInputBackground, colorBorder, fontFamily,
//   borderRadius, ... } (ver node_modules/@clerk/react/dist,
//   dist/types-DQLY8q6I.d.mts). En v6 el texto se tiñe con
//   `colorForeground` (no existe `colorText` en Variables).
// - elements: claves de la API pública de personalización de Clerk
//   (rootBox, cardBox, card, headerTitle, headerSubtitle,
//   socialButtonsBlockButton, formFieldLabel, formFieldInput,
//   formButtonPrimary, footerActionText, footerActionLink, ...),
//   documentadas en https://clerk.com/docs/customization/appearance
//   y estables en @clerk/react v6. El widget se funde en la página:
//   tarjeta transparente, sin sombra ni borde; los inputs quedan en
//   blanco y el botón primario en peridot.
export const aparienciaAuth = {
  variables: {
    colorPrimary: '#328161',
    colorForeground: '#384543',
    colorBackground: '#F5F3EF',
    colorInputForeground: '#384543',
    colorInputBackground: '#FFFFFF',
    colorBorder: '#8A9A93',
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    borderRadius: '0.75rem',
  },
  elements: {
    rootBox: {
      width: '100%',
      margin: '0 auto',
    },
    cardBox: {
      width: '100%',
      boxShadow: 'none',
    },
    card: {
      width: '100%',
      backgroundColor: 'transparent',
      border: 'none',
      boxShadow: 'none',
    },
    main: {
      gap: '1.25rem',
    },
    headerTitle: {
      color: '#384543',
    },
    headerSubtitle: {
      color: '#384543',
    },
    socialButtonsBlockButton: {
      backgroundColor: '#FFFFFF',
      borderColor: '#8A9A93',
      color: '#384543',
    },
    socialButtonsBlockButtonText: {
      color: '#384543',
    },
    formFieldLabel: {
      color: '#384543',
    },
    formFieldInput: {
      backgroundColor: '#FFFFFF',
      borderColor: '#8A9A93',
      color: '#384543',
    },
    formFieldAction: {
      color: '#328161',
    },
    formButtonPrimary: {
      backgroundColor: '#328161',
      border: 'none',
    },
    footerActionText: {
      color: '#384543',
    },
    footerActionLink: {
      color: '#328161',
    },
    identityPreviewText: {
      color: '#384543',
    },
    identityPreviewEditButton: {
      color: '#328161',
    },
  },
};

type AuthMarcaProps = {
  children: ReactNode;
  tituloBienvenida: string;
  textoBienvenida: string;
};

// Layout split 60/40 a viewport completo: panel de marca en verde
// fairway + zona de formulario sobre whisper. Sin tarjetas flotando.
// Sin scroll en desktop: `.auth` fija `height: 100dvh` con
// `overflow: hidden`; textos compactos con `clamp()` atado a `vh` y la
// cancha llena el alto, así a 900px de alto típico nada desborda.
// Full-bleed del panel: el navegador trae `body { margin: 8px }` por
// defecto y ese era el "marco" blanco alrededor del verde. Se resetea
// `html, body` a `margin/padding: 0` desde este mismo `<style>` global.
// Panel en FILA: texto A LA IZQUIERDA, cancha A LA DERECHA.
// El texto vive en su propia columna flex sobre verde liso, así
// ninguna línea pasa por debajo de él. La cancha es VERTICAL con
// presencia (más ancha que la real: `aspect-ratio: 13.6 / 23.77`)
// y con sangrado real: `height: 114%` centrada, fondos cortados
// fuera del viewport. Pegada al texto (padding-left 0.25rem).
// Geometría interior por porcentajes (singles 8.23m -> inset 12.5% por
// lado; líneas de servicio a 6.4m de la red -> 23.07% / 76.93%).
// Grosores con presencia: fondos (baselines) al doble que el resto
// (8px vs 4px, proporción reglamento 10cm vs 5cm). Pelota ø14px en CSS
// puro picando ADENTRO arriba a la IZQUIERDA de la pista, con sombra
// de asiento. Franjas de corte Wimbledon: bandas verticales alternadas
// con blanco al 5% (perpendiculares a la red horizontal).
// Wordmark apilado en Archivo Black 400 (único peso, black por
// diseño; misma superfamilia que el apoyo Archivo = armonía por
// contraste de peso extremo). Todo en MAYÚSCULAS con presencia y
// tamaño grande, en 3 líneas en desktop. Sin optical sizing (un solo
// corte), leading 0.98: las mayúsculas no tienen descendentes y el
// clamp atado a `vh` deja aire sin desbordar a 900px de alto típico.
// Bajada + bienvenida en Archivo 500/600; cuerpo y Clerk en system-ui.
// En mobile (<=880px, solo dentro de ese media query): la marca es la
// MITAD SUPERIOR de la misma cancha vertical de desktop (fondo arriba,
// cuadros de saque, corte justo en la RED horizontal). El formulario
// arranca en la red: la red queda al filo inferior del panel verde como
// divisoria/horizonte. Textos compactos centrados sobre verde liso.
export default function AuthMarca({
  children,
  tituloBienvenida,
  textoBienvenida,
}: AuthMarcaProps): JSX.Element {
  return (
    <main className="auth">
      <style>{`
        html, body {
          margin: 0;
          padding: 0;
        }
        .auth {
          height: 100dvh;
          min-height: 100dvh;
          display: grid;
          grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
          overflow: hidden;
          background-color: #F5F3EF;
          color: #384543;
          font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
        }
        .auth :focus-visible {
          outline: 2px solid #328161;
          outline-offset: 3px;
          border-radius: 4px;
        }
        .auth-marca {
          position: relative;
          overflow: hidden;
          background-color: #21875A;
          background-image: repeating-linear-gradient(
            90deg,
            rgba(255, 255, 255, 0.05) 0,
            rgba(255, 255, 255, 0.05) 72px,
            rgba(255, 255, 255, 0) 72px,
            rgba(255, 255, 255, 0) 144px
          );
          color: #F5F3EF;
          padding: 0;
          display: flex;
          flex-direction: row;
          align-items: stretch;
          justify-content: flex-start;
          gap: 0;
          min-height: 0;
          min-width: 0;
        }
        .auth-marca-textos {
          position: relative;
          z-index: 1;
          flex: 1 1 auto;
          min-width: 0;
          min-height: 0;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: clamp(1.5rem, 1rem + 3.2vh, 3rem);
          padding: clamp(1rem, 1rem + 2vh, 2rem) clamp(0.5rem, 0.25rem + 0.6vw, 0.75rem) clamp(1rem, 1rem + 2vh, 2rem) clamp(0.75rem, 0.5rem + 1.5vw, 1.5rem);
          overflow: hidden;
        }
        .auth-marca-titulo {
          font-family: "Archivo Black", "Archivo", system-ui, -apple-system, "Segoe UI", sans-serif;
          font-weight: 400;
          font-size: clamp(2.6rem, 1rem + 7.5vh, 4.5rem);
          line-height: 0.98;
          letter-spacing: 0.01em;
          text-transform: uppercase;
          text-align: left;
          margin: 0;
          max-width: 100%;
        }
        .auth-marca-titulo span {
          display: block;
        }
        .auth-marca-bajada {
          margin: 0.75rem 0 0;
          font-family: "Archivo", system-ui, -apple-system, "Segoe UI", sans-serif;
          font-size: clamp(1.15rem, 0.8rem + 1.8vh, 1.5rem);
          font-weight: 600;
          letter-spacing: 0.01em;
          line-height: 1.3;
          color: #FFFFFF;
        }
        .auth-marca-bienvenida {
          position: relative;
          z-index: 1;
        }
        .auth-marca-bienvenida h2 {
          margin: 0 0 0.5rem;
          font-family: "Archivo", system-ui, -apple-system, "Segoe UI", sans-serif;
          font-size: clamp(1.1rem, 0.8rem + 1.5vh, 1.4rem);
          font-weight: 600;
          line-height: 1.3;
        }
        .auth-marca-bienvenida p {
          margin: 0;
          font-size: clamp(0.92rem, 0.72rem + 1vh, 1.05rem);
          line-height: 1.5;
          color: #FFFFFF;
          max-width: 30rem;
        }
        /* Cancha VERTICAL a la izquierda del resto de verde: el
           contenedor centra una pista MÁS ANCHA que la real
           (aspect-ratio 13.6 / 23.77, ~24% más presencia) y MÁS
           ALTA que el panel (height 114%), así las líneas de
           fondo se pierden fuera del viewport (sangrado real arriba
           y abajo). Pegada al texto con aire mínimo (padding-left
           0.25rem + padding-right corto del bloque de texto). Se
           lee vertical completa: laterales, red al medio y cuadros
           de saque visibles; solo los fondos se cortan. */
        .auth-cancha {
          position: relative;
          flex: none;
          align-self: stretch;
          display: flex;
          align-items: center;
          justify-content: flex-start;
          min-height: 0;
          margin: 0;
          padding: 0 clamp(0.6rem, 0.4rem + 1vw, 1.1rem) 0 0.25rem;
          overflow: hidden;
          pointer-events: none;
        }
        .auth-cancha-pista {
          position: relative;
          height: 114%;
          aspect-ratio: 13.6 / 23.77;
          max-width: 100%;
          box-sizing: border-box;
          border-top: 8px solid rgba(255, 255, 255, 0.92);
          border-bottom: 8px solid rgba(255, 255, 255, 0.92);
          border-left: 4px solid rgba(255, 255, 255, 0.85);
          border-right: 4px solid rgba(255, 255, 255, 0.85);
        }
        .auth-cancha-pista::before,
        .auth-cancha-pista::after {
          content: "";
          position: absolute;
          left: 50%;
          width: 4px;
          height: 12px;
          background-color: rgba(255, 255, 255, 0.92);
          transform: translateX(-50%);
        }
        .auth-cancha-pista::before {
          top: -8px;
        }
        .auth-cancha-pista::after {
          bottom: -8px;
        }
        .auth-cancha-singles {
          position: absolute;
          inset: 0 12.5%;
          border-left: 4px solid rgba(255, 255, 255, 0.85);
          border-right: 4px solid rgba(255, 255, 255, 0.85);
        }
        .auth-cancha-servicio {
          position: absolute;
          left: 12.5%;
          right: 12.5%;
          border-top: 4px solid rgba(255, 255, 255, 0.85);
        }
        .auth-cancha-servicio--a {
          top: 23.07%;
        }
        .auth-cancha-servicio--b {
          top: 76.93%;
        }
        .auth-cancha-red {
          position: absolute;
          left: 0;
          right: 0;
          top: 50%;
          border-top: 4px solid rgba(255, 255, 255, 0.9);
        }
        .auth-cancha-central {
          position: absolute;
          top: 23.07%;
          bottom: 23.07%;
          left: 50%;
          border-left: 4px solid rgba(255, 255, 255, 0.85);
        }
        /* Pelota de tenis en CSS puro, picando ADENTRO arriba a la
           IZQUIERDA de la pista. La pista sangra ~7% por arriba, así
           que la pelota baja a top 8.5% (unos 15px bajo el borde
           visible) en vez de px fijos que quedarían cortados. Ø14px
           con dos costuras curvas blancas y sombra de asiento. */
        .auth-pelota {
          position: absolute;
          top: 8.5%;
          left: 14px;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: radial-gradient(
            circle at 35% 30%,
            #F8F86A 0%,
            #E9E633 45%,
            #C6C61F 100%
          );
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
          overflow: hidden;
        }
        .auth-pelota::before,
        .auth-pelota::after {
          content: "";
          position: absolute;
          top: -20%;
          width: 120%;
          height: 140%;
          border: 1.5px solid transparent;
          border-radius: 50%;
        }
        .auth-pelota::before {
          left: -72%;
          border-right-color: rgba(255, 255, 255, 0.95);
        }
        .auth-pelota::after {
          right: -72%;
          border-left-color: rgba(255, 255, 255, 0.95);
        }
        .auth-form {
          display: grid;
          place-items: center;
          min-height: 0;
          overflow: hidden;
          padding: clamp(1rem, 3vh, 2rem) clamp(1rem, 2vw, 1.5rem);
        }
        .auth-form-inner {
          width: 100%;
          max-width: 25rem;
        }
        .auth a {
          transition: color 150ms ease;
        }
        @media (max-width: 880px) {
          .auth {
            grid-template-columns: 1fr;
            height: auto;
            min-height: 100dvh;
            overflow: visible;
            overflow-x: clip;
          }
          .auth-marca {
            flex-direction: column;
            align-items: stretch;
            padding: 0;
          }
          .auth-marca-textos {
            gap: 0.35rem;
            padding: 1.1rem 1.25rem 0.9rem;
            overflow: visible;
            align-items: center;
            text-align: center;
          }
          /* Wordmark Archivo Black en mayúsculas: grotesco black de un
             solo peso 400, rinde visualmente más ancho y pesado que la
             serif anterior, así que en mobile se permite envolver a 2
             líneas centradas parejas (wrap + balance) con tamaño atado a
             vw y leading 1.08 para las mayúsculas sin descendentes;
             aunque cargue la fallback sans el ancho total queda bajo el
             viewport y no hay scroll horizontal a 320-390px. Flex con
             gap porque los <span> no traen espacios entre palabras. */
          .auth-marca-titulo {
            display: flex;
            flex-direction: row;
            flex-wrap: wrap;
            align-items: baseline;
            justify-content: center;
            gap: 0.4em;
            max-width: 100%;
            font-size: clamp(1.4rem, 0.65rem + 4.5vw, 1.8rem);
            line-height: 1.08;
            letter-spacing: 0.02em;
            white-space: normal;
            text-wrap: balance;
            overflow-wrap: break-word;
          }
          .auth-marca-titulo span {
            display: inline;
          }
          .auth-marca-bajada {
            margin: 0.35rem 0 0;
            font-size: 0.98rem;
            line-height: 1.35;
            text-align: center;
          }
          /* En mobile el foco es entrar: se oculta la bienvenida larga
             (título + párrafo de la página). La bajada de una línea basta. */
          .auth-marca-bienvenida {
            display: none;
          }
          /* Mitad SUPERIOR de la misma cancha VERTICAL de desktop: el
             contenedor recorta a la altura de media pista y la pista mide
             el doble de alto, con el fondo arriba y la RED (50% de la
             pista) al filo inferior del panel verde. La red es la
             divisoria: el formulario arranca justo debajo. Ancho con
             presencia pero que entra a 320px sin scroll (clamp atado a
             vw + overflow hidden del contenedor). Laterales y cuadros de
             saque visibles; la mitad inferior queda cortada. */
          .auth-cancha {
            flex: none;
            align-self: stretch;
            height: clamp(220px, 62vw, 262px);
            min-height: 0;
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: flex-start;
            overflow: hidden;
          }
          .auth-cancha-pista {
            position: relative;
            height: 200%;
            width: auto;
            max-width: none;
            aspect-ratio: 13.6 / 23.77;
            box-sizing: border-box;
            border-top: 8px solid rgba(255, 255, 255, 0.92);
            border-bottom: 8px solid rgba(255, 255, 255, 0.92);
            border-left: 4px solid rgba(255, 255, 255, 0.85);
            border-right: 4px solid rgba(255, 255, 255, 0.85);
          }
          .auth-cancha-pista::before,
          .auth-cancha-pista::after {
            content: "";
            position: absolute;
            left: 50%;
            right: auto;
            top: auto;
            bottom: auto;
            width: 4px;
            height: 12px;
            background-color: rgba(255, 255, 255, 0.92);
            transform: translateX(-50%);
          }
          .auth-cancha-pista::before {
            top: -8px;
          }
          .auth-cancha-pista::after {
            bottom: -8px;
          }
          .auth-cancha-singles {
            position: absolute;
            inset: 0 12.5%;
            border-left: 4px solid rgba(255, 255, 255, 0.85);
            border-right: 4px solid rgba(255, 255, 255, 0.85);
            border-top: none;
            border-bottom: none;
          }
          .auth-cancha-servicio {
            position: absolute;
            left: 12.5%;
            right: 12.5%;
            top: auto;
            bottom: auto;
            border-top: 4px solid rgba(255, 255, 255, 0.85);
            border-left: none;
          }
          .auth-cancha-servicio--a {
            top: 23.07%;
            left: 12.5%;
          }
          .auth-cancha-servicio--b {
            top: 76.93%;
            left: 12.5%;
          }
          /* La red (50% de la pista = filo inferior del panel) queda
             íntegra justo arriba del corte y divide marca/formulario. */
          .auth-cancha-red {
            position: absolute;
            left: 0;
            right: 0;
            top: 50%;
            bottom: auto;
            border-top: 4px solid rgba(255, 255, 255, 0.9);
            border-left: none;
            transform: translateY(-100%);
          }
          .auth-cancha-central {
            position: absolute;
            top: 23.07%;
            bottom: 23.07%;
            left: 50%;
            right: auto;
            border-left: 4px solid rgba(255, 255, 255, 0.85);
            border-top: none;
          }
          /* Pelota adentro arriba a la IZQUIERDA de la media pista
             (mismo ø14px, costuras y sombra de desktop). */
          .auth-pelota {
            top: 9%;
            left: 16px;
          }
          .auth-form {
            overflow: visible;
            overflow-x: clip;
            padding: 1.5rem 1.25rem 2.5rem;
          }
          .auth-form-inner {
            max-width: 26rem;
            margin: 0 auto;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .auth *,
          .auth *::before,
          .auth *::after {
            transition: none !important;
            animation: none !important;
          }
        }
      `}</style>
      <section className="auth-marca" aria-label="Tenis Ranch Club">
        <div className="auth-marca-textos">
          <div style={{ position: 'relative', zIndex: 1 }}>
            <h1 className="auth-marca-titulo" aria-label="Tenis Ranch Club">
              <span aria-hidden="true">TENIS</span>
              <span aria-hidden="true">RANCH</span>
              <span aria-hidden="true">CLUB</span>
            </h1>
            <p className="auth-marca-bajada">Tus canchas, tus turnos</p>
          </div>
          <div className="auth-marca-bienvenida">
            <h2>{tituloBienvenida}</h2>
            <p>{textoBienvenida}</p>
          </div>
        </div>
        <div className="auth-cancha" aria-hidden="true">
          <div className="auth-cancha-pista">
            <div className="auth-cancha-singles" />
            <div className="auth-cancha-servicio auth-cancha-servicio--a" />
            <div className="auth-cancha-servicio auth-cancha-servicio--b" />
            <div className="auth-cancha-central" />
            <div className="auth-cancha-red" />
            <div className="auth-pelota" />
          </div>
        </div>
      </section>
      <section className="auth-form" aria-label="Formulario de acceso">
        <div className="auth-form-inner">{children}</div>
      </section>
    </main>
  );
}
