import { Navigate, Route, Routes } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/react';
import Layout from './components/Layout';
import { api } from './lib/api';
import Home from './pages/Home';
import Ingresar from './pages/Ingresar';
import Registro from './pages/Registro';
import CompletarPerfil from './pages/CompletarPerfil';
import Admin from './pages/Admin';
import Turnos from './pages/Turnos';
import MisTurnos from './pages/MisTurnos';
import MisCuotas from './pages/MisCuotas';

function RequireSession({ children }: { children: JSX.Element }): JSX.Element {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) {
    return <p>Loading session...</p>;
  }
  if (!isSignedIn) {
    return <Navigate to="/ingresar" replace />;
  }
  return children;
}

// Blindaje de rutas admin: requiere sesion y rol admin. Un no-admin que
// escribe /admin es expulsado a / (la API igualmente enforcea 403; esto
// es UX para que ni la pantalla vea).
function RequireAdmin({ children }: { children: JSX.Element }): JSX.Element {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  // undefined = todavia cargando el rol.
  const [rol, setRol] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    if (!isLoaded || !isSignedIn) {
      return;
    }
    void (async () => {
      try {
        const token = await getToken();
        if (!token) {
          if (active) setRol(null);
          return;
        }
        const perfil = await api.me(token);
        if (active) setRol(perfil.rol);
      } catch {
        if (active) setRol(null);
      }
    })();
    return () => {
      active = false;
    };
  }, [isLoaded, isSignedIn, getToken]);

  if (!isLoaded || !isSignedIn) {
    return <Navigate to="/ingresar" replace />;
  }
  if (rol === undefined) {
    return <p role="status">Cargando…</p>;
  }
  if (rol !== 'admin') {
    return <Navigate to="/" replace />;
  }
  return children;
}

// La primera pantalla es el login: invitados van a /ingresar
// (el widget de Clerk es path-based y solo renderiza ahi).
function HomeRoute(): JSX.Element {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) {
    return <p>Loading session...</p>;
  }
  if (!isSignedIn) {
    return <Navigate to="/ingresar" replace />;
  }
  return (
    <Layout>
      <Home />
    </Layout>
  );
}

export default function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<HomeRoute />} />
      <Route path="/ingresar/*" element={<Ingresar />} />
      <Route path="/registro/*" element={<Registro />} />
      <Route
        path="/completar-perfil"
        element={
          <RequireSession>
            <Layout>
              <CompletarPerfil />
            </Layout>
          </RequireSession>
        }
      />
      <Route
        path="/turnos"
        element={
          <RequireSession>
            <Layout>
              <Turnos />
            </Layout>
          </RequireSession>
        }
      />
      <Route
        path="/mis-turnos"
        element={
          <RequireSession>
            <Layout>
              <MisTurnos />
            </Layout>
          </RequireSession>
        }
      />
      <Route
        path="/mis-cuotas"
        element={
          <RequireSession>
            <Layout>
              <MisCuotas />
            </Layout>
          </RequireSession>
        }
      />
      <Route
        path="/admin"
        element={
          <RequireSession>
            <RequireAdmin>
              <Layout>
                <Admin />
              </Layout>
            </RequireAdmin>
          </RequireSession>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
