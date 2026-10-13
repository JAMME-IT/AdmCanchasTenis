import { SignIn } from '@clerk/react';
import AuthMarca, { aparienciaAuth } from '../components/AuthMarca';

export default function Ingresar(): JSX.Element {
  return (
    <AuthMarca
      tituloBienvenida="Bienvenido a Tenis Ranch Club"
      textoBienvenida="Entrá para ver tus turnos y mantener tu perfil al día."
    >
      <SignIn
        routing="path"
        path="/ingresar"
        signUpUrl="/registro"
        fallbackRedirectUrl="/"
        appearance={aparienciaAuth}
      />
    </AuthMarca>
  );
}
