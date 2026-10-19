import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import { ApiError, api, type Usuario } from '../lib/api';
import { Skeleton } from '../components/Feedback';

// Palette: refined green #384543, whisper white #F5F3EF,
// peridot accent #328161, serene gray #8A9A93.
const pageStyle: React.CSSProperties = {
  fontFamily: 'system-ui, sans-serif',
  backgroundColor: '#F5F3EF',
  color: '#384543',
  minHeight: '100dvh',
  padding: '1rem 1.5rem 3rem',
};

const shellStyle: React.CSSProperties = {
  maxWidth: '960px',
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '1.5rem',
};

const cardStyle: React.CSSProperties = {
  backgroundColor: '#FFFFFF',
  border: '1px solid #8A9A93',
  borderRadius: '1rem',
  padding: '1.5rem',
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: '1rem',
};

const heroStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '1.5rem',
  padding: '2rem 0',
};

const heroAvatarStyle: React.CSSProperties = {
  width: '5rem',
  height: '5rem',
  borderRadius: '50%',
  flex: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: '"Archivo Black", "Archivo", system-ui, sans-serif',
  fontSize: '1.8rem',
  fontWeight: 400,
  color: '#FFFFFF',
  background: 'radial-gradient(circle at 35% 30%, #3FA67E 0%, #328161 55%, #1F6B45 100%)',
  boxShadow: '0 4px 12px rgba(56, 69, 67, 0.35)',
};

const heroInfoStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.3rem',
};

const heroGreetingStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '2rem',
  fontWeight: 800,
  lineHeight: 1.1,
  color: '#384543',
};

const heroNameStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '1.1rem',
  fontWeight: 500,
  color: '#5A6661',
};

export default function Home(): JSX.Element {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [perfilIncompleto, setPerfilIncompleto] = useState(false);

  // Load the connected profile once the session is ready.
  const cargarPerfil = useCallback(async () => {
    setPerfilIncompleto(false);
    try {
      const token = await getToken();
      const perfil = await api.me(token);
      setUsuario(perfil);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 403) {
        setPerfilIncompleto(true);
      }
    }
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return;
    }
    void cargarPerfil();
  }, [cargarPerfil, isLoaded, isSignedIn]);

  if (!isLoaded) {
    return (
      <main style={pageStyle}>
        <Skeleton rows={2} label="Cargando tu sesión…" />
      </main>
    );
  }

  // Guest home: Layout already shows the API status dot in the footer.
  if (!isSignedIn) {
    return (
      <main style={pageStyle}>
        <div style={shellStyle}>
          <section style={cardStyle}>
            <h1>Tenis Ranch Club</h1>
            <p>Gestión simple del club: tu sesión, tu perfil y tus turnos.</p>
            <p>
              <Link to="/ingresar">Ingresar</Link> {'·'} <Link to="/registro">Crear cuenta</Link>
            </p>
          </section>
        </div>
      </main>
    );
  }

  // Session home: Layout provides the header nav and footer status dot.
  return (
    <main style={pageStyle}>
      <div style={shellStyle}>
        {perfilIncompleto && (
          <p>
            Tu perfil está incompleto. <Link to="/completar-perfil">Completar perfil</Link>
          </p>
        )}

        {/* Hero de bienvenida con perfil */}
        {usuario && (
          <div style={heroStyle}>
            <span style={heroAvatarStyle} aria-hidden="true">
              {(usuario.nombre.charAt(0) + usuario.apellido.charAt(0)).toUpperCase()}
            </span>
            <div style={heroInfoStyle}>
              <p style={heroGreetingStyle}>Hola, {usuario.nombre}</p>
              <p style={heroNameStyle}>@{usuario.username}</p>
            </div>
          </div>
        )}

        {/* Panel del club: acciones directas */}
        <div>
          <style>{`
            .club-card {
              display: block;
              background-color: #FFFFFF;
              border: 1px solid #8A9A93;
              border-radius: 1rem;
              padding: 1.5rem;
              text-decoration: none;
              color: #384543;
              transition: transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease;
              cursor: pointer;
              position: relative;
              overflow: hidden;
            }
            .club-card::before {
              content: '';
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              height: 4px;
              background: var(--card-accent, #328161);
              transition: height 200ms ease;
            }
            .club-card:hover {
              transform: translateY(-4px);
              box-shadow: 0 8px 20px rgba(56, 69, 67, 0.15);
              border-color: var(--card-accent, #328161);
            }
            .club-card:hover::before {
              height: 6px;
            }
            .club-card:hover .club-card-icon {
              transform: scale(1.1);
            }
            .club-card:active {
              transform: translateY(-2px);
              box-shadow: 0 4px 12px rgba(56, 69, 67, 0.12);
            }
            .club-card-icon {
              width: 2.5rem;
              height: 2.5rem;
              border-radius: 0.75rem;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 1.3rem;
              margin-bottom: 0.75rem;
              background: var(--card-accent, #328161);
              color: #FFFFFF;
              transition: transform 200ms ease;
            }
            .club-card h3 {
              margin: 0 0 0.5rem 0;
              font-size: 1.2rem;
              font-weight: 700;
              transition: color 200ms ease;
            }
            .club-card:hover h3 {
              color: var(--card-accent, #328161);
            }
            .club-card p {
              margin: 0;
              color: #5A6661;
              line-height: 1.5;
            }
          `}</style>
          <h2 style={{ marginBottom: '0.5rem' }}>Panel del club</h2>
          <div style={gridStyle}>
            <Link to="/turnos" className="club-card" style={{ '--card-accent': '#328161' } as React.CSSProperties}>
              <div className="club-card-icon">📅</div>
              <h3>Turnos y reserva</h3>
              <p>Mirá la disponibilidad real del día y elegí tu horario.</p>
            </Link>
            <Link to="/mis-turnos" className="club-card" style={{ '--card-accent': '#21875A' } as React.CSSProperties}>
              <div className="club-card-icon">🎾</div>
              <h3>Mis turnos</h3>
              <p>Revisá tus turnos vigentes, cancelá o mirá tu historial.</p>
            </Link>
            <Link to="/mis-cuotas" className="club-card" style={{ '--card-accent': '#3FA67E' } as React.CSSProperties}>
              <div className="club-card-icon">💰</div>
              <h3>Mis cuotas</h3>
              <p>Mirá tus cuotas con lo pagado, el saldo y cada pago.</p>
            </Link>
            {usuario?.rol === 'admin' && (
              <>
                <Link to="/admin" className="club-card" style={{ '--card-accent': '#384543' } as React.CSSProperties}>
                  <div className="club-card-icon">🛡️</div>
                  <h3>Panel admin</h3>
                  <p>Turnos con filtros, pagos y reportes del club.</p>
                </Link>
                <Link to="/admin" className="club-card" style={{ '--card-accent': '#8A9A93' } as React.CSSProperties}>
                  <div className="club-card-icon">📊</div>
                  <h3>Reportes</h3>
                  <p>Estadísticas e ingresos, dentro del panel admin.</p>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
