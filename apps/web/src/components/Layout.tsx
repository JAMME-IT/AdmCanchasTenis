import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { UserButton, useAuth } from '@clerk/react';
import { api } from '../lib/api';
import { tokens } from '../styles/tokens';

const NAV = [
  { to: '/', label: 'Inicio', end: true },
  { to: '/turnos', label: 'Turnos' },
  { to: '/mis-turnos', label: 'Mis turnos' },
  { to: '/mis-cuotas', label: 'Mis cuotas' },
  { to: '/admin', label: 'Admin' },
] as const;

type ApiState = 'checking' | 'ok' | 'down';

const API_LABEL: Record<ApiState, string> = {
  checking: 'Conectando con la API…',
  ok: 'API en línea',
  down: 'API no disponible',
};

const API_DOT: Record<ApiState, string> = {
  checking: tokens.colors.sereno,
  ok: tokens.colors.peridot,
  down: tokens.colors.error,
};

// Layout comun: cabecera blanca de alto fijo con la marca, navegacion
// centrada en desktop y hamburguesa disclosure en mobile, contenido
// centrado y pie con el estado de la API.
export default function Layout({ children }: { children: ReactNode }): JSX.Element {
  const { isSignedIn } = useAuth();
  const [apiState, setApiState] = useState<ApiState>('checking');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    void api.health().then(
      () => active && setApiState('ok'),
      () => active && setApiState('down'),
    );
    return () => {
      active = false;
    };
  }, []);

  const closeMenu = () => setMenuOpen(false);

  return (
    <div
      className="layout-root"
      style={{
        fontFamily: tokens.fonts.body,
        backgroundColor: tokens.colors.whisper,
        color: tokens.colors.musgo,
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <style>{`
        .layout-root,
        .layout-root *,
        .layout-root *::before,
        .layout-root *::after {
          box-sizing: border-box;
        }
        .layout-header {
          position: sticky;
          top: 0;
          z-index: 40;
          background: rgba(255, 255, 255, 0.92);
          -webkit-backdrop-filter: blur(14px);
          backdrop-filter: blur(14px);
          border-bottom: 1px solid ${tokens.colors.sereno};
        }
        .layout-bar {
          width: 100%;
          max-width: ${tokens.shell.maxWidth};
          height: 64px;
          margin: 0 auto;
          padding: 0 ${tokens.shell.gutter};
          display: flex;
          align-items: center;
          gap: clamp(0.75rem, 2vw, 1.5rem);
        }
        .layout-brand {
          display: inline-flex;
          flex: 1 1 auto;
          min-width: 0;
          align-items: center;
          gap: 0.6rem;
          color: ${tokens.colors.musgo};
          text-decoration: none;
        }
        .layout-brand-ball {
          width: 16px;
          height: 16px;
          flex: none;
          border-radius: 50%;
          background: radial-gradient(circle at 35% 30%, #F8F86A 0%, ${tokens.colors.pelota} 45%, #C6C61F 100%);
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
        }
        .layout-brand-name {
          font-family: ${tokens.fonts.display};
          font-size: 1.05rem;
          line-height: 1.1;
          font-weight: 400;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .layout-desktop-nav {
          display: flex;
          flex: none;
          align-items: center;
          gap: 0.25rem;
        }
        .layout-link {
          display: inline-flex;
          align-items: center;
          min-height: 40px;
          padding: 0 0.85rem;
          border-radius: 0.65rem;
          color: #5A6661;
          font-size: 0.9rem;
          font-weight: 600;
          text-decoration: none;
          white-space: nowrap;
          transition: background-color 150ms ease, color 150ms ease;
        }
        .layout-link:hover {
          background-color: ${tokens.colors.whisper};
          color: ${tokens.colors.musgo};
        }
        .layout-link[aria-current="page"] {
          background-color: ${tokens.colors.whisper};
          color: ${tokens.colors.peridot};
        }
        .layout-actions {
          display: flex;
          flex: none;
          align-items: center;
        }
        .layout-mobile-topline,
        .layout-mobile-panel {
          display: none;
        }
        .layout-focus:focus-visible,
        .layout-header :focus-visible,
        .layout-footer :focus-visible {
          outline: 2px solid ${tokens.colors.peridot};
          outline-offset: 3px;
        }
        @media (max-width: 56rem) {
          .layout-desktop-nav,
          .layout-desktop-actions {
            display: none;
          }
          .layout-mobile-topline {
            display: flex;
            flex: none;
            align-items: center;
            gap: 0.5rem;
          }
          .layout-menu-button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            min-width: 44px;
            min-height: 44px;
            padding: 0 0.8rem;
            border: 1px solid ${tokens.colors.sereno};
            border-radius: 0.7rem;
            background: transparent;
            color: ${tokens.colors.musgo};
            font: inherit;
            font-size: 0.875rem;
            font-weight: 700;
            cursor: pointer;
          }
          .layout-menu-button:hover {
            background-color: ${tokens.colors.whisper};
          }
          .layout-burger {
            display: inline-flex;
            flex-direction: column;
            gap: 3px;
          }
          .layout-burger span {
            width: 16px;
            height: 2px;
            border-radius: 2px;
            background: currentColor;
            transition: transform 180ms ease, opacity 180ms ease;
          }
          .layout-bar.menu-abierto .layout-burger span:first-child {
            transform: translateY(5px) rotate(45deg);
          }
          .layout-bar.menu-abierto .layout-burger span:nth-child(2) {
            opacity: 0;
          }
          .layout-bar.menu-abierto .layout-burger span:last-child {
            transform: translateY(-5px) rotate(-45deg);
          }
          /* El panel ocupa su propia fila completa debajo de la marca. */
          .layout-mobile-panel {
            display: grid;
            flex: 1 1 100%;
            grid-template-rows: 0fr;
            opacity: 0;
            visibility: hidden;
            transition: grid-template-rows 250ms ease, opacity 200ms ease, visibility 200ms;
          }
          .layout-bar.menu-abierto .layout-mobile-panel {
            grid-template-rows: 1fr;
            opacity: 1;
            visibility: visible;
          }
          .layout-mobile-panel-inner {
            min-height: 0;
            overflow: hidden;
          }
          .layout-mobile-links {
            display: grid;
            gap: 0.2rem;
            margin: 0;
            padding: 0.4rem 0 0.8rem;
            list-style: none;
          }
          .layout-mobile-links .layout-link {
            justify-content: flex-start;
            min-height: 44px;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .layout-root *,
          .layout-root *::before,
          .layout-root *::after {
            transition-duration: 0.01ms !important;
            animation-duration: 0.01ms !important;
          }
        }
      `}</style>

      <header className="layout-header">
        <nav
          className={`layout-bar${menuOpen ? ' menu-abierto' : ''}`}
          aria-label="Principal"
        >
          <Link to="/" aria-label="Tenis Ranch Club — Inicio" className="layout-brand layout-focus">
            <span aria-hidden="true" className="layout-brand-ball" />
            <span className="layout-brand-name">Tenis Ranch Club</span>
          </Link>

          {isSignedIn && (
            <div className="layout-desktop-nav">
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={'end' in item ? item.end : false}
                  className="layout-link layout-focus"
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          )}

          {isSignedIn && (
            <div className="layout-mobile-topline">
              <button
                ref={menuButtonRef}
                type="button"
                className="layout-menu-button layout-focus"
                aria-expanded={menuOpen}
                aria-controls="layout-mobile-panel"
                onClick={() => setMenuOpen((open) => !open)}
              >
                <span aria-hidden="true" className="layout-burger">
                  <span />
                  <span />
                  <span />
                </span>
                <span>Menú</span>
              </button>
              <div className="layout-actions">
                <UserButton />
              </div>
            </div>
          )}

          {isSignedIn && (
            <div
              id="layout-mobile-panel"
              ref={menuPanelRef}
              className="layout-mobile-panel"
              data-open={menuOpen}
              aria-hidden={!menuOpen}
              onClick={closeMenu}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  closeMenu();
                }
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape' && menuOpen) {
                  closeMenu();
                  menuButtonRef.current?.focus();
                  return;
                }
                const links = Array.from(menuPanelRef.current?.querySelectorAll('a') ?? []);
                const actual = links.indexOf(document.activeElement as HTMLAnchorElement);
                if (actual < 0) return;
                const siguiente: Record<string, number> = {
                  ArrowDown: actual + 1,
                  ArrowUp: actual - 1,
                  Home: 0,
                  End: links.length - 1,
                };
                const destino = siguiente[event.key];
                if (destino === undefined) return;
                event.preventDefault();
                links[(destino + links.length) % links.length].focus();
              }}
            >
              <div className="layout-mobile-panel-inner">
                <ul className="layout-mobile-links">
                  {NAV.map((item) => (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={'end' in item ? item.end : false}
                        className="layout-link layout-focus"
                      >
                        {item.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </nav>
      </header>

      <main
        style={{
          flex: 1,
          width: '100%',
          maxWidth: tokens.shell.maxWidth,
          margin: '0 auto',
          padding: `${tokens.spacing.lg} ${tokens.shell.gutter} ${tokens.spacing.xl}`,
        }}
      >
        {children}
      </main>

      <footer className="layout-footer" style={{ borderTop: `1px solid ${tokens.colors.sereno}` }}>
        <div
          style={{
            maxWidth: tokens.shell.maxWidth,
            margin: '0 auto',
            padding: `${tokens.spacing.sm} ${tokens.shell.gutter}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: tokens.spacing.md,
            flexWrap: 'wrap',
            fontSize: '0.85rem',
          }}
        >
          <span>Tenis Ranch Club · Tus canchas, tus turnos</span>
          <span role="status" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <span
              aria-hidden="true"
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: API_DOT[apiState],
              }}
            />
            {API_LABEL[apiState]}
          </span>
        </div>
      </footer>
    </div>
  );
}
