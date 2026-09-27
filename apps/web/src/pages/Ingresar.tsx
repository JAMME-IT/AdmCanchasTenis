import { SignIn } from '@clerk/react';

export default function Ingresar(): JSX.Element {
  return (
    <main style={{ display: 'grid', placeItems: 'center', padding: '3rem' }}>
      <SignIn routing="path" path="/ingresar" signUpUrl="/registro" fallbackRedirectUrl="/" />
    </main>
  );
}
