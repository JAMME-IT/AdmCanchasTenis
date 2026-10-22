// Panel admin del club: turnos con filtros, pagos y reportes.
// Todo sale de endpoints solo-admin del backend; la pagina ademas
// verifica el rol del perfil y muestra un aviso si no es admin.
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/react';
import { Navigate } from 'react-router-dom';
import {
  ApiError,
  api,
  type EstadisticasResponse,
  type FinancieroResponse,
  type PagoTurno,
  type TurnoAdmin,
} from '../lib/api';
import { EmptyState, ErrorCard, Skeleton, StatusPill } from '../components/Feedback';

type Tab = 'turnos' | 'pagos' | 'reportes';

const TABS: { id: Tab; label: string }[] = [
  { id: 'turnos', label: 'Turnos' },
  { id: 'pagos', label: 'Pagos' },
  { id: 'reportes', label: 'Reportes' },
];

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
    </div>
  );
}
