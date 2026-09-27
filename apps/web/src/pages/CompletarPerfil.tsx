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

export default function CompletarPerfil(): JSX.Element {
  const { getToken } = useAuth();
  const signOutEverywhere = useSignOut();
  const navigate = useNavigate();
  const [form, setForm] = useState<CompletarPerfilBody>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function update(campo: keyof CompletarPerfilBody, valor: string): void {
    setForm((previous) => ({ ...previous, [campo]: valor }));
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      await api.completarPerfil(token, form);
      navigate('/', { replace: true });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not complete the profile');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', maxWidth: '480px', margin: '0 auto', padding: '3rem' }}>
      <h1>Complete profile</h1>
      <p>Your credentials are managed by Clerk. Now add your club details.</p>
      <form onSubmit={submit} style={{ display: 'grid', gap: '0.75rem' }}>
        <label>
          Username
          <input
            value={form.username}
            onChange={(event) => update('username', event.target.value)}
            required
            minLength={3}
            maxLength={50}
          />
        </label>
        <label>
          First name
          <input
            value={form.nombre}
            onChange={(event) => update('nombre', event.target.value)}
            required
            maxLength={100}
          />
        </label>
        <label>
          Last name
          <input
            value={form.apellido}
            onChange={(event) => update('apellido', event.target.value)}
            required
            maxLength={100}
          />
        </label>
        <label>
          Phone (optional)
          <input
            value={form.telefono ?? ''}
            onChange={(event) => update('telefono', event.target.value)}
            maxLength={30}
          />
        </label>
        <label>
          DNI
          <input
            value={form.dni}
            onChange={(event) => update('dni', event.target.value)}
            required
            maxLength={15}
          />
        </label>
        <button type="submit" disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </button>
      </form>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      <button type="button" onClick={() => void signOutEverywhere()}>
        Sign out
      </button>
    </main>
  );
}
