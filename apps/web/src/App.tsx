import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import Layout from './components/Layout';
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

export default function App(): JSX.Element {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <Layout>
            <Home />
          </Layout>
        }
      />
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
            <Layout>
              <Admin />
            </Layout>
          </RequireSession>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
