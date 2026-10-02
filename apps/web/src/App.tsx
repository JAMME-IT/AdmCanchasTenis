import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import Home from './pages/Home';
import Ingresar from './pages/Ingresar';
import Registro from './pages/Registro';
import CompletarPerfil from './pages/CompletarPerfil';

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
      <Route path="/" element={<Home />} />
      <Route path="/ingresar/*" element={<Ingresar />} />
      <Route path="/registro/*" element={<Registro />} />
      <Route
        path="/completar-perfil"
        element={
          <RequireSession>
            <CompletarPerfil />
          </RequireSession>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
