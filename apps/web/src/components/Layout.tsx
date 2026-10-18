import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { UserButton, useAuth } from '@clerk/react';
import { api } from '../lib/api';
import { useSignOut } from '../lib/useSignOut';
import { tokens } from '../styles/tokens';

// Navegacion principal del club: misma en todas las paginas con sesion.
const NAV = [
  { to: '/', label: 'Inicio', end: true },
  { to: '/turnos', label: 'Turnos', end: false },
  { to: '/mis-turnos', label: 'Mis turnos', end: false },
  { to: '/mis-cuotas', label: 'Mis cuotas', end: false },
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
          style={{
            maxWidth: tokens.shell.maxWidth,
            margin: '0 auto',
            padding: `${tokens.spacing.sm} ${tokens.spacing.lg}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: tokens.spacing.md,
            flexWrap: 'wrap',
          }}
        >
          <Link
            to="/"
            aria-label="Tenis Ranch Club — Inicio"
            style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', textDecoration: 'none' }}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing.sm }}>
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
        {isSignedIn && (
          <nav
            aria-label="Principal"
            className="layout-nav"
            style={{
              maxWidth: tokens.shell.maxWidth,
              margin: '0 auto',
              padding: `0 ${tokens.spacing.lg} ${tokens.spacing.sm}`,
              display: 'flex',
              gap: tokens.spacing.xs,
              flexWrap: 'wrap',
            }}
          >
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                style={({ isActive }) => ({
                  minHeight: '44px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  borderRadius: tokens.radius.pill,
                  padding: '0.5rem 1rem',
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
          </nav>
        )}
      </header>

      <main
        style={{
          flex: 1,
          width: '100%',
          maxWidth: tokens.shell.maxWidth,
          margin: '0 auto',
          padding: `${tokens.spacing.lg} ${tokens.spacing.lg} ${tokens.spacing.xl}`,
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
            padding: `${tokens.spacing.sm} ${tokens.spacing.lg}`,
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
