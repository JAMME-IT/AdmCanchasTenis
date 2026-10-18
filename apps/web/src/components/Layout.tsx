import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { UserButton, useAuth } from '@clerk/react';
import { BottomNavigation, BottomNavigationAction, Paper, ThemeProvider, createTheme } from '@mui/material';
import { CalendarDays, History, Home, ReceiptText, ShieldCheck, type LucideIcon } from 'lucide-react';
import { api } from '../lib/api';
import { tokens } from '../styles/tokens';

const NAV: ReadonlyArray<{
  to: string;
  label: string;
  end?: boolean;
  icon: LucideIcon;
}> = [
  { to: '/', label: 'Inicio', end: true, icon: Home },
  { to: '/turnos', label: 'Turnos', icon: CalendarDays },
  { to: '/mis-turnos', label: 'Mis turnos', icon: History },
  { to: '/mis-cuotas', label: 'Mis cuotas', icon: ReceiptText },
  { to: '/admin', label: 'Admin', icon: ShieldCheck },
];

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

// Tema MUI solo para el dock mobile: verde del club en el item activo.
const temaMui = createTheme({
  palette: {
    primary: { main: tokens.colors.peridot },
    text: { secondary: '#5A6661' },
  },
  typography: { fontFamily: tokens.fonts.body },
});

// Layout comun: cabecera blanca de alto fijo con la marca y navegacion
// centrada en desktop, dock inferior con tabs en mobile, contenido
// centrado y pie con el estado de la API.
export default function Layout({ children }: { children: ReactNode }): JSX.Element {
  const { isSignedIn, getToken } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [apiState, setApiState] = useState<ApiState>('checking');
  const [rol, setRol] = useState<string | null>(null);

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

  // El link Admin solo se muestra para rol admin (la API igualmente
  // enforcea 403; esto es puramente de UI).
  useEffect(() => {
    let active = true;
    if (!isSignedIn) {
      setRol(null);
      return;
    }
    void (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const perfil = await api.me(token);
        if (active) {
          setRol(perfil.rol);
        }
      } catch {
        if (active) {
          setRol(null);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [isSignedIn, getToken]);

  const dockValue =
    NAV.find((item) =>
      item.end ? location.pathname === item.to : location.pathname.startsWith(item.to),
    )?.to ?? false;

  const navItems = NAV.filter((item) => item.to !== '/admin' || rol === 'admin');

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
        .layout-actions {
          display: flex;
          flex: none;
          align-items: center;
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
          .layout-footer {
            /* El dock fixed tapa el pie: reservamos su alto. */
            padding-bottom: calc(4.5rem + env(safe-area-inset-bottom));
          }
        }
        /* Dock inferior mobile (MUI BottomNavigation). */
        .layout-dock {
          display: none;
        }
        @media (max-width: 56rem) {
          .layout-dock {
            display: flex;
            position: fixed;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 45;
            border-radius: 0;
            padding-bottom: env(safe-area-inset-bottom);
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
        <nav className="layout-bar" aria-label="Principal">
          <Link to="/" aria-label="Tenis Ranch Club — Inicio" className="layout-brand layout-focus">
            <span aria-hidden="true" className="layout-brand-ball" />
            <span className="layout-brand-name">Tenis Ranch Club</span>
          </Link>

          {isSignedIn && (
            <div className="layout-desktop-nav">
              {navItems.map((item) => (
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

          <div className="layout-actions">
            <UserButton />
          </div>
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

      {isSignedIn && (
        <ThemeProvider theme={temaMui}>
          <Paper
            component="nav"
            className="layout-dock"
            aria-label="Navegación mobile"
            elevation={8}
            sx={{ bgcolor: 'rgba(255,255,255,0.96)' }}
          >
            <BottomNavigation
              showLabels
              value={dockValue}
              onChange={(_event, value: string) => navigate(value)}
              sx={{ width: '100%', bgcolor: 'transparent' }}
            >
              {navItems.map((item) => (
                <BottomNavigationAction
                  key={item.to}
                  value={item.to}
                  label={item.label}
                  icon={<item.icon size={20} strokeWidth={2} />}
                />
              ))}
            </BottomNavigation>
          </Paper>
        </ThemeProvider>
      )}

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
