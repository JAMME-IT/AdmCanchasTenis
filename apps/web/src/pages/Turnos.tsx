import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import { api, ApiError, type ReservarTurnoResponse } from '../lib/api';
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

export default function Turnos(): JSX.Element {
  const { getToken } = useAuth();
  // Token is resolved once per page; the grid re-fetches when it arrives.
  const [token, setToken] = useState<string | null>(null);
  const [fecha, setFecha] = useState<string>(() => hoyART());
  const [seleccionado, setSeleccionado] = useState<SlotTurno | null>(null);
  // Booking form: no hardcoded tipoTurno IDs (the API has no listing endpoint yet,
  // so the ID comes from user input and the server validates it).
  const [tipoTurnoId, setTipoTurnoId] = useState<string>('');
  // Slot length resolved by the server, reported back by the grid.
  const [duracionMinutos, setDuracionMinutos] = useState<number | null>(null);
  const [cantidadPersonas, setCantidadPersonas] = useState<number>(4);
  const [cantidadNoSocios, setCantidadNoSocios] = useState<number>(0);
  const [reservando, setReservando] = useState(false);
  const [errorReserva, setErrorReserva] = useState<string | null>(null);
  const [reservaOk, setReservaOk] = useState<ReservarTurnoResponse | null>(null);

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
    setDuracionMinutos(null);
    reiniciarReserva();
  }

  // Pick a slot from the grid and reset the previous booking outcome.
  function elegirSlot(slot: SlotTurno): void {
    setSeleccionado(slot);
    reiniciarReserva();
  }

  // POST /turnos through lib/api; amounts and horaFin come back from the server.
  async function confirmarReserva(): Promise<void> {
    if (!seleccionado || reservando) {
      return;
    }
    setReservando(true);
    setErrorReserva(null);
    setReservaOk(null);
    try {
      const data = await api.crearTurno(token, {
        canchaId: seleccionado.canchaId,
        fecha,
        horaInicio: seleccionado.horaInicio,
        tipoTurnoId: tipoTurnoId.trim(),
        cantidadPersonas,
        cantidadNoSocios,
        requiereLuz: seleccionado.requiereLuz,
      });
      setReservaOk(data);
    } catch (error) {
      setErrorReserva(
        error instanceof ApiError || error instanceof Error
          ? error.message
          : 'No se pudo confirmar la reserva.',
      );
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
            La hora que ves es hora del club (ART).
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
              onDisponibilidad={(info) => setDuracionMinutos(info.duracionMinutos)}
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
                    Tipo de turno
                  </legend>
                  <label style={{ display: 'grid', gap: '0.25rem', fontWeight: 600 }}>
                    ID del tipo de turno
                    <input
                      type="text"
                      value={tipoTurnoId}
                      onChange={(event) => setTipoTurnoId(event.target.value)}
                      placeholder="UUID del tipo de turno"
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
                  <p style={{ fontSize: '0.85rem', margin: '0.5rem 0 0' }}>
                    Los turnos de este día duran
                    {duracionMinutos !== null ? ` ${duracionMinutos} min` : ' lo que indique el servidor'}.
                    La API todavía no expone el listado oficial de tipos: si el ID no existe,
                    la API lo informa y lo ves acá abajo.
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

                <BloqueoTemporal motivo="Revisá el detalle" />
                <button
                  type="button"
                  disabled={reservando || tipoTurnoId.trim().length === 0}
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
                  resumen para confirmar tu reserva.
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
