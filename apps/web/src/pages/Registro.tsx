import { SignUp } from '@clerk/react';
import AuthMarca, { aparienciaAuth } from '../components/AuthMarca';

export default function Registro(): JSX.Element {
  return (
    <AuthMarca
      tituloBienvenida="Creá tu cuenta"
      textoBienvenida="Registrate para reservar cancha y gestionar tu perfil de socio."
    >
      <SignUp
        routing="path"
        path="/registro"
        signInUrl="/ingresar"
        fallbackRedirectUrl="/completar-perfil"
        appearance={aparienciaAuth}
      />
    </AuthMarca>
  );
}
