// Panel admin del club: turnos con filtros, pagos y reportes.
// Todo sale de endpoints solo-admin del backend; la pagina ademas
// verifica el rol del perfil y muestra un aviso si no es admin.
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/react';
import { Navigate } from 'react-router-dom';
import {
  ApiError,
  api,
  type DiaFuncionamiento,
  type EstadisticasResponse,
  type FinancieroResponse,
  type PagoTurno,
  type RangoHorarioBody,
  type TurnoAdmin,
} from '../lib/api';
import { EmptyState, ErrorCard, Skeleton, StatusPill } from '../components/Feedback';

type Tab = 'turnos' | 'pagos' | 'reportes' | 'config';

const TABS: { id: Tab; label: string }[] = [
  { id: 'turnos', label: 'Turnos' },
  { id: 'pagos', label: 'Pagos' },
  { id: 'reportes', label: 'Reportes' },
  { id: 'config', label: 'Configuración' },
];

/** ISO-8601 weekday 1..7 (API contract §5.6). */
const NOMBRES_DIA: Record<number, string> = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
  7: 'Domingo',
};

function formatoMoneda(valor: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(valor);
}

function formatoFechaCorta(fecha: string): string {
  const [anio, mes, dia] = fecha.slice(0, 10).split('-');
  return `${dia}/${mes}/${anio}`;
}

export default function Admin(): JSX.Element {
  const { getToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [rol, setRol] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('turnos');
  const [turnos, setTurnos] = useState<TurnoAdmin[]>([]);
  const [pagos, setPagos] = useState<PagoTurno[]>([]);
  const [estadisticas, setEstadisticas] = useState<EstadisticasResponse | null>(null);
  const [financiero, setFinanciero] = useState<FinancieroResponse | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [fecha, setFecha] = useState('');
  const [dias, setDias] = useState<DiaFuncionamiento[] | null>(null);
  const [rangos, setRangos] = useState<RangoHorarioBody[] | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorConfig, setErrorConfig] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const authToken = await getToken();
        if (active) {
          setToken(authToken);
          if (authToken) {
            const perfil = await api.me(authToken);
            if (active) {
              setRol(perfil.rol);
            }
          }
        }
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

  const cargar = useCallback(
    async (authToken: string | null, tabActual: Tab) => {
      setCargando(true);
      setError(null);
      try {
        if (tabActual === 'turnos') {
          const data = await api.turnosAdmin(authToken, {
            busqueda: busqueda.trim() === '' ? undefined : busqueda.trim(),
            fecha: fecha === '' ? undefined : fecha,
          });
          setTurnos(data);
        } else if (tabActual === 'pagos') {
          setPagos(await api.pagosTurno(authToken));
        } else if (tabActual === 'config') {
          const [diasConfig, rangosConfig] = await Promise.all([
            api.diasFuncionamiento(authToken),
            api.rangosHorario(authToken),
          ]);
          setDias(diasConfig);
          setRangos(rangosConfig.map((rango) => ({ ...rango })));
        } else {
          const [est, fin] = await Promise.all([
            api.estadisticas(authToken),
            api.financiero(authToken),
          ]);
          setEstadisticas(est);
          setFinanciero(fin);
        }
      } catch (caught) {
        setError(
          caught instanceof ApiError ? caught.message : 'No se pudo cargar el panel admin.',
        );
      } finally {
        setCargando(false);
      }
    },
    [busqueda, fecha],
  );

  useEffect(() => {
    if (token === null || rol === null) {
      return;
    }
    if (rol !== 'admin') {
      return;
    }
    void cargar(token, tab);
  }, [token, rol, tab, cargar]);

  /** Saves one config block; validates ranges client-side (server re-checks). */
  const guardarConfig = useCallback(
    async (authToken: string | null, bloque: 'dias' | 'rangos') => {
      setErrorConfig(null);
      if (bloque === 'dias' && dias !== null) {
        setGuardando(true);
        try {
          setDias(await api.guardarDiasFuncionamiento(authToken, dias));
        } catch (caught) {
          setErrorConfig(
            caught instanceof ApiError ? caught.message : 'No se pudo guardar los días.',
          );
        } finally {
          setGuardando(false);
        }
      } else if (bloque === 'rangos' && rangos !== null) {
        const sinNombre = rangos.find((rango) => rango.nombre.trim() === '');
        if (sinNombre) {
          setErrorConfig('Cada franja necesita un nombre.');
          return;
        }
        const malOrden = rangos.find((rango) => rango.horaFin <= rango.horaInicio);
        if (malOrden) {
          setErrorConfig(`La franja "${malOrden.nombre}" debe terminar después de empezar.`);
          return;
        }
        setGuardando(true);
        try {
          setRangos(
            (await api.guardarRangosHorario(authToken, rangos)).map((rango) => ({ ...rango })),
          );
        } catch (caught) {
          setErrorConfig(
            caught instanceof ApiError ? caught.message : 'No se pudo guardar las franjas.',
          );
        } finally {
          setGuardando(false);
        }
      }
    },
    [dias, rangos],
  );

  if (rol !== null && rol !== 'admin') {
    // No admin: no ve nada de este panel (RequireAdmin ya redirige;
    // esto es cinturon y tirantes por si se ruta fuera del wrapper).
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="m-0 text-sereno font-semibold">Club · Admin</p>
        <h1 className="mt-1 mb-0">Panel admin</h1>
      </header>

      <div className="flex gap-2" role="tablist" aria-label="Panel admin">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`min-h-[44px] rounded-full px-4 py-2 font-semibold cursor-pointer transition-colors ${
              tab === item.id
                ? 'bg-musgo text-whisper border-musgo'
                : 'bg-white text-musgo border-sereno'
            } border`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'turnos' && (
        <section aria-label="Turnos" className="flex flex-col gap-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void cargar(token, 'turnos');
            }}
            className="flex gap-3 flex-wrap"
          >
            <input
              type="search"
              aria-label="Buscar por nombre o apellido"
              placeholder="Buscar socio…"
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              className="min-h-[44px] rounded-md border border-sereno px-3 py-2.5 text-base"
            />
            <input
              type="date"
              aria-label="Fecha exacta"
              value={fecha}
              onChange={(event) => setFecha(event.target.value)}
              className="min-h-[44px] rounded-md border border-sereno px-3 py-2.5 text-base"
            />
            <button
              type="submit"
              className="min-h-[44px] rounded-md px-4 py-2.5 font-bold cursor-pointer bg-peridot text-whisper border-none"
            >
              Filtrar
            </button>
          </form>
          {cargando ? (
            <Skeleton rows={4} label="Cargando turnos…" />
          ) : error ? (
            <ErrorCard message={error} onRetry={() => void cargar(token, 'turnos')} />
          ) : turnos.length === 0 ? (
            <EmptyState message="No hay turnos para esos filtros." />
          ) : (
            <ul className="list-none m-0 p-0 grid gap-3">
              {turnos.map((turno) => (
                <li key={turno.id} className="bg-white border border-sereno rounded-lg p-6">
                  <div className="flex gap-3 flex-wrap items-center">
                    <StatusPill estado={turno.estadoActual} />
                    <StatusPill estado={turno.estadoPago} />
                    <strong>
                      {turno.usuario.nombre} {turno.usuario.apellido}
                    </strong>
                    <span>
                      Cancha {turno.cancha.nroCancha} · {formatoFechaCorta(turno.fecha)} ·{' '}
                      {turno.horaInicio.slice(0, 5)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === 'pagos' && (
        <section aria-label="Pagos" className="flex flex-col gap-4">
          {cargando ? (
            <Skeleton rows={4} label="Cargando pagos…" />
          ) : error ? (
            <ErrorCard message={error} onRetry={() => void cargar(token, 'pagos')} />
          ) : pagos.length === 0 ? (
            <EmptyState message="Todavía no hay pagos registrados." />
          ) : (
            <ul className="list-none m-0 p-0 grid gap-3">
              {pagos.map((pago) => (
                <li key={pago.id} className="bg-white border border-sereno rounded-lg p-6">
                  <div className="flex gap-3 flex-wrap items-center">
                    <strong>{formatoMoneda(pago.montoTotalTurno)}</strong>
                    <span>
                      {pago.usuario.nombre} {pago.usuario.apellido}
                    </span>
                    <span>{formatoFechaCorta(pago.fechaPago)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === 'reportes' && (
        <section aria-label="Reportes" className="flex flex-col gap-4">
          {cargando ? (
            <Skeleton rows={3} label="Cargando reportes…" />
          ) : error ? (
            <ErrorCard message={error} onRetry={() => void cargar(token, 'reportes')} />
          ) : estadisticas && financiero ? (
            <>
              <article className="bg-white border border-sereno rounded-lg p-6">
                <h2 className="mt-0">Turnos</h2>
                <p className="text-3xl my-1 tabular-nums">
                  {estadisticas.turnos.total}
                </p>
                <p className="m-0 text-sereno">
                  Socios activos: {estadisticas.usuarios.sociosActivos} · Morosos:{' '}
                  {estadisticas.usuarios.morosos}
                </p>
              </article>
              <article className="bg-white border border-sereno rounded-lg p-6">
                <h2 className="mt-0">Ingresos</h2>
                <p className="text-3xl my-1 tabular-nums">
                  {formatoMoneda(financiero.ingresos.total)}
                </p>
                <p className="m-0 text-sereno">
                  Turnos: {formatoMoneda(financiero.ingresos.pagosTurno)} · Luz:{' '}
                  {formatoMoneda(financiero.ingresos.pagosLuz)} · Cuotas:{' '}
                  {formatoMoneda(financiero.ingresos.cuotasCobradas)}
                </p>
              </article>
              <article className="bg-white border border-sereno rounded-lg p-6">
                <h2 className="mt-0">Cuotas</h2>
                <p className="m-0">
                  Emitidas: {financiero.cuotas.emitidas} · Pagadas: {financiero.cuotas.pagadas} ·
                  Adeudadas: {financiero.cuotas.adeudadas}
                </p>
              </article>
            </>
          ) : (
            <EmptyState message="Sin datos para el período." />
          )}
        </section>
      )}
      {tab === 'config' && (
        <section aria-label="Configuración" className="flex flex-col gap-4">
          {cargando ? (
            <Skeleton rows={4} label="Cargando configuración…" />
          ) : error ? (
            <ErrorCard message={error} onRetry={() => void cargar(token, 'config')} />
          ) : dias !== null && rangos !== null ? (
            <>
              {errorConfig !== null && (
                <div role="alert" className="bg-white border border-error rounded-lg p-6 text-error">
                  {errorConfig}
                </div>
              )}

              <article className="bg-white border border-sereno rounded-lg p-6">
                <h2 className="mt-0">Días de funcionamiento</h2>
                <div className="flex gap-3 flex-wrap">
                  {dias.map((dia) => (
                    <label
                      key={dia.diaSemana}
                      className={`flex items-center gap-1.5 min-h-[44px] px-2 rounded-md border cursor-pointer ${
                        dia.habilitado ? 'border-peridot' : 'border-sereno'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={dia.habilitado}
                        onChange={(event) =>
                          setDias(
                            dias.map((item) =>
                              item.diaSemana === dia.diaSemana
                                ? { ...item, habilitado: event.target.checked }
                                : item,
                            ),
                          )
                        }
                      />
                      {NOMBRES_DIA[dia.diaSemana]}
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={guardando}
                  onClick={() => void guardarConfig(token, 'dias')}
                  className="mt-4 min-h-[44px] rounded-md px-4 py-2.5 font-bold cursor-pointer bg-peridot text-whisper border-none disabled:opacity-60 disabled:cursor-wait"
                >
                  {guardando ? 'Guardando…' : 'Guardar días'}
                </button>
              </article>

              <article className="bg-white border border-sereno rounded-lg p-6">
                <h2 className="mt-0">Rangos horarios</h2>
                <ul className="list-none m-0 p-0 grid gap-3">
                  {rangos.map((rango, indice) => (
                    <li key={rango.id ?? `nueva-${indice}`} className="flex gap-3 flex-wrap items-center">
                      <input
                        type="text"
                        aria-label="Nombre de la franja"
                        placeholder="apertura"
                        maxLength={50}
                        value={rango.nombre}
                        onChange={(event) =>
                          setRangos(
                            rangos.map((item, i) =>
                              i === indice ? { ...item, nombre: event.target.value } : item,
                            ),
                          )
                        }
                        className="min-h-[44px] rounded-md border border-sereno px-3 py-2.5 text-base flex-[1_1_140px]"
                      />
                      <input
                        type="time"
                        aria-label="Hora de inicio"
                        value={rango.horaInicio}
                        onChange={(event) =>
                          setRangos(
                            rangos.map((item, i) =>
                              i === indice ? { ...item, horaInicio: event.target.value } : item,
                            ),
                          )
                        }
                        className="min-h-[44px] rounded-md border border-sereno px-3 py-2.5 text-base"
                      />
                      <input
                        type="time"
                        aria-label="Hora de fin"
                        value={rango.horaFin}
                        onChange={(event) =>
                          setRangos(
                            rangos.map((item, i) =>
                              i === indice ? { ...item, horaFin: event.target.value } : item,
                            ),
                          )
                        }
                        className="min-h-[44px] rounded-md border border-sereno px-3 py-2.5 text-base"
                      />
                      <button
                        type="button"
                        aria-label={`Quitar franja ${rango.nombre || indice + 1}`}
                        onClick={() => setRangos(rangos.filter((_, i) => i !== indice))}
                        className="min-h-[44px] min-w-[44px] rounded-md cursor-pointer bg-white border border-sereno"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-3 mt-4">
                  <button
                    type="button"
                    onClick={() =>
                      setRangos([...rangos, { nombre: '', horaInicio: '08:00', horaFin: '22:00' }])
                    }
                    className="min-h-[44px] rounded-md px-4 py-2.5 cursor-pointer bg-white border border-musgo text-musgo font-semibold"
                  >
                    + Agregar franja
                  </button>
                  <button
                    type="button"
                    disabled={guardando}
                    onClick={() => void guardarConfig(token, 'rangos')}
                    className="min-h-[44px] rounded-md px-4 py-2.5 font-bold cursor-pointer bg-peridot text-whisper border-none disabled:opacity-60 disabled:cursor-wait"
                  >
                    {guardando ? 'Guardando…' : 'Guardar franjas'}
                  </button>
                </div>
              </article>

              <article className="bg-white border border-sereno rounded-lg p-6 text-sereno">
                <h2 className="mt-0">Duración de turnos</h2>
                <p className="m-0">
                  Todavía no se puede editar acá: falta el listado de tipos de turno en la API
                  (PATCH /config/tipos-turno/:id ya existe, el GET no). Queda pendiente del backend.
                </p>
              </article>
            </>
          ) : (
            <EmptyState message="Sin datos de configuración." />
          )}
        </section>
      )}
    </div>
  );
}
