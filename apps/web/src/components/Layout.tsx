import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { UserButton, useAuth } from '@clerk/react';
import { BottomNavigation, BottomNavigationAction, Paper, ThemeProvider, createTheme } from '@mui/material';
import { Circle, Home, type LucideIcon } from 'lucide-react';
import { api } from '../lib/api';

const NAV: ReadonlyArray<{
  to: string;
  label: string;
  end?: boolean;
  icon: LucideIcon;
}> = [
  { to: '/', label: 'Inicio', end: true, icon: Home },
];

type ApiState = 'checking' | 'ok' | 'down';

const API_LABEL: Record<ApiState, string> = {
  checking: 'Conectando con la API…',
  ok: 'API en línea',
  down: 'API no disponible',
};

const API_DOT: Record<ApiState, string> = {
  checking: 'bg-sereno',
  ok: 'bg-peridot',
  down: 'bg-error',
};

// Tema MUI solo para el dock mobile: verde Wimbledon en el item activo.
const temaMui = createTheme({
  palette: {
    primary: { main: '#006B3F' },
    text: { secondary: '#5A6661' },
  },
  typography: { fontFamily: '"Archivo", system-ui, sans-serif' },
});

// Layout comun: cabecera verde Wimbledon de alto fijo con la marca y navegacion
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
    <div className="font-body bg-whisper text-musgo min-h-dvh flex flex-col">
      <header className="sticky top-0 z-40 bg-wimbledon border-b border-white/15">
        <nav
          className="w-full max-w-[1400px] h-16 mx-auto px-[clamp(1rem,4vw,2.5rem)] flex items-center gap-[clamp(0.75rem,2vw,1.5rem)]"
          aria-label="Principal"
        >
          <Link
            to="/"
            aria-label="Tenis Ranch Club — Inicio"
            className="inline-flex flex-1 min-w-0 items-center justify-center gap-3 text-white no-underline focus-visible:outline-2 focus-visible:outline-pelota focus-visible:outline-offset-[3px]"
          >
            <span aria-hidden="true" className="inline-flex items-center justify-center text-pelota">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                <path d="M12 2C12 2 8 8 8 12C8 16 12 22 12 22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M12 2C12 2 16 8 16 12C16 16 12 22 12 22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
            </span>
            <span className="flex flex-col leading-[1]">
              <span className="font-display text-[0.9rem] font-light tracking-[0.15em] uppercase text-white/90">
                Tenis
              </span>
              <span className="font-display text-[1.5rem] font-bold tracking-[0.05em] uppercase">
                Ranch Club
              </span>
            </span>
          </Link>

          {isSignedIn && (
            <div className="hidden nav:flex flex-none items-center gap-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={'end' in item ? item.end : false}
                  className={({ isActive }) =>
                    `inline-flex items-center min-h-10 px-3.5 rounded-[0.65rem] text-[0.9rem] font-semibold no-underline whitespace-nowrap transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-pelota focus-visible:outline-offset-[3px] ${
                      isActive
                        ? 'bg-white/25 text-white'
                        : 'text-white/85 hover:bg-white/15 hover:text-white'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          )}

          <div className="flex flex-none items-center">
            <UserButton />
          </div>
        </nav>
      </header>

      <main className="flex-1 w-full max-w-[1400px] mx-auto py-6 px-[clamp(1rem,4vw,2.5rem)] pb-10">
        {children}
      </main>

      {isSignedIn && (
        <ThemeProvider theme={temaMui}>
          <Paper
            component="nav"
            className="flex nav:hidden fixed left-0 right-0 bottom-0 z-45 rounded-none pb-[env(safe-area-inset-bottom)]"
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

      <footer className="border-t border-sereno pb-[calc(4.5rem+env(safe-area-inset-bottom))] nav:pb-0">
        <div className="max-w-[1400px] mx-auto py-3 px-[clamp(1rem,4vw,2.5rem)] flex items-center justify-between gap-4 flex-wrap text-[0.85rem]">
          <span>Tenis Ranch Club · Tus canchas, tus turnos</span>
          <span role="status" className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={`w-2.5 h-2.5 rounded-full ${API_DOT[apiState]}`}
            />
            {API_LABEL[apiState]}
          </span>
        </div>
      </footer>
    </div>
  );
}
