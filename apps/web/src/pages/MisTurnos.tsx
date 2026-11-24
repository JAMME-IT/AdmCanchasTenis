import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/react';
import { ApiError, api, type EstadoHistorial, type MiTurno, type TurnoConCanchaResponse } from '../lib/api';
import { EmptyState, ErrorCard, Skeleton, StatusPill } from '../components/Feedback';

function formatoFechaCorta(fecha: string): string {
  const partes = fecha.split('-');
  if (partes.length !== 3) {
    return fecha;
  }
  const [anio, mes, dia] = partes;
  return `${dia}/${mes}/${anio}`;
}

type Tab = 'vigentes' | 'historial';

const FILTROS_HISTORIAL: Array<{ etiqueta: string; valor: EstadoHistorial }> = [
  { etiqueta: 'Finalizados', valor: 'finalizado' },
  { etiqueta: 'No asistió', valor: 'no_asistio' },
  { etiqueta: 'Cancelados', valor: 'cancelado' },
];

function etiquetaEstado(estado: string): string {
  switch (estado) {
    case 'finalizado':
      return 'Finalizado';
    case 'no_asistio':
      return 'No asistió';
    case 'cancelado':
      return 'Cancelado';
    default:
      return estado;
  }
}

export default function MisTurnos(): JSX.Element {
  const { getToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('vigentes');
  const [turnos, setTurnos] = useState<Array<MiTurno | TurnoConCanchaResponse>>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<EstadoHistorial>('finalizado');
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [cancelandoId, setCancelandoId] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');
  const [enviandoCancelacion, setEnviandoCancelacion] = useState(false);
  const [errorCancelacion, setErrorCancelacion] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        setToken(await getToken());
      } catch {
        if (active) {
          setToken(null);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [getToken]);

  const cargarVigentes = useCallback(
    async (authToken: string | null) => {
      setCargando(true);
      setError(null);
      setMensajeExito(null);
      try {
        const data = await api.misTurnos(authToken);
        setTurnos(data);
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : 'No se pudieron cargar tus turnos.');
      } finally {
        setCargando(false);
      }
    },
    [],
  );

  const cargarHistorial = useCallback(async (authToken: string | null, estado: EstadoHistorial) => {
    setCargando(true);
    setError(null);
    try {
      const data = await api.historialTurnos(authToken, { estadoActual: estado });
      setTurnos(data);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'No se pudo cargar tu historial.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (token === null) {
      return;
    }
    if (tab === 'vigentes') {
      void cargarVigentes(token);
    } else {
      void cargarHistorial(token, filtro);
    }
  }, [token, tab, filtro, cargarVigentes, cargarHistorial]);

  function abrirCancelacion(id: string): void {
    setCancelandoId(id);
    setMotivo('');
    setErrorCancelacion(null);
  }

  function cerrarCancelacion(): void {
    setCancelandoId(null);
    setMotivo('');
    setErrorCancelacion(null);
  }

  async function confirmarCancelacion(id: string): Promise<void> {
    if (enviandoCancelacion) {
      return;
    }
    setEnviandoCancelacion(true);
    setErrorCancelacion(null);
    try {
      await api.cancelarTurno(token, id, motivo.trim());
      setMensajeExito('Turno cancelado');
      cerrarCancelacion();
      await cargarVigentes(token);
    } catch (caught) {
      setErrorCancelacion(
        caught instanceof ApiError ? caught.message : 'No se pudo cancelar el turno.',
      );
    } finally {
      setEnviandoCancelacion(false);
    }
  }

  function reintentar(): void {
    if (tab === 'vigentes') {
      void cargarVigentes(token);
    } else {
      void cargarHistorial(token, filtro);
    }
  }

  return (
    <main className="py-10 px-6 pb-12 font-sans bg-whisper text-musgo min-h-dvh">
      <div className="max-w-[960px] mx-auto flex flex-col gap-5">
        <header className="flex flex-col gap-2">
          <p className="m-0 text-sm tracking-[0.08em] uppercase text-sereno">
            Club · Mis reservas
          </p>
          <h1 className="m-0 text-[clamp(1.8rem,4vw,2.6rem)] leading-[1.1]">
            Mis turnos
          </h1>
          <p className="m-0 max-w-[65ch]">
            Acá ves tus próximos turnos y tu historial. Podés cancelar hasta 1 hora antes del inicio.
          </p>
        </header>

        <div className="flex gap-2" role="tablist" aria-label="Mis turnos">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'vigentes'}
            onClick={() => setTab('vigentes')}
            className={`min-h-[44px] rounded-xl border border-sereno px-4 py-2.5 font-bold cursor-pointer transition-colors ${
              tab === 'vigentes'
                ? 'bg-musgo text-white'
                : 'bg-white text-musgo'
            }`}
          >
            Vigentes
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'historial'}
            onClick={() => setTab('historial')}
            className={`min-h-[44px] rounded-xl border border-sereno px-4 py-2.5 font-bold cursor-pointer transition-colors ${
              tab === 'historial'
                ? 'bg-musgo text-white'
                : 'bg-white text-musgo'
            }`}
          >
            Historial
          </button>
        </div>

        {tab === 'historial' && (
          <div className="flex gap-2 flex-wrap">
            {FILTROS_HISTORIAL.map((opcion) => (
              <button
                key={opcion.valor}
                type="button"
                aria-pressed={filtro === opcion.valor}
                onClick={() => setFiltro(opcion.valor)}
                className={`min-h-[44px] rounded-full border border-sereno px-4 py-2 font-semibold cursor-pointer transition-colors ${
                  filtro === opcion.valor
                    ? 'bg-peridot text-white'
                    : 'bg-white text-musgo'
                }`}
              >
                {opcion.etiqueta}
              </button>
            ))}
          </div>
        )}

        {mensajeExito && (
          <p role="status" className="m-0 text-peridot font-bold">
            {mensajeExito}
          </p>
        )}

        {cargando && <Skeleton rows={3} label="Cargando tus turnos…" />}

        {!cargando && error && (
          <ErrorCard message={`No se pudieron cargar: ${error}`} onRetry={reintentar} />
        )}

        {!cargando && !error && turnos.length === 0 && (
          <EmptyState
            message={tab === 'vigentes' ? 'No tenés turnos vigentes todavía' : 'No hay turnos en tu historial'}
          />
        )}

        {!cargando && !error && turnos.length > 0 && (
          <ul className="list-none m-0 p-0 flex flex-col gap-3">
            {turnos.map((turno) => (
              <li
                key={turno.id}
                className="bg-white border border-sereno rounded-2xl px-5 py-4 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <strong>
                    Cancha {turno.cancha.nroCancha} · {formatoFechaCorta(turno.fecha)} · {turno.horaInicio}–{turno.horaFin}
                  </strong>
                  <StatusPill estado={turno.estadoActual} label={etiquetaEstado(turno.estadoActual)} />
                </div>

                {tab === 'vigentes' &&
                  ('puedeCancelar' in turno && turno.puedeCancelar ? (
                    cancelandoId === turno.id ? (
                      <div className="flex flex-col gap-2">
                        <label className="grid gap-1 font-semibold">
                          Motivo de la cancelación
                          <textarea
                            value={motivo}
                            maxLength={500}
                            rows={3}
                            onChange={(event) => setMotivo(event.target.value)}
                            placeholder="Contanos por qué cancelás"
                            className="rounded-xl border border-sereno px-3 py-2 font-[inherit] text-musgo"
                          />
                        </label>
                        {errorCancelacion && (
                          <p role="alert" className="m-0 text-sm text-error">
                            {errorCancelacion}
                          </p>
                        )}
                        <div className="flex gap-2 flex-wrap">
                          <button
                            type="button"
                            disabled={enviandoCancelacion || motivo.trim().length === 0}
                            onClick={() => void confirmarCancelacion(turno.id)}
                            className={`min-h-[44px] bg-error text-white border-none rounded-xl px-4 py-2.5 font-bold transition-opacity ${
                              enviandoCancelacion || motivo.trim().length === 0
                                ? 'opacity-60 cursor-not-allowed'
                                : 'opacity-100 cursor-pointer'
                            }`}
                          >
                            {enviandoCancelacion ? 'Cancelando…' : 'Confirmar cancelación'}
                          </button>
                          <button
                            type="button"
                            onClick={cerrarCancelacion}
                            className="min-h-[44px] bg-transparent text-musgo border border-sereno rounded-xl px-4 py-2.5 font-semibold cursor-pointer"
                          >
                            Volver
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <button
                          type="button"
                          onClick={() => abrirCancelacion(turno.id)}
                          className="min-h-[44px] bg-transparent text-error border border-error rounded-xl px-4 py-2.5 font-bold cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                    )
                  ) : (
                    <p className="m-0 text-sm text-sereno">
                      Ya no se puede cancelar (menos de 1 h)
                    </p>
                  ))}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
