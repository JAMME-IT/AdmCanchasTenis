import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { UserButton, useAuth } from '@clerk/react';
import { api } from '../lib/api';
import { useSignOut } from '../lib/useSignOut';
import { tokens } from '../styles/tokens';

// Navegacion principal del club: misma en todas las paginas con sesion.
// Turnos es un dropdown CSS puro (hover + focus-within, sin JS).
const NAV = [
  { to: '/', label: 'Inicio', end: true },
  { to: '/mis-cuotas', label: 'Mis cuotas', end: false },
  { to: '/admin', label: 'Admin', end: false },
] as const;

// Items del dropdown de Turnos.
const TURNOS_MENU = [
  { to: '/turnos', label: 'Reservar turno', hint: 'Disponibilidad del día' },
  { to: '/mis-turnos', label: 'Mis turnos', hint: 'Vigentes e historial' },
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

// Layout comun: cabecera con la marca del club (mismo motivo que
// AuthMarca: verde fairway, franjas de corte y pelota en CSS puro),
// navegacion principal, contenido centrado y pie con el estado de la API.
export default function Layout({ children }: { children: ReactNode }): JSX.Element {
  const { isSignedIn } = useAuth();
  const signOutEverywhere = useSignOut();
  const [apiState, setApiState] = useState<ApiState>('checking');
  // Menu mobile (disclosure ARIA, no dialogo): el estado abierto vive en
  // React y el CSS anima desde ese estado. En desktop se ignora.
  const [menuAbierto, setMenuAbierto] = useState(false);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    void api.health().then(
      () => {
        if (active) {
          setApiState('ok');
        }
      },
      () => {
        if (active) {
          setApiState('down');
        }
      },
    );
    return () => {
      active = false;
    };
  }, []);

  return (
    <div
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
        .layout-nav a:focus-visible,
        .layout-header :focus-visible,
        .layout-footer :focus-visible {
          outline: 2px solid ${tokens.colors.peridot};
          outline-offset: 3px;
          border-radius: 4px;
        }
        .layout-bar-link {
          flex: 1 1 auto;
          max-width: 12rem;
          text-align: center;
          min-height: 2.25rem;
          font-size: 0.78rem;
          letter-spacing: 0.04em;
        }
        /* Menu hamburguesa mobile: el panel anima con grid-rows desde
           la clase menu-abierto (una sola fuente de verdad con el estado).
           En desktop el boton se oculta y el panel es transparente. */
        .nav-menu-btn {
          display: none;
        }
        .nav-menu-panel,
        .nav-menu-inner {
          display: contents;
        }
        .nav-burger {
          display: inline-flex;
          flex-direction: column;
          gap: 3px;
        }
        .nav-burger i {
          display: block;
          width: 1rem;
          height: 2px;
          border-radius: 2px;
          background: currentColor;
          transition: transform 0.2s ease, opacity 0.2s ease;
        }
        .menu-abierto .nav-burger i:nth-child(1) {
          transform: translateY(5px) rotate(45deg);
        }
        .menu-abierto .nav-burger i:nth-child(2) {
          opacity: 0;
        }
        .menu-abierto .nav-burger i:nth-child(3) {
          transform: translateY(-5px) rotate(-45deg);
        }
        .nav-dd {
          position: relative;
          flex: 1 1 auto;
          max-width: 12rem;
          display: flex;
        }
        .nav-dd-trigger {
          flex: 1 1 auto;
        }
        .nav-chevron {
          transition: transform 0.18s ease;
        }
        .nav-dd:hover .nav-chevron,
        .nav-dd:focus-within .nav-chevron {
          transform: rotate(180deg);
        }
        .nav-panel {
          position: absolute;
          top: 100%;
          left: 50%;
          z-index: 40;
          min-width: 15rem;
          margin-top: 0.6rem;
          padding: 0.4rem;
          border-radius: 1rem;
          border: 1px solid rgba(255, 255, 255, 0.25);
          background-color: #2C3E3A;
          box-shadow: 0 24px 60px -16px rgba(0, 0, 0, 0.5);
          opacity: 0;
          visibility: hidden;
          transform: translate(-50%, 6px);
          transition: opacity 0.18s ease, transform 0.18s ease, visibility 0.18s;
        }
        .nav-panel::before {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          top: -12px;
          height: 12px;
        }
        .nav-dd:hover .nav-panel,
        .nav-dd:focus-within .nav-panel {
          opacity: 1;
          visibility: visible;
          transform: translate(-50%, 0);
        }
        @media (max-width: 56rem) {
          .layout-bar {
            flex-direction: column;
            align-items: stretch !important;
          }
          .layout-bar-nav {
            flex-direction: column !important;
            align-items: stretch !important;
            justify-content: flex-start !important;
          }
          .layout-bar-link {
            max-width: none;
            min-height: 44px;
            font-size: 0.85rem;
            justify-content: flex-start;
            text-align: left;
          }
          .nav-dd {
            max-width: none;
            flex-direction: column;
          }
          /* En mobile el panel queda fijo como sub-lista indentada,
             sin tarjeta flotante. */
          .nav-panel {
            position: static;
            transform: none;
            opacity: 1;
            visibility: visible;
            min-width: 0;
            margin-top: 0;
            padding: 0 0 0 1rem;
            border: none;
            border-radius: 0;
            background: transparent;
            box-shadow: none;
            transition: none;
          }
          .nav-panel::before {
            display: none;
          }
          .layout-bar-actions {
            justify-content: flex-end;
          }
          .nav-menu-btn {
            display: inline-flex;
            align-items: center;
            align-self: flex-start;
            gap: 0.5rem;
            min-height: 44px;
            border-radius: 0.75rem;
            border: 1px solid rgba(255, 255, 255, 0.4);
            background: transparent;
            color: inherit;
            padding: 0.6rem 1rem;
            font-weight: 700;
            cursor: pointer;
          }
          .nav-menu-panel {
            display: grid;
            grid-template-rows: 0fr;
            opacity: 0;
            transition: grid-template-rows 0.25s ease, opacity 0.2s ease;
            flex: 1 1 auto;
            min-width: 0;
          }
          .menu-abierto .nav-menu-panel {
            grid-template-rows: 1fr;
            opacity: 1;
          }
          .nav-menu-inner {
            display: flex;
            flex-direction: column;
            min-height: 0;
            overflow: hidden;
            gap: 0.25rem;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .layout * {
            transition: none !important;
            animation: none !important;
          }
        }
      `}</style>

      <header
        className="layout-header"
        style={{
          backgroundColor: tokens.colors.fairway,
          backgroundImage:
            'repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.05) 0, rgba(255, 255, 255, 0.05) 72px, rgba(255, 255, 255, 0) 72px, rgba(255, 255, 255, 0) 144px)',
          color: tokens.colors.whisper,
        }}
      >
        <div
          className="layout-bar"
          style={{
            maxWidth: tokens.shell.maxWidth,
            margin: '0 auto',
            padding: `${tokens.spacing.sm} ${tokens.shell.gutter}`,
            display: 'flex',
            alignItems: 'center',
            gap: tokens.spacing.md,
            flexWrap: 'wrap',
          }}
        >
          <Link
            to="/"
            aria-label="Tenis Ranch Club — Inicio"
            style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', textDecoration: 'none', flex: 'none' }}
          >
            <span
              aria-hidden="true"
              style={{
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                flex: 'none',
                background: `radial-gradient(circle at 35% 30%, #F8F86A 0%, ${tokens.colors.pelota} 45%, #C6C61F 100%)`,
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.4)',
              }}
            />
            <span
              style={{
                fontFamily: tokens.fonts.display,
                fontWeight: 400,
                textTransform: 'uppercase',
                letterSpacing: '0.02em',
                fontSize: '1.05rem',
                lineHeight: 1.1,
                color: tokens.colors.whisper,
              }}
            >
              Tenis Ranch Club
            </span>
          </Link>
          {isSignedIn && (
            <nav
              aria-label="Principal"
              className={`layout-nav layout-bar-nav${menuAbierto ? ' menu-abierto' : ''}`}
              style={{
                flex: '1 1 24rem',
                display: 'flex',
                gap: tokens.spacing.xs,
                justifyContent: 'center',
              }}
            >
              <button
                type="button"
                ref={menuBtnRef}
                aria-expanded={menuAbierto}
                aria-controls="nav-menu-panel"
                onClick={() => setMenuAbierto((abierto) => !abierto)}
                className="nav-menu-btn"
              >
                <span aria-hidden="true" className="nav-burger">
                  <i />
                  <i />
                  <i />
                </span>
                Menú
              </button>
              <div
                id="nav-menu-panel"
                ref={menuPanelRef}
                className="nav-menu-panel"
                onClick={() => setMenuAbierto(false)}
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                    setMenuAbierto(false);
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    setMenuAbierto(false);
                    menuBtnRef.current?.focus();
                    return;
                  }
                  const links = Array.from(
                    menuPanelRef.current?.querySelectorAll('a') ?? [],
                  );
                  const actual = links.indexOf(document.activeElement as HTMLAnchorElement);
                  if (actual < 0) {
                    return;
                  }
                  const siguiente: Record<string, number> = {
                    ArrowDown: actual + 1,
                    ArrowUp: actual - 1,
                    Home: 0,
                    End: links.length - 1,
                  };
                  const destino = siguiente[event.key];
                  if (destino === undefined) {
                    return;
                  }
                  event.preventDefault();
                  links[(destino + links.length) % links.length].focus();
                }}
              >
                <div className="nav-menu-inner">
              <div className="nav-dd">
                <Link
                  to="/turnos"
                  aria-haspopup="true"
                  className="layout-bar-link nav-dd-trigger"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.3rem',
                    borderRadius: tokens.radius.pill,
                    padding: '0.35rem 0.75rem',
                    fontWeight: 600,
                    textDecoration: 'none',
                    color: tokens.colors.whisper,
                    border: '1px solid transparent',
                  }}
                >
                  Turnos
                  <svg
                    className="nav-chevron"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    aria-hidden="true"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </Link>
                <ul
                  aria-label="Turnos"
                  className="nav-panel"
                  style={{ listStyle: 'none', margin: 0 }}
                >
                  {TURNOS_MENU.map((item) => (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        style={({ isActive }) => ({
                          display: 'flex',
                          flexDirection: 'column',
                          minHeight: '44px',
                          justifyContent: 'center',
                          borderRadius: '0.75rem',
                          padding: '0.5rem 0.85rem',
                          textDecoration: 'none',
                          color: tokens.colors.whisper,
                          backgroundColor: isActive ? 'rgba(255, 255, 255, 0.18)' : 'transparent',
                        })}
                      >
                        <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{item.label}</span>
                        <span style={{ fontSize: '0.75rem', opacity: 0.75 }}>{item.hint}</span>
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className="layout-bar-link"
                  style={({ isActive }) => ({
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: tokens.radius.pill,
                    padding: '0.35rem 0.75rem',
                    fontWeight: 600,
                    textDecoration: 'none',
                    color: tokens.colors.whisper,
                    backgroundColor: isActive ? 'rgba(255, 255, 255, 0.18)' : 'transparent',
                    border: isActive
                      ? `1px solid ${tokens.colors.whisper}`
                      : '1px solid transparent',
                  })}
                >
                  {item.label}
                </NavLink>
              ))}
                </div>
              </div>
            </nav>
          )}
          {isSignedIn && (
            <div className="layout-bar-actions" style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing.sm, flex: 'none' }}>
              <button
                type="button"
                onClick={() => void signOutEverywhere()}
                style={{
                  minHeight: '44px',
                  backgroundColor: 'transparent',
                  color: tokens.colors.whisper,
                  border: `1px solid ${tokens.colors.whisper}`,
                  borderRadius: tokens.radius.md,
                  padding: '0.6rem 1rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cerrar sesión
              </button>
              <UserButton />
            </div>
          )}
        </div>
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

      <footer
        className="layout-footer"
        style={{ borderTop: `1px solid ${tokens.colors.sereno}` }}
      >
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
