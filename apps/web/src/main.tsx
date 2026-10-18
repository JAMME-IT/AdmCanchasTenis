import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/react';
import { esES } from '@clerk/localizations';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { tokens } from './styles/tokens';

// Base global minima: fondo whisper + texto musgo en las paginas con
// Layout (login/registro ya resetean el body desde AuthMarca).
document.body.style.margin = '0';
document.body.style.backgroundColor = tokens.colors.whisper;
document.body.style.color = tokens.colors.musgo;
document.body.style.fontFamily = tokens.fonts.body;

// Localización rioplatense: parte de esES y overridea solo las strings
// visibles del flujo sign-in/sign-up que estaban en peninsular o en
// usted ("Regístrese", "Rellene", "Has olvidado"). Cada clave fue
// verificada contra node_modules/@clerk/localizations/dist/es-ES.js
// y contra el tipo LocalizationResource en
// node_modules/@clerk/shared/dist/types/localization.d.ts
// (el link "¿Olvidaste...?" vive en `formFieldAction__forgotPassword`).
// "Correo electrónico" y "Continuar" ya son neutras y quedan como están.
const localizacion: typeof esES = {
  ...esES,
  formFieldAction__forgotPassword: '¿Olvidaste tu contraseña?',
  formFieldInputPlaceholder__emailAddress:
    'Ingresá tu dirección de correo electrónico',
  formFieldInputPlaceholder__password: 'Ingresá tu contraseña',
  formFieldInputPlaceholder__firstName: 'Ingresá tu nombre',
  formFieldInputPlaceholder__lastName: 'Ingresá tu apellido',
  formFieldInputPlaceholder__username: 'Ingresá tu nombre de usuario',
  formFieldInputPlaceholder__phoneNumber: 'Ingresá tu número telefónico',
  signInEnterPasswordTitle: 'Ingresá tu contraseña',
  signIn: {
    ...esES.signIn,
    start: {
      ...esES.signIn?.start,
      title: 'Entrar',
      subtitle: 'para continuar a Tenis Ranch Club',
      actionText: '¿No tenés cuenta?',
      actionLink: 'Registrate',
    },
    password: {
      ...esES.signIn?.password,
      title: 'Ingresá tu contraseña',
      subtitle: 'para continuar a Tenis Ranch Club',
    },
    emailCode: {
      ...esES.signIn?.emailCode,
      title: 'Revisá tu correo electrónico',
      subtitle: 'para continuar a Tenis Ranch Club',
    },
  },
  signUp: {
    ...esES.signUp,
    start: {
      ...esES.signUp?.start,
      title: 'Creá tu cuenta',
      subtitle: 'para continuar en Tenis Ranch Club',
      subtitleCombined: 'para continuar en Tenis Ranch Club',
      actionText: '¿Ya tenés una cuenta?',
    },
    continue: {
      ...esES.signUp?.continue,
      title: 'Completá los campos faltantes',
      subtitle: 'para continuar a Tenis Ranch Club',
      actionText: '¿Tenés una cuenta?',
    },
    emailCode: {
      ...esES.signUp?.emailCode,
      title: 'Verificá tu correo electrónico',
      subtitle: 'para continuar a Tenis Ranch Club',
      formSubtitle:
        'Ingresá el código de verificación enviado a tu correo electrónico',
    },
  },
};

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element #root not found');
}

if (!PUBLISHABLE_KEY) {
  root.innerHTML =
    '<p style="font-family: system-ui; padding: 2rem">Missing VITE_CLERK_PUBLISHABLE_KEY in apps/web/.env</p>';
} else {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <ClerkProvider publishableKey={PUBLISHABLE_KEY} localization={localizacion}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ClerkProvider>
    </React.StrictMode>,
  );
}
