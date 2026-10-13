import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import TurnoGrilla, { type SlotTurno } from '../components/TurnoGrilla';
import BloqueoTemporal from '../components/BloqueoTemporal';

// Palette: refined green #384543, whisper white #F5F3EF,
// peridot #328161, serene gray #8A9A93, purple #68457A (sparse detail only).

// Today in Argentina (UTC-3, no DST): shift the instant so UTC getters read ART.
function hoyART(): string {
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}

// ARS formatting for all prices shown on this page.
function formatoARS(valor: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(valor);
}

const API_ORIGIN = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

// TEMPORARY: hardcoded dev-DB tipoTurno IDs until backend exposes GET listing — swap this constant, TODO.
const TIPOS_TURNO_PROVISORIOS = [
  { id: '016a91be-5bc3-4b73-ab3e-e671a2faf0fa', minutos: 60, etiqueta: '60 min' },
  { id: 'e7d99191-7ed9-4bb6-8188-f5abc9078db8', minutos: 90, etiqueta: '90 min' },
] as const;

// Minimal shape of POST /turnos success used by this page (amounts come from the server).
interface ReservaTurnoOk {
  id: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  costoTurnoNs: number;
  cargoLuzCompartido: number | null;
  avisos: string[];
}

// Pull the real API message out of a Nest error body (string or string[]).
function mensajeErrorApi(cuerpo: unknown, fallback: string): string {
  if (cuerpo !== null && typeof cuerpo === 'object' && 'message' in cuerpo) {
    const mensaje = (cuerpo as { message?: unknown }).message;
    if (Array.isArray(mensaje)) {
      return mensaje.map(String).join(', ');
    }
    if (typeof mensaje === 'string' && mensaje.length > 0) {
      return mensaje;
    }
  }
  return fallback;
}

export default function Turnos(): JSX.Element {
  const { getToken } = useAuth();
  // Token is resolved once per page; the grid re-fetches when it arrives.
  const [token, setToken] = useState<string | null>(null);
  const [fecha, setFecha] = useState<string>(() => hoyART());
  const [seleccionado, setSeleccionado] = useState<SlotTurno | null>(null);
  // Provisional booking form: duration defaults to 60 min, party defaults to 4/0.
  const [tipoTurnoId, setTipoTurnoId] = useState<string>(TIPOS_TURNO_PROVISORIOS[0].id);
  const [cantidadPersonas, setCantidadPersonas] = useState<number>(4);
  const [cantidadNoSocios, setCantidadNoSocios] = useState<number>(0);
  const [reservando, setReservando] = useState(false);
  const [errorReserva, setErrorReserva] = useState<string | null>(null);
  const [reservaOk, setReservaOk] = useState<ReservaTurnoOk | null>(null);

  // Lazily fetch the Clerk token on first render.
  useMemo(() => {
    void (async () => {
      try {
        setToken(await getToken());
      } catch {
        setToken(null);
      }
    })();
  }, [getToken]);

  // Clear the booking form outcome whenever the context changes.
  function reiniciarReserva(): void {
    setErrorReserva(null);
    setReservaOk(null);
    setReservando(false);
  }

  // Reset the selection whenever the day changes.
  function cambiarFecha(valor: string): void {
    setFecha(valor);
    setSeleccionado(null);
    reiniciarReserva();
  }

  // Pick a slot from the grid and reset the previous booking outcome.
  function elegirSlot(slot: SlotTurno): void {
    setSeleccionado(slot);
    reiniciarReserva();
  }

  // POST /turnos with the Clerk token; amounts and horaFin come back from the server.
  async function confirmarReserva(): Promise<void> {
    if (!seleccionado || reservando) {
      return;
    }
    setReservando(true);
    setErrorReserva(null);
    setReservaOk(null);
    try {
      const response = await fetch(`${API_ORIGIN}/api/turnos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          canchaId: seleccionado.canchaId,
          fecha,
          horaInicio: seleccionado.horaInicio,
          tipoTurnoId,
          cantidadPersonas,
          cantidadNoSocios,
          requiereLuz: seleccionado.requiereLuz,
        }),
      });
      let cuerpo: unknown = null;
      try {
        cuerpo = await response.json();
      } catch {
        cuerpo = null;
      }
      if (!response.ok) {
        throw new Error(mensajeErrorApi(cuerpo, `Error ${response.status}`));
      }
      const data = cuerpo as ReservaTurnoOk;
      setReservaOk({
        id: String(data.id ?? ''),
        fecha: String(data.fecha ?? fecha),
        horaInicio: String(data.horaInicio ?? seleccionado.horaInicio),
        horaFin: String(data.horaFin ?? ''),
        costoTurnoNs: Number(data.costoTurnoNs ?? 0),
        cargoLuzCompartido:
          data.cargoLuzCompartido === null || data.cargoLuzCompartido === undefined
            ? null
            : Number(data.cargoLuzCompartido),
        avisos: Array.isArray(data.avisos) ? data.avisos.map(String) : [],
      });
    } catch (error) {
      setErrorReserva(error instanceof Error ? error.message : 'No se pudo confirmar la reserva.');
    } finally {
      setReservando(false);
    }
  }

  return (
    <main
      style={{
        fontFamily: 'system-ui, sans-serif',
        backgroundColor: '#F5F3EF',
        color: '#384543',
        minHeight: '100dvh',
        padding: '2.5rem 1.5rem 3rem',
      }}
    >
      <style>{`@media (max-width: 880px) { .turnos-split { grid-template-columns: 1fr !important; } }`}</style>
      <div style={{ maxWidth: '1120px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <p style={{ margin: 0 }}>
          <Link to="/" style={{ color: '#328161', fontWeight: 600 }}>
            ← Volver al inicio
          </Link>
          {' · '}
          <Link to="/mis-turnos" style={{ color: '#328161', fontWeight: 600 }}>
            Ver mis turnos
          </Link>
        </p>

        <header style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <p style={{ margin: 0, fontSize: '0.85rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8A9A93' }}>
            Club · Reserva de canchas
          </p>
          <h1 style={{ margin: 0, fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', lineHeight: 1.1 }}>
            Elegí tu turno
          </h1>
          <p style={{ margin: 0, maxWidth: '65ch' }}>
            Mirá la disponibilidad real del día y tocá un horario libre para ver el detalle.
            La hora que ves es hora del club (ART). La reserva es provisoria: usa los tipos
            de turno de la base de desarrollo hasta que la API exponga el listado oficial.
          </p>
        </header>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <label htmlFor="fecha-turno" style={{ fontWeight: 600 }}>
            Día
          </label>
          <input
            id="fecha-turno"
            type="date"
            value={fecha}
            onChange={(event) => cambiarFecha(event.target.value)}
            style={{
              minHeight: '44px',
              borderRadius: '0.75rem',
              border: '1px solid #8A9A93',
              padding: '0.5rem 0.75rem',
              backgroundColor: '#FFFFFF',
              color: '#384543',
            }}
          />
        </div>

        {/* Asymmetric split: wide grid + narrow detail (stacks on mobile). */}
        <div className="turnos-split" style={{ display: 'grid', gridTemplateColumns: '1.9fr 1fr', gap: '1.25rem', alignItems: 'start' }}>
          <section aria-label="Grilla semanal de turnos">
            <TurnoGrilla
              fecha={fecha}
              token={token}
              seleccionado={seleccionado}
              onSeleccionar={elegirSlot}
            />
          </section>

          <aside
            aria-label="Detalle del turno"
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #8A9A93',
              borderRadius: '1rem',
              padding: '1.25rem',
              position: 'sticky',
              top: '1rem',
            }}
          >
            <h2 style={{ marginTop: 0 }}>Tu turno</h2>
            {seleccionado ? (
              <>
                <dl style={{ display: 'grid', gap: '0.4rem', margin: '0 0 1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                    <dt>Día</dt>
                    <dd style={{ margin: 0, fontWeight: 600 }}>{fecha}</dd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                    <dt>Horario</dt>
                    <dd style={{ margin: 0, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      {seleccionado.horaInicio}–{seleccionado.horaFin} ART
                    </dd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                    <dt>Cancha</dt>
                    <dd style={{ margin: 0, fontWeight: 600 }}>{seleccionado.nroCancha}</dd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                    <dt>Luz</dt>
                    <dd style={{ margin: 0, fontWeight: 600 }}>
                      {seleccionado.requiereLuz ? 'Sí, con cargo compartido' : 'No hace falta'}
                    </dd>
                  </div>
                </dl>
                {/* Sparse purple accent (under 5%): provisional notice only. */}
                <p style={{ fontSize: '0.85rem', color: '#68457A', margin: '0 0 1rem' }}>
                  El horario de fin real lo confirma el servidor según la duración elegida.
                  El importe lo calcula el servidor; acá solo mostramos lo que devuelve la API.
                </p>

                <fieldset style={{ border: '1px solid #8A9A93', borderRadius: '0.75rem', padding: '0.75rem', margin: '0 0 1rem' }}>
                  <legend style={{ fontWeight: 700, padding: '0 0.4rem' }}>
                    Duración · Provisorios
                  </legend>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {TIPOS_TURNO_PROVISORIOS.map((tipo) => (
                      <label
                        key={tipo.id}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minHeight: '44px', cursor: 'pointer' }}
                      >
                        <input
                          type="radio"
                          name="duracion-turno"
                          value={tipo.id}
                          checked={tipoTurnoId === tipo.id}
                          onChange={() => setTipoTurnoId(tipo.id)}
                        />
                        {tipo.etiqueta}
                      </label>
                    ))}
                  </div>
                  <p style={{ fontSize: '0.85rem', margin: '0.5rem 0 0' }}>
                    Tipos provisorios de la base de desarrollo. Si la base se reseed y el ID
                    ya no existe, la API lo informa y lo ves acá abajo.
                  </p>
                </fieldset>

                <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1rem' }}>
                  <label style={{ display: 'grid', gap: '0.25rem', fontWeight: 600 }}>
                    Personas
                    <input
                      type="number"
                      min={1}
                      value={cantidadPersonas}
                      onChange={(event) => setCantidadPersonas(Number(event.target.value))}
                      style={{
                        minHeight: '44px',
                        borderRadius: '0.75rem',
                        border: '1px solid #8A9A93',
                        padding: '0.5rem 0.75rem',
                        backgroundColor: '#FFFFFF',
                        color: '#384543',
                      }}
                    />
                  </label>
                  <label style={{ display: 'grid', gap: '0.25rem', fontWeight: 600 }}>
                    No socios
                    <input
                      type="number"
                      min={0}
                      max={cantidadPersonas}
                      value={cantidadNoSocios}
                      onChange={(event) => setCantidadNoSocios(Number(event.target.value))}
                      style={{
                        minHeight: '44px',
                        borderRadius: '0.75rem',
                        border: '1px solid #8A9A93',
                        padding: '0.5rem 0.75rem',
                        backgroundColor: '#FFFFFF',
                        color: '#384543',
                      }}
                    />
                  </label>
                </div>

                <BloqueoTemporal motivo="Reserva provisoria" />
                <button
                  type="button"
                  disabled={reservando}
                  onClick={() => void confirmarReserva()}
                  style={{
                    marginTop: '0.75rem',
                    width: '100%',
                    minHeight: '44px',
                    backgroundColor: '#328161',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '0.75rem',
                    padding: '0.7rem 1rem',
                    fontWeight: 700,
                    cursor: reservando ? 'wait' : 'pointer',
                    opacity: reservando ? 0.75 : 1,
                  }}
                >
                  {reservando ? 'Reservando…' : 'Confirmar reserva'}
                </button>

                {errorReserva && (
                  <p role="alert" style={{ fontSize: '0.9rem', color: '#9B2C2C', marginBottom: 0 }}>
                    No se pudo confirmar: {errorReserva}
                  </p>
                )}

                {reservaOk && (
                  <div
                    role="status"
                    style={{
                      marginTop: '1rem',
                      border: '1px solid #328161',
                      borderRadius: '0.75rem',
                      padding: '0.75rem',
                      backgroundColor: '#F5F3EF',
                    }}
                  >
                    <p style={{ margin: '0 0 0.5rem', fontWeight: 700 }}>
                      Listo, tu turno quedó confirmado de {reservaOk.horaInicio} a {reservaOk.horaFin} ART.
                    </p>
                    <p style={{ margin: '0 0 0.5rem', fontVariantNumeric: 'tabular-nums' }}>
                      Costo no socios: {formatoARS(reservaOk.costoTurnoNs)}
                      {reservaOk.cargoLuzCompartido !== null &&
                        ` · Luz compartida: ${formatoARS(reservaOk.cargoLuzCompartido)}`}
                    </p>
                    {reservaOk.avisos.length > 0 && (
                      <ul style={{ margin: 0, paddingInlineStart: '1.25rem', fontSize: '0.9rem' }}>
                        {reservaOk.avisos.map((aviso) => (
                          <li key={aviso}>{aviso}</li>
                        ))}
                      </ul>
                    )}
                    <p style={{ margin: '0.5rem 0 0' }}>
                      <Link to="/mis-turnos" style={{ color: '#328161', fontWeight: 600 }}>
                        Ver mis turnos
                      </Link>
                    </p>
                  </div>
                )}
              </>
            ) : (
              <>
                <p style={{ marginTop: 0 }}>
                  Todavía no elegiste horario. Tocá un bloque libre de la grilla y acá ves el
                  resumen para confirmar tu reserva provisoria.
                </p>
                <BloqueoTemporal motivo="Sin selección" />
              </>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
