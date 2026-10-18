import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import { ApiError, api, type Usuario } from '../lib/api';
import { EmptyState, ErrorCard, Skeleton } from '../components/Feedback';

// Palette: refined green #384543, whisper white #F5F3EF,
// peridot accent #328161, serene gray #8A9A93.
const pageStyle: React.CSSProperties = {
  fontFamily: 'system-ui, sans-serif',
  backgroundColor: '#F5F3EF',
  color: '#384543',
  minHeight: '100dvh',
  padding: '3rem 1.5rem',
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

const buttonPrimary: React.CSSProperties = {
  backgroundColor: '#328161',
  color: '#FFFFFF',
  border: 'none',
  borderRadius: '0.75rem',
  padding: '0.6rem 1rem',
  fontWeight: 600,
  cursor: 'pointer',
};

export default function Home(): JSX.Element {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [perfilIncompleto, setPerfilIncompleto] = useState(false);
  const [cargandoPerfil, setCargandoPerfil] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load the connected profile once the session is ready.
  const cargarPerfil = useCallback(async () => {
    setCargandoPerfil(true);
    setError(null);
    setPerfilIncompleto(false);
    try {
      const token = await getToken();
      const perfil = await api.me(token);
      setUsuario(perfil);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 403) {
        setPerfilIncompleto(true);
      } else {
        setError(caught instanceof ApiError ? caught.message : 'No se pudo cargar el perfil');
      }
    } finally {
      setCargandoPerfil(false);
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
        <div>
          <h1 style={{ margin: 0 }}>Tenis Ranch Club</h1>
          <p style={{ margin: '0.25rem 0 0' }}>Gestión simple del club.</p>
        </div>

        {perfilIncompleto && (
          <p>
            Tu perfil está incompleto. <Link to="/completar-perfil">Completar perfil</Link>
          </p>
        )}

        {/* Connected section: profile loaded from GET /auth/me. */}
        <section style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Mi perfil</h2>
          {cargandoPerfil && !usuario ? (
            <Skeleton rows={2} label="Cargando tu perfil…" />
          ) : error ? (
            <ErrorCard message={error} onRetry={() => void cargarPerfil()} />
          ) : usuario ? (
            <>
              <p>
                Hola, {usuario.nombre} {usuario.apellido}
              </p>
              <ul>
                <li>Usuario: {usuario.username}</li>
                <li>Email: {usuario.email}</li>
                <li>Rol: {usuario.rol ?? 'sin asignar'}</li>
                <li>Número de socio: {usuario.numeroSocio ?? '—'}</li>
                <li>Estado: {usuario.estadoActual}</li>
              </ul>
            </>
          ) : (
            <EmptyState message="Todavía no se cargó tu perfil." />
          )}
        </section>

        {/* Blocked section: no new endpoints, all actions disabled. */}
        <section style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Panel del club</h2>
          <p>Estas funciones están en preparación y todavía no se conectan.</p>
          <div style={gridStyle}>
            <article style={cardStyle}>
              <h3>Turnos y reserva</h3>
              <p>Mirá la disponibilidad real del día y elegí tu horario.</p>
              <Link
                to="/turnos"
                style={{ ...buttonPrimary, display: 'inline-block', textDecoration: 'none' }}
              >
                Ver turnos
              </Link>
            </article>
            <article style={cardStyle}>
              <h3>Mis turnos</h3>
              <p>Revisá tus turnos vigentes, cancelá o mirá tu historial.</p>
              <Link
                to="/mis-turnos"
                style={{ ...buttonPrimary, display: 'inline-block', textDecoration: 'none' }}
              >
                Ver mis turnos
              </Link>
            </article>
            <article style={cardStyle}>
              <h3>Mis cuotas</h3>
              <p>Mirá tus cuotas con lo pagado, el saldo y cada pago.</p>
              <Link
                to="/mis-cuotas"
                style={{ ...buttonPrimary, display: 'inline-block', textDecoration: 'none' }}
              >
                Ver mis cuotas
              </Link>
            </article>
            <article style={cardStyle}>
              <h3>Panel admin</h3>
              <p>Turnos con filtros, pagos y reportes del club.</p>
              <Link
                to="/admin"
                style={{ ...buttonPrimary, display: 'inline-block', textDecoration: 'none' }}
              >
                Abrir panel
              </Link>
            </article>
            <article style={cardStyle}>
              <h3>Reportes</h3>
              <p>Estadísticas e ingresos, dentro del panel admin.</p>
              <Link
                to="/admin"
                style={{ ...buttonPrimary, display: 'inline-block', textDecoration: 'none' }}
              >
                Ver reportes
              </Link>
            </article>
          </div>
        </section>
      </div>
    </main>
  );
}
