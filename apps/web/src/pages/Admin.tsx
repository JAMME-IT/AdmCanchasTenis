// Panel admin del club: turnos con filtros, pagos y reportes.
// Todo sale de endpoints solo-admin del backend; la pagina ademas
// verifica el rol del perfil y muestra un aviso si no es admin.
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/react';
import { Navigate } from 'react-router-dom';
import {
  ApiError,
  api,
  type CambiarRolBody,
  type DiaFuncionamiento,
  type EditarUsuarioBody,
  type EstadisticasResponse,
  type FinancieroResponse,
  type PagoTurno,
  type RangoHorarioBody,
  type TurnoAdmin,
  type Usuario,
  type UsuariosParams,
} from '../lib/api';
import { EmptyState, ErrorCard, Skeleton, StatusPill } from '../components/Feedback';

type Tab = 'turnos' | 'pagos' | 'reportes' | 'usuarios' | 'config';

const TABS: { id: Tab; label: string }[] = [
  { id: 'turnos', label: 'Turnos' },
  { id: 'pagos', label: 'Pagos' },
  { id: 'reportes', label: 'Reportes' },
  { id: 'usuarios', label: 'Usuarios' },
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

/** Chip colors per usuario estado (mirrors the StatusPill tone pattern). */
const CHIP_ESTADO: Record<string, string> = {
  activo: 'bg-[#DDF0E3] text-[#1F6B45] border border-peridot',
  moroso: 'bg-[#FDF0D5] text-[#7A5200] border border-[#C99A2B]',
  suspendido: 'bg-[#FBE3E3] text-error border border-error',
  inactivo: 'bg-[#ECEEEB] text-[#5A6661] border border-sereno',
};

/** Chip colors per rol vigente. */
const CHIP_ROL: Record<string, string> = {
  admin: 'bg-musgo text-whisper border border-musgo',
  socio: 'bg-peridot text-whisper border border-peridot',
  no_socio: 'bg-whisper text-musgo border border-sereno',
};

const ROLES = ['admin', 'socio', 'no_socio'] as const;
const ESTADOS = ['activo', 'moroso', 'suspendido', 'inactivo'] as const;

function iniciales(nombre: string, apellido: string): string {
  return `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase();
}

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
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [uBusqueda, setUBusqueda] = useState('');
  const [uEstado, setUEstado] = useState('');
  const [uRol, setURol] = useState('');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [formEdicion, setFormEdicion] = useState<{
    nombre: string;
    apellido: string;
    telefono: string;
    dni: string;
    estadoActual: string;
  } | null>(null);
  const [rolElegido, setRolElegido] = useState<Record<string, string>>({});
  const [confirmandoBaja, setConfirmandoBaja] = useState<string | null>(null);
  const [errorUsuarios, setErrorUsuarios] = useState<string | null>(null);
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
        } else if (tabActual === 'usuarios') {
          setUsuarios(
            await api.usuarios(authToken, {
              busqueda: uBusqueda.trim() === '' ? undefined : uBusqueda.trim(),
              estado: uEstado === '' ? undefined : (uEstado as UsuariosParams['estado']),
              rol: uRol === '' ? undefined : (uRol as UsuariosParams['rol']),
            }),
          );
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
    [busqueda, fecha, uBusqueda, uEstado, uRol],
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

  /** Opens the inline edit form for one user. */
  const abrirEdicion = (u: Usuario): void => {
    setEditandoId(u.id);
    setFormEdicion({
      nombre: u.nombre,
      apellido: u.apellido,
      telefono: u.telefono ?? '',
      dni: u.dni,
      estadoActual: u.estadoActual,
    });
    setErrorUsuarios(null);
  };

  /** Saves the admin edit (PATCH /usuarios/:id) and swaps the row in place. */
  const guardarEdicion = useCallback(
    async (authToken: string | null, id: string) => {
      if (formEdicion === null) {
        return;
      }
      if (formEdicion.nombre.trim() === '' || formEdicion.apellido.trim() === '') {
        setErrorUsuarios('Nombre y apellido no pueden quedar vacíos.');
        return;
      }
      if (formEdicion.dni.trim() === '') {
        setErrorUsuarios('El DNI no puede quedar vacío.');
        return;
      }
      setErrorUsuarios(null);
      setGuardando(true);
      try {
        const actualizado = await api.editarUsuario(authToken, id, {
          nombre: formEdicion.nombre.trim(),
          apellido: formEdicion.apellido.trim(),
          telefono: formEdicion.telefono.trim() === '' ? null : formEdicion.telefono.trim(),
          dni: formEdicion.dni.trim(),
          estadoActual: formEdicion.estadoActual as EditarUsuarioBody['estadoActual'],
        });
        setUsuarios((lista) => lista.map((u) => (u.id === id ? actualizado : u)));
        setEditandoId(null);
        setFormEdicion(null);
      } catch (caught) {
        setErrorUsuarios(
          caught instanceof ApiError ? caught.message : 'No se pudo guardar el usuario.',
        );
      } finally {
        setGuardando(false);
      }
    },
    [formEdicion],
  );

  /** Changes the vigente role (PATCH /usuarios/:id/rol; socio auto-alta server-side). */
  const guardarRol = useCallback(
    async (authToken: string | null, u: Usuario) => {
      const nuevo = rolElegido[u.id];
      if (nuevo === undefined || nuevo === u.rol) {
        return;
      }
      setErrorUsuarios(null);
      setGuardando(true);
      try {
        const actualizado = await api.cambiarRolUsuario(authToken, u.id, {
          rol: nuevo as CambiarRolBody['rol'],
        });
        setUsuarios((lista) => lista.map((item) => (item.id === u.id ? actualizado : item)));
        setRolElegido((prev) => ({ ...prev, [u.id]: '' }));
      } catch (caught) {
        setErrorUsuarios(
          caught instanceof ApiError ? caught.message : 'No se pudo cambiar el rol.',
        );
      } finally {
        setGuardando(false);
      }
    },
    [rolElegido],
  );

  /** Logical deactivation (DELETE /usuarios/:id), idempotent server-side. */
  const darDeBaja = useCallback(
    async (authToken: string | null, id: string) => {
      setErrorUsuarios(null);
      setGuardando(true);
      try {
        const baja = await api.darDeBajaUsuario(authToken, id);
        setUsuarios((lista) =>
          lista.map((u) => (u.id === id ? { ...u, estadoActual: baja.estadoActual } : u)),
        );
        setConfirmandoBaja(null);
      } catch (caught) {
        setErrorUsuarios(
          caught instanceof ApiError ? caught.message : 'No se pudo dar de baja el usuario.',
        );
      } finally {
        setGuardando(false);
      }
    },
    [],
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
      {tab === 'usuarios' && (
        <section aria-label="Usuarios" className="flex flex-col gap-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void cargar(token, 'usuarios');
            }}
            className="flex gap-3 flex-wrap"
          >
            <input
              type="search"
              aria-label="Buscar por nombre o apellido"
              placeholder="Buscar usuario…"
              value={uBusqueda}
              onChange={(event) => setUBusqueda(event.target.value)}
              className="min-h-[44px] rounded-md border border-sereno px-3 py-2.5 text-base"
            />
            <select
              aria-label="Filtrar por estado"
              value={uEstado}
              onChange={(event) => setUEstado(event.target.value)}
              className="min-h-[44px] rounded-md border border-sereno px-3 py-2.5 text-base bg-white"
            >
              <option value="">Todos los estados</option>
              {ESTADOS.map((estado) => (
                <option key={estado} value={estado}>
                  {estado}
                </option>
              ))}
            </select>
            <select
              aria-label="Filtrar por rol"
              value={uRol}
              onChange={(event) => setURol(event.target.value)}
              className="min-h-[44px] rounded-md border border-sereno px-3 py-2.5 text-base bg-white"
            >
              <option value="">Todos los roles</option>
              {ROLES.map((rol) => (
                <option key={rol} value={rol}>
                  {rol}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="min-h-[44px] rounded-md px-4 py-2.5 font-bold cursor-pointer bg-peridot text-whisper border-none"
            >
              Filtrar
            </button>
          </form>

          {errorUsuarios !== null && (
            <div role="alert" className="bg-white border border-error rounded-lg p-6 text-error">
              {errorUsuarios}
            </div>
          )}

          {cargando ? (
            <Skeleton rows={4} label="Cargando usuarios…" />
          ) : error ? (
            <ErrorCard message={error} onRetry={() => void cargar(token, 'usuarios')} />
          ) : usuarios.length === 0 ? (
            <EmptyState message="No hay usuarios para esos filtros." />
          ) : (
            <ul className="list-none m-0 p-0 grid gap-3">
              {usuarios.map((u) => (
                <li key={u.id} className="bg-white border border-sereno rounded-lg p-6">
                  <div className="flex gap-4 items-start flex-wrap">
                    <div
                      aria-hidden="true"
                      className="w-12 h-12 rounded-full bg-musgo text-whisper flex items-center justify-center font-bold shrink-0"
                    >
                      {iniciales(u.nombre, u.apellido)}
                    </div>
                    <div className="flex flex-col gap-1 flex-1 min-w-[240px]">
                      <div className="flex gap-2 flex-wrap items-center">
                        <strong>
                          {u.nombre} {u.apellido}
                        </strong>
                        <span className={`text-xs font-bold rounded-full px-3 py-1 ${CHIP_ESTADO[u.estadoActual] ?? CHIP_ESTADO.inactivo}`}>
                          {u.estadoActual}
                        </span>
                        {u.rol !== null && (
                          <span className={`text-xs font-bold rounded-full px-3 py-1 ${CHIP_ROL[u.rol] ?? CHIP_ROL.no_socio}`}>
                            {u.rol}
                          </span>
                        )}
                        {u.numeroSocio !== null && (
                          <span className="text-xs font-bold rounded-full px-3 py-1 bg-whisper text-musgo border border-sereno">
                            socio {u.numeroSocio}
                          </span>
                        )}
                      </div>
                      <span className="text-sm text-[#5A6661]">
                        {u.email} · DNI {u.dni}
                        {u.telefono !== null ? ` · ${u.telefono}` : ''}
                      </span>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => (editandoId === u.id ? setEditandoId(null) : abrirEdicion(u))}
                        className="min-h-[44px] rounded-md px-4 py-2.5 cursor-pointer bg-white border border-musgo text-musgo font-semibold"
                      >
                        {editandoId === u.id ? 'Cerrar' : 'Editar'}
                      </button>
                    </div>
                  </div>

                  {editandoId === u.id && formEdicion !== null && (
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        void guardarEdicion(token, u.id);
                      }}
                      className="flex flex-col gap-3 mt-4 pt-4 border-t border-sereno"
                    >
                      <div className="flex gap-3 flex-wrap">
                        <input
                          type="text"
                          aria-label="Nombre"
                          placeholder="Nombre"
                          maxLength={100}
                          value={formEdicion.nombre}
                          onChange={(event) =>
                            setFormEdicion({ ...formEdicion, nombre: event.target.value })
                          }
                          className="min-h-[44px] rounded-md border border-sereno px-3 py-2.5 text-base flex-[1_1_160px]"
                        />
                        <input
                          type="text"
                          aria-label="Apellido"
                          placeholder="Apellido"
                          maxLength={100}
                          value={formEdicion.apellido}
                          onChange={(event) =>
                            setFormEdicion({ ...formEdicion, apellido: event.target.value })
                          }
                          className="min-h-[44px] rounded-md border border-sereno px-3 py-2.5 text-base flex-[1_1_160px]"
                        />
                        <input
                          type="tel"
                          aria-label="Teléfono"
                          placeholder="Teléfono (opcional)"
                          maxLength={30}
                          value={formEdicion.telefono}
                          onChange={(event) =>
                            setFormEdicion({ ...formEdicion, telefono: event.target.value })
                          }
                          className="min-h-[44px] rounded-md border border-sereno px-3 py-2.5 text-base flex-[1_1_160px]"
                        />
                        <input
                          type="text"
                          aria-label="DNI"
                          placeholder="DNI"
                          maxLength={15}
                          value={formEdicion.dni}
                          onChange={(event) =>
                            setFormEdicion({ ...formEdicion, dni: event.target.value })
                          }
                          className="min-h-[44px] rounded-md border border-sereno px-3 py-2.5 text-base flex-[1_1_120px]"
                        />
                        <select
                          aria-label="Estado del usuario"
                          value={formEdicion.estadoActual}
                          onChange={(event) =>
                            setFormEdicion({ ...formEdicion, estadoActual: event.target.value })
                          }
                          className="min-h-[44px] rounded-md border border-sereno px-3 py-2.5 text-base bg-white"
                        >
                          {ESTADOS.map((estado) => (
                            <option key={estado} value={estado}>
                              {estado}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex gap-3 flex-wrap">
                        <button
                          type="submit"
                          disabled={guardando}
                          className="min-h-[44px] rounded-md px-4 py-2.5 font-bold cursor-pointer bg-peridot text-whisper border-none disabled:opacity-60 disabled:cursor-wait"
                        >
                          {guardando ? 'Guardando…' : 'Guardar cambios'}
                        </button>
                      </div>

                      <div className="flex gap-3 flex-wrap items-center pt-3 border-t border-[#ECEEEB]">
                        <label className="flex items-center gap-2 min-h-[44px]">
                          Cambiar rol:
                          <select
                            aria-label="Nuevo rol"
                            value={rolElegido[u.id] ?? ''}
                            onChange={(event) =>
                              setRolElegido((prev) => ({ ...prev, [u.id]: event.target.value }))
                            }
                            className="min-h-[44px] rounded-md border border-sereno px-3 py-2.5 text-base bg-white"
                          >
                            <option value="">Elegir…</option>
                            {ROLES.filter((rol) => rol !== u.rol).map((rol) => (
                              <option key={rol} value={rol}>
                                {rol}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          type="button"
                          disabled={guardando || rolElegido[u.id] === undefined || rolElegido[u.id] === ''}
                          onClick={() => void guardarRol(token, u)}
                          className="min-h-[44px] rounded-md px-4 py-2.5 font-semibold cursor-pointer bg-musgo text-whisper border-none disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          Aplicar rol
                        </button>
                        {confirmandoBaja === u.id ? (
                          <>
                            <button
                              type="button"
                              disabled={guardando}
                              onClick={() => void darDeBaja(token, u.id)}
                              className="min-h-[44px] rounded-md px-4 py-2.5 font-bold cursor-pointer bg-error text-white border-none disabled:opacity-60"
                            >
                              {guardando ? 'Dando de baja…' : 'Confirmar baja'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmandoBaja(null)}
                              className="min-h-[44px] rounded-md px-4 py-2.5 cursor-pointer bg-white border border-sereno"
                            >
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmandoBaja(u.id)}
                            disabled={guardando || u.estadoActual === 'inactivo'}
                            className="min-h-[44px] rounded-md px-4 py-2.5 cursor-pointer bg-white border border-error text-error font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Dar de baja
                          </button>
                        )}
                      </div>
                    </form>
                  )}
                </li>
              ))}
            </ul>
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
