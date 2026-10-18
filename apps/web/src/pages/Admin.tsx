// Panel admin del club: turnos con filtros, pagos y reportes.
// Todo sale de endpoints solo-admin del backend; la pagina ademas
// verifica el rol del perfil y muestra un aviso si no es admin.
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/react';
import {
  ApiError,
  api,
  type EstadisticasResponse,
  type FinancieroResponse,
  type PagoTurno,
  type TurnoAdmin,
} from '../lib/api';
import { EmptyState, ErrorCard, Skeleton, StatusPill } from '../components/Feedback';
import { tokens } from '../styles/tokens';

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

const cardStyle = {
  backgroundColor: tokens.colors.blanco,
  border: `1px solid ${tokens.colors.sereno}`,
  borderRadius: tokens.radius.lg,
  padding: tokens.spacing.lg,
} as const;

const inputStyle = {
  minHeight: '44px',
  borderRadius: tokens.radius.md,
  border: `1px solid ${tokens.colors.sereno}`,
  padding: '0.6rem 0.75rem',
  fontSize: '1rem',
} as const;

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
    return (
      <section aria-labelledby="admin-titulo" style={cardStyle}>
        <h1 id="admin-titulo" style={{ marginTop: 0 }}>
          Panel admin
        </h1>
        <p>Esta sección es solo para administradores del club.</p>
      </section>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.lg }}>
      <header>
        <p style={{ margin: 0, color: tokens.colors.sereno, fontWeight: 600 }}>Club · Admin</p>
        <h1 style={{ margin: '0.25rem 0 0' }}>Panel admin</h1>
      </header>

      <div style={{ display: 'flex', gap: tokens.spacing.xs }} role="tablist" aria-label="Panel admin">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            style={{
              minHeight: '44px',
              borderRadius: tokens.radius.pill,
              padding: '0.5rem 1rem',
              fontWeight: 600,
              cursor: 'pointer',
              backgroundColor: tab === item.id ? tokens.colors.musgo : tokens.colors.blanco,
              color: tab === item.id ? tokens.colors.whisper : tokens.colors.musgo,
              border: `1px solid ${tab === item.id ? tokens.colors.musgo : tokens.colors.sereno}`,
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'turnos' && (
        <section aria-label="Turnos" style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.md }}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void cargar(token, 'turnos');
            }}
            style={{ display: 'flex', gap: tokens.spacing.sm, flexWrap: 'wrap' }}
          >
            <input
              type="search"
              aria-label="Buscar por nombre o apellido"
              placeholder="Buscar socio…"
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              style={inputStyle}
            />
            <input
              type="date"
              aria-label="Fecha exacta"
              value={fecha}
              onChange={(event) => setFecha(event.target.value)}
              style={inputStyle}
            />
            <button
              type="submit"
              style={{
                minHeight: '44px',
                borderRadius: tokens.radius.md,
                padding: '0.6rem 1rem',
                fontWeight: 700,
                cursor: 'pointer',
                backgroundColor: tokens.colors.peridot,
                color: tokens.colors.whisper,
                border: 'none',
              }}
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
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: tokens.spacing.sm }}>
              {turnos.map((turno) => (
                <li key={turno.id} style={cardStyle}>
                  <div style={{ display: 'flex', gap: tokens.spacing.sm, flexWrap: 'wrap', alignItems: 'center' }}>
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
        <section aria-label="Pagos" style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.md }}>
          {cargando ? (
            <Skeleton rows={4} label="Cargando pagos…" />
          ) : error ? (
            <ErrorCard message={error} onRetry={() => void cargar(token, 'pagos')} />
          ) : pagos.length === 0 ? (
            <EmptyState message="Todavía no hay pagos registrados." />
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: tokens.spacing.sm }}>
              {pagos.map((pago) => (
                <li key={pago.id} style={cardStyle}>
                  <div style={{ display: 'flex', gap: tokens.spacing.sm, flexWrap: 'wrap', alignItems: 'center' }}>
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
        <section aria-label="Reportes" style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.md }}>
          {cargando ? (
            <Skeleton rows={3} label="Cargando reportes…" />
          ) : error ? (
            <ErrorCard message={error} onRetry={() => void cargar(token, 'reportes')} />
          ) : estadisticas && financiero ? (
            <>
              <article style={cardStyle}>
                <h2 style={{ marginTop: 0 }}>Turnos</h2>
                <p style={{ fontSize: '2rem', margin: '0.25rem 0', fontVariantNumeric: 'tabular-nums' }}>
                  {estadisticas.turnos.total}
                </p>
                <p style={{ margin: 0, color: tokens.colors.sereno }}>
                  Socios activos: {estadisticas.usuarios.sociosActivos} · Morosos:{' '}
                  {estadisticas.usuarios.morosos}
                </p>
              </article>
              <article style={cardStyle}>
                <h2 style={{ marginTop: 0 }}>Ingresos</h2>
                <p style={{ fontSize: '2rem', margin: '0.25rem 0', fontVariantNumeric: 'tabular-nums' }}>
                  {formatoMoneda(financiero.ingresos.total)}
                </p>
                <p style={{ margin: 0, color: tokens.colors.sereno }}>
                  Turnos: {formatoMoneda(financiero.ingresos.pagosTurno)} · Luz:{' '}
                  {formatoMoneda(financiero.ingresos.pagosLuz)} · Cuotas:{' '}
                  {formatoMoneda(financiero.ingresos.cuotasCobradas)}
                </p>
              </article>
              <article style={cardStyle}>
                <h2 style={{ marginTop: 0 }}>Cuotas</h2>
                <p style={{ margin: 0 }}>
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
