import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { UserButton, useAuth } from '@clerk/react';
import { ApiError, api, type Usuario } from '../lib/api';
import { useSignOut } from '../lib/useSignOut';
import BloqueoTemporal from '../components/BloqueoTemporal';

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

const disabledCardStyle: React.CSSProperties = {
  ...cardStyle,
  opacity: 0.95,
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

const buttonGhost: React.CSSProperties = {
  backgroundColor: 'transparent',
  color: '#384543',
  border: '1px solid #8A9A93',
  borderRadius: '0.75rem',
  padding: '0.6rem 1rem',
  fontWeight: 600,
  cursor: 'pointer',
};

export default function Home(): JSX.Element {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const signOutEverywhere = useSignOut();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [perfilIncompleto, setPerfilIncompleto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<string>('Todavía no se controló la API.');
  const [checking, setChecking] = useState(false);

  // Load the connected profile once the session is ready.
  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return;
    }
    let active = true;
    void (async () => {
      try {
        const token = await getToken();
        const perfil = await api.me(token);
        if (active) {
          setUsuario(perfil);
        }
      } catch (caught) {
        if (!active) {
          return;
        }
        if (caught instanceof ApiError && caught.status === 403) {
          setPerfilIncompleto(true);
        } else {
          setError(caught instanceof ApiError ? caught.message : 'No se pudo cargar el perfil');
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [getToken, isLoaded, isSignedIn]);

  // Check the already existing health endpoint.
  async function checkHealth(): Promise<void> {
    setChecking(true);
    try {
      const data = await api.health();
      setHealth(`Estado de la API: ${data.status}`);
    } catch {
      setHealth('No se pudo alcanzar la API. ¿Está corriendo en el puerto 3000?');
    } finally {
      setChecking(false);
    }
  }

  if (!isLoaded) {
    return (
      <main style={pageStyle}>
        <p>Cargando...</p>
      </main>
    );
  }

  if (!isSignedIn) {
    return (
      <main style={pageStyle}>
        <div style={shellStyle}>
          <section style={cardStyle}>
            <h1>AdmCanchasTenis</h1>
            <p>Gestión simple del club: tu sesión, tu perfil y el estado de la API.</p>
            <p>
              <Link to="/ingresar">Ingresar</Link> {'·'} <Link to="/registro">Crear cuenta</Link>
            </p>
            <button type="button" onClick={checkHealth} disabled={checking} style={buttonPrimary}>
              {checking ? 'Controlando...' : 'Controlar salud'}
            </button>
            <p>{health}</p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <div style={shellStyle}>
        {/* Connected header: session controls stay active. */}
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ margin: 0 }}>AdmCanchasTenis</h1>
            <p style={{ margin: '0.25rem 0 0' }}>Gestión simple del club.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button type="button" onClick={() => void signOutEverywhere()} style={buttonGhost}>
              Cerrar sesión
            </button>
            <UserButton />
          </div>
        </header>

        {perfilIncompleto && (
          <p>
            Tu perfil está incompleto. <Link to="/completar-perfil">Completar perfil</Link>
          </p>
        )}
        {error && <p style={{ color: 'crimson' }}>{error}</p>}

        {/* Connected section: profile loaded from GET /auth/me. */}
        <section style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Mi perfil</h2>
          {usuario ? (
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
            <p>Todavía no se cargó tu perfil.</p>
          )}
        </section>

        {/* Connected section: health check against GET /health. */}
        <section style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Salud de la API</h2>
          <button type="button" onClick={checkHealth} disabled={checking} style={buttonPrimary}>
            {checking ? 'Controlando...' : 'Controlar salud'}
          </button>
          <p style={{ marginBottom: 0 }}>{health}</p>
        </section>

        {/* Blocked section: no new endpoints, all actions disabled. */}
        <section style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Panel del club</h2>
          <p>Estas funciones están en preparación y todavía no se conectan.</p>
          <div style={gridStyle}>
            <article style={disabledCardStyle}>
              <BloqueoTemporal motivo="API pendiente" />
              <h3>Turnos y reserva</h3>
              <p>Falta conectar la API de turnos para reservar cancha.</p>
              <button type="button" disabled style={buttonPrimary}>
                Reservar turno
              </button>
            </article>
            <article style={disabledCardStyle}>
              <BloqueoTemporal motivo="API pendiente" />
              <h3>Panel admin</h3>
              <p>Falta conectar socios, morosos y caja del backend.</p>
              <button type="button" disabled style={buttonPrimary}>
                Abrir panel
              </button>
            </article>
            <article style={disabledCardStyle}>
              <BloqueoTemporal motivo="Stitch pendiente" />
              <h3>Reportes</h3>
              <p>Falta definir las pantallas Stitch para ver los reportes.</p>
              <button type="button" disabled style={buttonPrimary}>
                Ver reportes
              </button>
            </article>
          </div>
        </section>
      </div>
    </main>
  );
}
