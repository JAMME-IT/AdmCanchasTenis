import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import { api, ApiError, type ReservarTurnoResponse } from '../lib/api';
import TurnoGrilla, { type SlotTurno } from '../components/TurnoGrilla';
import BloqueoTemporal from '../components/BloqueoTemporal';

function hoyART(): string {
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}

function formatoARS(valor: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(valor);
}

export default function Turnos(): JSX.Element {
  const { getToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [fecha, setFecha] = useState<string>(() => hoyART());
  const [seleccionado, setSeleccionado] = useState<SlotTurno | null>(null);
  const [tipoTurnoId, setTipoTurnoId] = useState<string>('');
  const [duracionMinutos, setDuracionMinutos] = useState<number | null>(null);
  const [cantidadPersonas, setCantidadPersonas] = useState<number>(4);
  const [cantidadNoSocios, setCantidadNoSocios] = useState<number>(0);
  const [reservando, setReservando] = useState(false);
  const [errorReserva, setErrorReserva] = useState<string | null>(null);
  const [reservaOk, setReservaOk] = useState<ReservarTurnoResponse | null>(null);

  useMemo(() => {
    void (async () => {
      try {
        setToken(await getToken());
      } catch {
        setToken(null);
      }
    })();
  }, [getToken]);

  function reiniciarReserva(): void {
    setErrorReserva(null);
    setReservaOk(null);
    setReservando(false);
  }

  function cambiarFecha(valor: string): void {
    setFecha(valor);
    setSeleccionado(null);
    setDuracionMinutos(null);
    reiniciarReserva();
  }

  function elegirSlot(slot: SlotTurno): void {
    setSeleccionado(slot);
    reiniciarReserva();
  }

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
    <main className="py-10 px-6 pb-12 font-sans bg-whisper text-musgo min-h-dvh">
      <div className="max-w-[1120px] mx-auto flex flex-col gap-5">
        <p className="m-0">
          <Link to="/" className="text-peridot font-semibold">
            ← Volver al inicio
          </Link>
          {' · '}
          <Link to="/mis-turnos" className="text-peridot font-semibold">
            Ver mis turnos
          </Link>
        </p>

        <header className="flex flex-col gap-2">
          <p className="m-0 text-sm tracking-[0.08em] uppercase text-sereno">
            Club · Reserva de canchas
          </p>
          <h1 className="m-0 text-[clamp(1.8rem,4vw,2.6rem)] leading-[1.1]">
            Elegí tu turno
          </h1>
          <p className="m-0 max-w-[65ch]">
            Mirá la disponibilidad real del día y tocá un horario libre para ver el detalle.
            La hora que ves es hora del club (ART).
          </p>
        </header>

        <div className="flex items-center gap-3 flex-wrap">
          <label htmlFor="fecha-turno" className="font-semibold">
            Día
          </label>
          <input
            id="fecha-turno"
            type="date"
            value={fecha}
            onChange={(event) => cambiarFecha(event.target.value)}
            className="min-h-[44px] rounded-xl border border-sereno px-3 py-2 bg-white text-musgo"
          />
        </div>

        <div className="grid grid-cols-[1.9fr_1fr] gap-5 items-start max-[880px]:grid-cols-1">
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
            className="bg-white border border-sereno rounded-2xl p-5 sticky top-4"
          >
            <h2 className="mt-0">Tu turno</h2>
            {seleccionado ? (
              <>
                <dl className="grid gap-1 mb-4">
                  <div className="flex justify-between gap-4">
                    <dt>Día</dt>
                    <dd className="m-0 font-semibold">{fecha}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt>Horario</dt>
                    <dd className="m-0 font-semibold tabular-nums">
                      {seleccionado.horaInicio}–{seleccionado.horaFin} ART
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt>Cancha</dt>
                    <dd className="m-0 font-semibold">{seleccionado.nroCancha}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt>Luz</dt>
                    <dd className="m-0 font-semibold">
                      {seleccionado.requiereLuz ? 'Sí, con cargo compartido' : 'No hace falta'}
                    </dd>
                  </div>
                </dl>
                <p className="text-sm text-[#68457A] mb-4">
                  El horario de fin real lo confirma el servidor según la duración elegida.
                  El importe lo calcula el servidor; acá solo mostramos lo que devuelve la API.
                </p>

                <fieldset className="border border-sereno rounded-xl p-3 mb-4">
                  <legend className="font-bold px-1.5">
                    Tipo de turno
                  </legend>
                  <label className="grid gap-1 font-semibold">
                    ID del tipo de turno
                    <input
                      type="text"
                      value={tipoTurnoId}
                      onChange={(event) => setTipoTurnoId(event.target.value)}
                      placeholder="UUID del tipo de turno"
                      className="min-h-[44px] rounded-xl border border-sereno px-3 py-2 bg-white text-musgo"
                    />
                  </label>
                  <p className="text-sm mt-2 mb-0">
                    Los turnos de este día duran
                    {duracionMinutos !== null ? ` ${duracionMinutos} min` : ' lo que indique el servidor'}.
                    La API todavía no expone el listado oficial de tipos: si el ID no existe,
                    la API lo informa y lo ves acá abajo.
                  </p>
                </fieldset>

                <div className="grid gap-3 mb-4">
                  <label className="grid gap-1 font-semibold">
                    Personas
                    <input
                      type="number"
                      min={1}
                      value={cantidadPersonas}
                      onChange={(event) => setCantidadPersonas(Number(event.target.value))}
                      className="min-h-[44px] rounded-xl border border-sereno px-3 py-2 bg-white text-musgo"
                    />
                  </label>
                  <label className="grid gap-1 font-semibold">
                    No socios
                    <input
                      type="number"
                      min={0}
                      max={cantidadPersonas}
                      value={cantidadNoSocios}
                      onChange={(event) => setCantidadNoSocios(Number(event.target.value))}
                      className="min-h-[44px] rounded-xl border border-sereno px-3 py-2 bg-white text-musgo"
                    />
                  </label>
                </div>

                <BloqueoTemporal motivo="Revisá el detalle" />
                <button
                  type="button"
                  disabled={reservando || tipoTurnoId.trim().length === 0}
                  onClick={() => void confirmarReserva()}
                  className={`mt-3 w-full min-h-[44px] bg-peridot text-white border-none rounded-xl py-2.5 px-4 font-bold transition-opacity ${
                    reservando ? 'opacity-75 cursor-wait' : 'opacity-100 cursor-pointer'
                  }`}
                >
                  {reservando ? 'Reservando…' : 'Confirmar reserva'}
                </button>

                {errorReserva && (
                  <p role="alert" className="text-sm text-error mb-0">
                    No se pudo confirmar: {errorReserva}
                  </p>
                )}

                {reservaOk && (
                  <div
                    role="status"
                    className="mt-4 border border-peridot rounded-xl p-3 bg-whisper"
                  >
                    <p className="mb-2 font-bold">
                      Listo, tu turno quedó confirmado de {reservaOk.horaInicio} a {reservaOk.horaFin} ART.
                    </p>
                    <p className="mb-2 tabular-nums">
                      Costo no socios: {formatoARS(reservaOk.costoTurnoNs)}
                      {reservaOk.cargoLuzCompartido !== null &&
                        ` · Luz compartida: ${formatoARS(reservaOk.cargoLuzCompartido)}`}
                    </p>
                    {reservaOk.avisos.length > 0 && (
                      <ul className="m-0 ps-5 text-sm">
                        {reservaOk.avisos.map((aviso) => (
                          <li key={aviso}>{aviso}</li>
                        ))}
                      </ul>
                    )}
                    <p className="mt-2 mb-0">
                      <Link to="/mis-turnos" className="text-peridot font-semibold">
                        Ver mis turnos
                      </Link>
                    </p>
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="mt-0">
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
