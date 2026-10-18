import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import { ApiError, api, type CompletarPerfilBody } from '../lib/api';
import { useSignOut } from '../lib/useSignOut';
import { tokens } from '../styles/tokens';

const EMPTY_FORM: CompletarPerfilBody = {
  username: '',
  nombre: '',
  apellido: '',
  telefono: '',
  dni: '',
};

type Campo = keyof CompletarPerfilBody;
type Errores = Partial<Record<Campo, string>>;

const ETIQUETAS: Record<Campo, string> = {
  username: 'Nombre de usuario',
  nombre: 'Nombre',
  apellido: 'Apellido',
  telefono: 'Teléfono (opcional)',
  dni: 'DNI',
};

function validar(form: CompletarPerfilBody): Errores {
  const errores: Errores = {};
  if (form.username.trim().length < 3) {
    errores.username =
      form.username.trim().length === 0
        ? 'El nombre de usuario es obligatorio.'
        : 'El nombre de usuario debe tener al menos 3 caracteres.';
  }
  if (form.nombre.trim().length === 0) {
    errores.nombre = 'El nombre es obligatorio.';
  }
  if (form.apellido.trim().length === 0) {
    errores.apellido = 'El apellido es obligatorio.';
  }
  if (form.dni.trim().length === 0) {
    errores.dni = 'El DNI es obligatorio.';
  }
  return errores;
}

const inputStyle: React.CSSProperties = {
  minHeight: '44px',
  borderRadius: tokens.radius.md,
  border: `1px solid ${tokens.colors.sereno}`,
  padding: '0.5rem 0.75rem',
  backgroundColor: tokens.colors.blanco,
  color: tokens.colors.musgo,
  fontFamily: 'inherit',
  fontSize: '1rem',
  width: '100%',
  boxSizing: 'border-box',
};

export default function CompletarPerfil(): JSX.Element {
  const { getToken } = useAuth();
  const signOutEverywhere = useSignOut();
  const navigate = useNavigate();
  const [form, setForm] = useState<CompletarPerfilBody>(EMPTY_FORM);
  const [errores, setErrores] = useState<Errores>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function update(campo: Campo, valor: string): void {
    setForm((previous) => ({ ...previous, [campo]: valor }));
    setErrores((previous) => {
      if (!(campo in previous)) {
        return previous;
      }
      const next = { ...previous };
      delete next[campo];
      return next;
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const invalidos = validar(form);
    setErrores(invalidos);
    if (Object.keys(invalidos).length > 0) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      await api.completarPerfil(token, form);
      navigate('/', { replace: true });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'No se pudo completar el perfil.');
    } finally {
      setSaving(false);
    }
  }

  function campo(id: Campo, props?: { required?: boolean; minLength?: number; maxLength?: number }): JSX.Element {
    const errorId = `completar-perfil-${id}-error`;
    const invalido = id in errores;
    return (
      <div>
        <label htmlFor={`completar-perfil-${id}`} style={{ display: 'grid', gap: '0.25rem', fontWeight: 600 }}>
          {ETIQUETAS[id]}
          <input
            id={`completar-perfil-${id}`}
            value={form[id] ?? ''}
            onChange={(event) => update(id, event.target.value)}
            aria-invalid={invalido}
            aria-describedby={invalido ? errorId : undefined}
            style={{
              ...inputStyle,
              borderColor: invalido ? tokens.colors.error : tokens.colors.sereno,
            }}
            {...props}
          />
        </label>
        {invalido && (
          <p id={errorId} role="alert" style={{ margin: '0.25rem 0 0', fontSize: '0.9rem', color: tokens.colors.error }}>
            {errores[id]}
          </p>
        )}
      </div>
    );
  }

  return (
    <section
      aria-labelledby="completar-perfil-titulo"
      style={{
        backgroundColor: tokens.colors.blanco,
        border: `1px solid ${tokens.colors.sereno}`,
        borderRadius: tokens.radius.lg,
        padding: tokens.spacing.lg,
        maxWidth: '480px',
        margin: '0 auto',
      }}
    >
      <p
        style={{
          margin: `0 0 ${tokens.spacing.sm}`,
          fontSize: '0.85rem',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: tokens.colors.sereno,
        }}
      >
        Club · Tu cuenta
      </p>
      <h1
        id="completar-perfil-titulo"
        style={{ margin: `0 0 ${tokens.spacing.xs}`, fontFamily: tokens.fonts.display, fontWeight: 400 }}
      >
        Completar perfil
      </h1>
      <p style={{ margin: `0 0 ${tokens.spacing.md}`, lineHeight: 1.5 }}>
        Las credenciales las gestiona Clerk. Solo faltan los datos del club.
      </p>
      <form onSubmit={(event) => void submit(event)} noValidate style={{ display: 'grid', gap: tokens.spacing.sm }}>
        {campo('username', { minLength: 3, maxLength: 50 })}
        {campo('nombre', { maxLength: 100 })}
        {campo('apellido', { maxLength: 100 })}
        {campo('telefono', { maxLength: 30 })}
        {campo('dni', { maxLength: 15 })}
        <button
          type="submit"
          disabled={saving}
          style={{
            minHeight: '44px',
            backgroundColor: tokens.colors.peridot,
            color: tokens.colors.blanco,
            border: 'none',
            borderRadius: tokens.radius.md,
            padding: '0.7rem 1rem',
            fontWeight: 700,
            cursor: saving ? 'wait' : 'pointer',
            opacity: saving ? 0.75 : 1,
          }}
        >
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </form>
      {error && (
        <p role="alert" style={{ color: tokens.colors.error }}>
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={() => void signOutEverywhere()}
        style={{
          marginTop: tokens.spacing.sm,
          minHeight: '44px',
          backgroundColor: 'transparent',
          color: tokens.colors.musgo,
          border: `1px solid ${tokens.colors.sereno}`,
          borderRadius: tokens.radius.md,
          padding: '0.6rem 1rem',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Cerrar sesión
      </button>
    </section>
  );
}
