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

export default function Layout({ children }: { children: ReactNode }): JSX.Element {
  const { isSignedIn } = useAuth();
  const [apiState, setApiState] = useState<ApiState>('checking');
  const [menuOpen, setMenuOpen] = useState(false);
  const [shrunk, setShrunk] = useState(false);
  const menuDisclosureRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(([entry]) => {
      setShrunk(!entry.isIntersecting);
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const progress = progressRef.current;
    if (!progress || CSS.supports('animation-timeline: scroll()')) return;

    let ticking = false;
    const update = () => {
      const documentHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const value = documentHeight > 0 ? Math.min(window.scrollY / documentHeight, 1) : 0;
      progress.style.scale = `${value} 1`;
      ticking = false;
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const closeMenu = () => setMenuOpen(false);

  return (
    <div
      className="layout-root"
      style={{
        position: 'relative',
        fontFamily: tokens.fonts.body,
        backgroundColor: tokens.colors.whisper,
        color: tokens.colors.musgo,
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <style>{`
        @keyframes layout-reading-progress {
          from { scale: 0 1; }
          to { scale: 1 1; }
        }
        .layout-root,
        .layout-root *,
        .layout-root *::before,
        .layout-root *::after {
          box-sizing: border-box;
        }
        .layout-sentinel {
          position: absolute;
          top: 0;
          left: 0;
          width: 1px;
          height: 60px;
          pointer-events: none;
        }
        .layout-progress {
          position: fixed;
          inset: 0 0 auto;
          z-index: 50;
          height: 3px;
          scale: 0 1;
          transform-origin: left center;
          background: linear-gradient(90deg, ${tokens.colors.peridot}, ${tokens.colors.fairway});
        }
        @supports (animation-timeline: scroll()) {
          .layout-progress {
            animation: layout-reading-progress linear both;
            animation-timeline: scroll(root);
          }
        }
        .layout-header {
          position: sticky;
          top: 0;
          z-index: 40;
          background: rgba(255, 255, 255, 0.88);
          -webkit-backdrop-filter: blur(16px);
          backdrop-filter: blur(16px);
          border-bottom: 1px solid ${tokens.colors.sereno};
          transition: box-shadow 300ms ease-out, border-color 300ms ease-out;
        }
        .layout-header[data-shrunk] {
          border-bottom-color: rgba(50, 129, 97, 0.28);
          box-shadow: 0 8px 30px -12px rgba(56, 69, 67, 0.28);
        }
        .layout-bar {
          width: 100%;
          max-width: ${tokens.shell.maxWidth};
          height: 72px;
          margin: 0 auto;
          padding: 0 ${tokens.shell.gutter};
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: clamp(0.75rem, 2vw, 1.5rem);
          transition: height 300ms ease-out;
        }
        .layout-header[data-shrunk] .layout-bar {
          height: 52px;
        }
        .layout-brand {
          display: inline-flex;
          flex: none;
          align-items: center;
          gap: 0.6rem;
          color: ${tokens.colors.musgo};
          text-decoration: none;
          transform-origin: left center;
          transition: transform 300ms ease-out;
        }
        .layout-header[data-shrunk] .layout-brand {
          transform: scale(0.9);
        }
        .layout-brand-name {
          font-family: ${tokens.fonts.display};
          font-size: 1.05rem;
          line-height: 1.1;
          font-weight: 400;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          white-space: nowrap;
        }
        .layout-brand-ball {
          width: 16px;
          height: 16px;
          flex: none;
          border-radius: 50%;
          background: radial-gradient(circle at 35% 30%, #F8F86A 0%, ${tokens.colors.pelota} 45%, #C6C61F 100%);
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
        }
        .layout-desktop-nav {
          display: flex;
          flex: 1 1 auto;
          align-items: center;
          justify-content: center;
          gap: 0.25rem;
          min-width: 0;
        }
        .layout-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
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
        .layout-link:hover,
        .layout-link[aria-current="page"] {
          background-color: ${tokens.colors.whisper};
          color: ${tokens.colors.musgo};
        }
        .layout-link[aria-current="page"] {
          color: ${tokens.colors.peridot};
        }
        @media (min-width: 56.001rem) {
          .layout-header[data-shrunk] .layout-desktop-nav .layout-link {
            min-height: 36px;
            padding-inline: 0.7rem;
          }
        }
        .layout-actions {
          display: flex;
          flex: none;
          align-items: center;
        }
        .layout-mobile-disclosure {
          display: none;
        }
        .layout-focus:focus-visible,
        .layout-header :focus-visible,
        .layout-footer :focus-visible {
          outline: 2px solid ${tokens.colors.peridot};
          outline-offset: 3px;
        }
        @media (max-width: 56rem) {
          .layout-bar {
            gap: 0.5rem;
          }
          .layout-brand {
            flex: 1 1 auto;
            min-width: 0;
          }
          .layout-brand-name {
            overflow: hidden;
            font-size: clamp(0.82rem, 4vw, 1.05rem);
            text-overflow: ellipsis;
          }
          .layout-desktop-nav {
            display: none;
          }
          .layout-mobile-disclosure {
            display: block;
            flex: none;
          }
          .layout-desktop-actions {
            display: none;
          }
          .layout-mobile-topline {
            display: flex;
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
          .layout-mobile-disclosure[data-open="true"] .layout-burger span:first-child {
            transform: translateY(5px) rotate(45deg);
          }
          .layout-mobile-disclosure[data-open="true"] .layout-burger span:nth-child(2) {
            opacity: 0;
          }
          .layout-mobile-disclosure[data-open="true"] .layout-burger span:last-child {
            transform: translateY(-5px) rotate(-45deg);
          }
          .layout-mobile-panel {
            display: grid;
            grid-template-rows: 0fr;
            opacity: 0;
            visibility: hidden;
            transition: grid-template-rows 250ms ease, opacity 200ms ease, visibility 200ms;
          }
          .layout-mobile-disclosure[data-open="true"] .layout-mobile-panel {
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
            padding: 0.5rem 0 0.8rem;
            list-style: none;
          }
          .layout-mobile-links .layout-link {
            justify-content: flex-start;
            min-height: 44px;
            padding: 0 0.85rem;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .layout-root *,
          .layout-root *::before,
          .layout-root *::after {
            scroll-behavior: auto !important;
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>

      <div ref={sentinelRef} className="layout-sentinel" aria-hidden="true" />
      <div ref={progressRef} className="layout-progress" aria-hidden="true" />

      <header className="layout-header" data-shrunk={shrunk ? '' : undefined}>
        <nav className="layout-bar" aria-label="Principal">
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
            <div
              ref={menuDisclosureRef}
              className="layout-mobile-disclosure"
              data-open={menuOpen}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  closeMenu();
                }
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape' && menuOpen) {
                  closeMenu();
                  menuButtonRef.current?.focus();
                }
              }}
            >
              <div className="layout-mobile-topline">
                <button
                  ref={menuButtonRef}
                  type="button"
                  className="layout-menu-button layout-focus"
                  aria-expanded={menuOpen}
                  aria-controls="layout-mobile-panel"
                  onClick={() => setMenuOpen((open) => !open)}
                >
                  <span className="layout-burger" aria-hidden="true">
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
              <div
                id="layout-mobile-panel"
                className="layout-mobile-panel"
                aria-hidden={!menuOpen}
              >
                <div className="layout-mobile-panel-inner">
                  <ul className="layout-mobile-links">
                    {NAV.map((item) => (
                      <li key={item.to}>
                        <NavLink
                          to={item.to}
                          end={'end' in item ? item.end : false}
                          className="layout-link layout-focus"
                          onClick={closeMenu}
                        >
                          {item.label}
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {isSignedIn && (
            <div className="layout-actions layout-desktop-actions">
              <UserButton />
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
