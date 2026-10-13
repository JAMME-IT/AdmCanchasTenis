import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import { ApiError, api, type EstadoHistorial, type MiTurno } from '../lib/api';

// Palette: refined green #384543, whisper white #F5F3EF,
// peridot #328161, serene gray #8A9A93.

// Date-only 'YYYY-MM-DD' must be formatted by string manipulation only:
// new Date(fecha) parses as UTC and shifts the day in Argentina (UTC-3).
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
  const [turnos, setTurnos] = useState<MiTurno[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<EstadoHistorial>('finalizado');
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  // Inline cancellation form state (no modal): which row is expanded.
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

  // Fetch vigentes on mount (once the token arrives); historial when its tab/filters change.
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
    <main
      style={{
        fontFamily: 'system-ui, sans-serif',
        backgroundColor: '#F5F3EF',
        color: '#384543',
        minHeight: '100dvh',
        padding: '2.5rem 1.5rem 3rem',
      }}
    >
      <div style={{ maxWidth: '960px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <p style={{ margin: 0 }}>
          <Link to="/" style={{ color: '#328161', fontWeight: 600 }}>
            ← Volver al inicio
          </Link>
        </p>

        <header style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <p style={{ margin: 0, fontSize: '0.85rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8A9A93' }}>
            Club · Mis reservas
          </p>
          <h1 style={{ margin: 0, fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', lineHeight: 1.1 }}>
            Mis turnos
          </h1>
          <p style={{ margin: 0, maxWidth: '65ch' }}>
            Acá ves tus próximos turnos y tu historial. Podés cancelar hasta 1 hora antes del inicio.
          </p>
        </header>

        <div style={{ display: 'flex', gap: '0.5rem' }} role="tablist" aria-label="Mis turnos">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'vigentes'}
            onClick={() => setTab('vigentes')}
            style={{
              minHeight: '44px',
              borderRadius: '0.75rem',
              border: '1px solid #8A9A93',
              padding: '0.6rem 1rem',
              fontWeight: 700,
              cursor: 'pointer',
              backgroundColor: tab === 'vigentes' ? '#384543' : '#FFFFFF',
              color: tab === 'vigentes' ? '#FFFFFF' : '#384543',
            }}
          >
            Vigentes
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'historial'}
            onClick={() => setTab('historial')}
            style={{
              minHeight: '44px',
              borderRadius: '0.75rem',
              border: '1px solid #8A9A93',
              padding: '0.6rem 1rem',
              fontWeight: 700,
              cursor: 'pointer',
              backgroundColor: tab === 'historial' ? '#384543' : '#FFFFFF',
              color: tab === 'historial' ? '#FFFFFF' : '#384543',
            }}
          >
            Historial
          </button>
        </div>

        {tab === 'historial' && (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {FILTROS_HISTORIAL.map((opcion) => (
              <button
                key={opcion.valor}
                type="button"
                aria-pressed={filtro === opcion.valor}
                onClick={() => setFiltro(opcion.valor)}
                style={{
                  minHeight: '44px',
                  borderRadius: '999px',
                  border: '1px solid #8A9A93',
                  padding: '0.5rem 1rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: filtro === opcion.valor ? '#328161' : '#FFFFFF',
                  color: filtro === opcion.valor ? '#FFFFFF' : '#384543',
                }}
              >
                {opcion.etiqueta}
              </button>
            ))}
          </div>
        )}

        {mensajeExito && (
          <p role="status" style={{ margin: 0, color: '#328161', fontWeight: 700 }}>
            {mensajeExito}
          </p>
        )}

        {cargando && <p>Cargando tus turnos…</p>}

        {!cargando && error && (
          <div
            role="alert"
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #8A9A93',
              borderRadius: '1rem',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <p style={{ margin: 0, color: '#9B2C2C' }}>No se pudieron cargar: {error}</p>
            <button
              type="button"
              onClick={reintentar}
              style={{
                alignSelf: 'flex-start',
                minHeight: '44px',
                backgroundColor: '#328161',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '0.75rem',
                padding: '0.6rem 1rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Reintentar
            </button>
          </div>
        )}

        {!cargando && !error && turnos.length === 0 && (
          <p>{tab === 'vigentes' ? 'No tenés turnos vigentes todavía' : 'No hay turnos en tu historial'}</p>
        )}

        {!cargando && !error && turnos.length > 0 && (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {turnos.map((turno) => (
              <li
                key={turno.id}
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #8A9A93',
                  borderRadius: '1rem',
                  padding: '1rem 1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                  <strong>
                    Cancha {turno.cancha.nroCancha} · {formatoFechaCorta(turno.fecha)} · {turno.horaInicio}–{turno.horaFin}
                  </strong>
                  <span
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      borderRadius: '999px',
                      border: '1px solid #8A9A93',
                      padding: '0.25rem 0.75rem',
                      backgroundColor: '#F5F3EF',
                    }}
                  >
                    {etiquetaEstado(turno.estadoActual)}
                  </span>
                </div>

                {tab === 'vigentes' &&
                  (turno.puedeCancelar ? (
                    cancelandoId === turno.id ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ display: 'grid', gap: '0.25rem', fontWeight: 600 }}>
                          Motivo de la cancelación
                          <textarea
                            value={motivo}
                            maxLength={500}
                            rows={3}
                            onChange={(event) => setMotivo(event.target.value)}
                            placeholder="Contanos por qué cancelás"
                            style={{
                              borderRadius: '0.75rem',
                              border: '1px solid #8A9A93',
                              padding: '0.5rem 0.75rem',
                              fontFamily: 'inherit',
                              color: '#384543',
                            }}
                          />
                        </label>
                        {errorCancelacion && (
                          <p role="alert" style={{ margin: 0, fontSize: '0.9rem', color: '#9B2C2C' }}>
                            {errorCancelacion}
                          </p>
                        )}
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            disabled={enviandoCancelacion || motivo.trim().length === 0}
                            onClick={() => void confirmarCancelacion(turno.id)}
                            style={{
                              minHeight: '44px',
                              backgroundColor: '#9B2C2C',
                              color: '#FFFFFF',
                              border: 'none',
                              borderRadius: '0.75rem',
                              padding: '0.6rem 1rem',
                              fontWeight: 700,
                              cursor: enviandoCancelacion ? 'wait' : 'pointer',
                              opacity: enviandoCancelacion || motivo.trim().length === 0 ? 0.6 : 1,
                            }}
                          >
                            {enviandoCancelacion ? 'Cancelando…' : 'Confirmar cancelación'}
                          </button>
                          <button
                            type="button"
                            onClick={cerrarCancelacion}
                            style={{
                              minHeight: '44px',
                              backgroundColor: 'transparent',
                              color: '#384543',
                              border: '1px solid #8A9A93',
                              borderRadius: '0.75rem',
                              padding: '0.6rem 1rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
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
                          style={{
                            minHeight: '44px',
                            backgroundColor: 'transparent',
                            color: '#9B2C2C',
                            border: '1px solid #9B2C2C',
                            borderRadius: '0.75rem',
                            padding: '0.6rem 1rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Cancelar
                        </button>
                      </div>
                    )
                  ) : (
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#8A9A93' }}>
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
