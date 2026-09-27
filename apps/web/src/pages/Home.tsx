import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { UserButton, useAuth } from '@clerk/react';
import { ApiError, api, type Usuario } from '../lib/api';
import { useSignOut } from '../lib/useSignOut';

export default function Home(): JSX.Element {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const signOutEverywhere = useSignOut();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [perfilIncompleto, setPerfilIncompleto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<string>('Not checked yet.');
  const [checking, setChecking] = useState(false);

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
          setError(caught instanceof ApiError ? caught.message : 'Could not load the profile');
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [getToken, isLoaded, isSignedIn]);

  async function checkHealth(): Promise<void> {
    setChecking(true);
    try {
      const data = await api.health();
      setHealth(`API status: ${data.status}`);
    } catch {
      setHealth('API unreachable. Is the API running on port 3000?');
    } finally {
      setChecking(false);
    }
  }

  if (!isLoaded) {
    return (
      <main style={{ fontFamily: 'system-ui, sans-serif', padding: '3rem' }}>
        <p>Loading...</p>
      </main>
    );
  }

  if (!isSignedIn) {
    return (
      <main style={{ fontFamily: 'system-ui, sans-serif', padding: '3rem', maxWidth: '640px' }}>
        <h1>AdmCanchasTenis</h1>
        <p>Tennis court administration.</p>
        <p>
          <Link to="/ingresar">Sign in</Link> {'·'} <Link to="/registro">Create account</Link>
        </p>
        <button type="button" onClick={checkHealth} disabled={checking}>
          {checking ? 'Checking...' : 'Fetch health'}
        </button>
        <p>{health}</p>
      </main>
    );
  }

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '3rem', maxWidth: '640px' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1>AdmCanchasTenis</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button type="button" onClick={() => void signOutEverywhere()}>
            Sign out
          </button>
          <UserButton />
        </div>
      </header>

      {perfilIncompleto && (
        <p>
          Your profile is incomplete. <Link to="/completar-perfil">Complete profile</Link>
        </p>
      )}
      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      {usuario && (
        <section>
          <h2>
            Welcome, {usuario.nombre} {usuario.apellido}
          </h2>
          <ul>
            <li>Username: {usuario.username}</li>
            <li>Email: {usuario.email}</li>
            <li>Role: {usuario.rol ?? 'none'}</li>
            <li>Member number: {usuario.numeroSocio ?? '—'}</li>
            <li>Status: {usuario.estadoActual}</li>
          </ul>
        </section>
      )}

      <button type="button" onClick={checkHealth} disabled={checking}>
        {checking ? 'Checking...' : 'Fetch health'}
      </button>
      <p>{health}</p>
    </main>
  );
}
