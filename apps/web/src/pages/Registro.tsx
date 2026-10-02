import { SignUp } from '@clerk/react';

export default function Registro(): JSX.Element {
  return (
    <main style={{ display: 'grid', placeItems: 'center', padding: '3rem' }}>
      <SignUp
        routing="path"
        path="/registro"
        signInUrl="/ingresar"
        fallbackRedirectUrl="/completar-perfil"
      />
    </main>
  );
}
