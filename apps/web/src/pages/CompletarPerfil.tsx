import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import { ApiError, api, type CompletarPerfilBody } from '../lib/api';
import { useSignOut } from '../lib/useSignOut';

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
        <label htmlFor={`completar-perfil-${id}`} className="grid gap-1 font-semibold">
          {ETIQUETAS[id]}
          <input
            id={`completar-perfil-${id}`}
            value={form[id] ?? ''}
            onChange={(event) => update(id, event.target.value)}
            aria-invalid={invalido}
            aria-describedby={invalido ? errorId : undefined}
            className={`min-h-[44px] rounded-md border px-3 py-2 bg-white text-musgo font-[inherit] text-base w-full box-border ${
              invalido ? 'border-error' : 'border-sereno'
            }`}
            {...props}
          />
        </label>
        {invalido && (
          <p id={errorId} role="alert" className="mt-1 text-sm text-error">
            {errores[id]}
          </p>
        )}
      </div>
    );
  }

  return (
    <section
      aria-labelledby="completar-perfil-titulo"
      className="bg-white border border-sereno rounded-lg p-6 max-w-[480px] mx-auto"
    >
      <p className="mb-3 text-sm tracking-[0.08em] uppercase text-sereno">
        Club · Tu cuenta
      </p>
      <h1
        id="completar-perfil-titulo"
        className="mb-2 font-display font-normal"
      >
        Completar perfil
      </h1>
      <p className="mb-4 leading-relaxed">
        Las credenciales las gestiona Clerk. Solo faltan los datos del club.
      </p>
      <form onSubmit={(event) => void submit(event)} noValidate className="grid gap-3">
        {campo('username', { minLength: 3, maxLength: 50 })}
        {campo('nombre', { maxLength: 100 })}
        {campo('apellido', { maxLength: 100 })}
        {campo('telefono', { maxLength: 30 })}
        {campo('dni', { maxLength: 15 })}
        <button
          type="submit"
          disabled={saving}
          className={`min-h-[44px] bg-peridot text-white border-none rounded-md py-2.5 px-4 font-bold cursor-pointer transition-opacity ${
            saving ? 'opacity-75 cursor-wait' : 'opacity-100'
          }`}
        >
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </form>
      {error && (
        <p role="alert" className="text-error">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={() => void signOutEverywhere()}
        className="mt-3 min-h-[44px] bg-transparent text-musgo border border-sereno rounded-md py-2.5 px-4 font-semibold cursor-pointer"
      >
        Cerrar sesión
      </button>
    </section>
  );
}
