// Panel admin del club: turnos con filtros, pagos y reportes.
// Todo sale de endpoints solo-admin del backend; la pagina ademas
// verifica el rol del perfil y muestra un aviso si no es admin.
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useAuth } from '@clerk/react';
import { Navigate } from 'react-router-dom';
import { Pencil, Search, X } from 'lucide-react';
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

/** Pretty labels for the rol chips (the API stores lowercase). */
const ETIQUETAS_ROL: Record<string, string> = {
  admin: 'Admin',
  socio: 'Socio',
  no_socio: 'No Socio',
};

const ROLES = ['admin', 'socio', 'no_socio'] as const;
const ESTADOS = ['activo', 'moroso', 'suspendido', 'inactivo'] as const;

function iniciales(nombre: string, apellido: string): string {
  return `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase();
}

interface FormEdicionT {
  nombre: string;
  apellido: string;
  telefono: string;
  dni: string;
  estadoActual: string;
}

interface TableRowUsuarioProps {
  u: Usuario;
  editando: boolean;
  formEdicion: FormEdicionT | null;
  rolElegido: string;
  confirmandoBaja: boolean;
  guardando: boolean;
  token: string | null;
  onEditar: () => void;
  onFormChange: Dispatch<SetStateAction<FormEdicionT | null>>;
  onGuardarEdicion: () => void;
  onRolElegido: (rol: string) => void;
  onGuardarRol: () => void;
  onPedirBaja: () => void;
  onConfirmarBaja: () => void;
  onCancelarBaja: () => void;
}

/** One user: data row plus its expanded editing row (colspan) when active. */
function TableRowUsuario(props: TableRowUsuarioProps): JSX.Element {
  const {
    u,
    editando,
    formEdicion,
    rolElegido,
    confirmandoBaja,
    guardando,
    token,
    onEditar,
    onFormChange,
    onGuardarEdicion,
    onRolElegido,
    onGuardarRol,
    onPedirBaja,
    onConfirmarBaja,
    onCancelarBaja,
  } = props;
  void token;

  return (
    <>
      <tr className="transition-colors hover:bg-peridot/5">
        <td className="px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="grid size-9 shrink-0 place-items-center rounded-full bg-linear-135 from-musgo to-peridot text-xs font-semibold text-white"
            >
              {iniciales(u.nombre, u.apellido)}
            </span>
            <div>
              <div className="font-semibold text-musgo">
                {u.nombre} {u.apellido}
              </div>
              <div className="text-[11px] text-[#5A6661]">@{u.username}</div>
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-[#5A6661]">
          <div>{u.email}</div>
          <div className="text-[11px]">
            DNI {u.dni}
            {u.telefono !== null ? ` · ${u.telefono}` : ''}
          </div>
        </td>
        <td className="px-4 py-3 text-center">
          {u.rol !== null ? (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${
                CHIP_ROL[u.rol] ?? CHIP_ROL.no_socio
              }`}
            >
              {ETIQUETAS_ROL[u.rol] ?? u.rol}
            </span>
          ) : (
            <span className="text-[#5A6661]">—</span>
          )}
          {u.numeroSocio !== null && (
            <div className="mt-1 text-[11px] text-[#5A6661]">socio {u.numeroSocio}</div>
          )}
        </td>
        <td className="px-4 py-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              CHIP_ESTADO[u.estadoActual] ?? CHIP_ESTADO.inactivo
            }`}
          >
            <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
            {u.estadoActual}
          </span>
        </td>
        <td className="px-4 py-3 text-[#5A6661] tabular-nums">{formatoFechaCorta(u.createdAt)}</td>
        <td className="px-4 py-3">
          <div className="flex justify-end gap-1">
            <button
              type="button"
              aria-label={editando ? `Cerrar edición de ${u.nombre}` : `Editar ${u.nombre} ${u.apellido}`}
              aria-expanded={editando}
              onClick={onEditar}
              className="grid size-11 place-items-center rounded-md text-[#5A6661] bg-white border border-sereno transition hover:text-peridot hover:border-peridot cursor-pointer focus-visible:outline-2 focus-visible:outline-peridot"
            >
              {editando ? (
                <X className="size-4" aria-hidden="true" />
              ) : (
                <Pencil className="size-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </td>
      </tr>

      {editando && formEdicion !== null && (
        <tr>
          <td colSpan={6} className="bg-[#FBFCFB] px-4 py-4">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                onGuardarEdicion();
              }}
              className="flex flex-col gap-3"
            >
              <div className="flex gap-3 flex-wrap">
                <input
                  type="text"
                  aria-label="Nombre"
                  placeholder="Nombre"
                  maxLength={100}
                  value={formEdicion.nombre}
                  onChange={(event) => onFormChange({ ...formEdicion, nombre: event.target.value })}
                  className="min-h-[44px] rounded-md border border-sereno px-3 py-2.5 text-base bg-white flex-[1_1_160px]"
                />
                <input
                  type="text"
                  aria-label="Apellido"
                  placeholder="Apellido"
                  maxLength={100}
                  value={formEdicion.apellido}
                  onChange={(event) => onFormChange({ ...formEdicion, apellido: event.target.value })}
                  className="min-h-[44px] rounded-md border border-sereno px-3 py-2.5 text-base bg-white flex-[1_1_160px]"
                />
                <input
                  type="tel"
                  aria-label="Teléfono"
                  placeholder="Teléfono (opcional)"
                  maxLength={30}
                  value={formEdicion.telefono}
                  onChange={(event) => onFormChange({ ...formEdicion, telefono: event.target.value })}
                  className="min-h-[44px] rounded-md border border-sereno px-3 py-2.5 text-base bg-white flex-[1_1_160px]"
                />
                <input
                  type="text"
                  aria-label="DNI"
                  placeholder="DNI"
                  maxLength={15}
                  value={formEdicion.dni}
                  onChange={(event) => onFormChange({ ...formEdicion, dni: event.target.value })}
                  className="min-h-[44px] rounded-md border border-sereno px-3 py-2.5 text-base bg-white flex-[1_1_120px]"
                />
                <select
                  aria-label="Estado del usuario"
                  value={formEdicion.estadoActual}
                  onChange={(event) =>
                    onFormChange({ ...formEdicion, estadoActual: event.target.value })
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
              <div>
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
                    value={rolElegido}
                    onChange={(event) => onRolElegido(event.target.value)}
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
                  disabled={guardando || rolElegido === ''}
                  onClick={onGuardarRol}
                  className="min-h-[44px] rounded-md px-4 py-2.5 font-semibold cursor-pointer bg-musgo text-whisper border-none disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Aplicar rol
                </button>
                {confirmandoBaja ? (
                  <>
                    <button
                      type="button"
                      disabled={guardando}
                      onClick={onConfirmarBaja}
                      className="min-h-[44px] rounded-md px-4 py-2.5 font-bold cursor-pointer bg-error text-white border-none disabled:opacity-60"
                    >
                      {guardando ? 'Dando de baja…' : 'Confirmar baja'}
                    </button>
                    <button
                      type="button"
                      onClick={onCancelarBaja}
                      className="min-h-[44px] rounded-md px-4 py-2.5 cursor-pointer bg-white border border-sereno"
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={onPedirBaja}
                    disabled={guardando || u.estadoActual === 'inactivo'}
                    className="min-h-[44px] rounded-md px-4 py-2.5 cursor-pointer bg-white border border-error text-error font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Dar de baja
                  </button>
                )}
              </div>
            </form>
          </td>
        </tr>
      )}
    </>
  );
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
  const [busquedaU, setBusquedaU] = useState('');
  const [filtroEstadoU, setFiltroEstadoU] = useState<'todos' | (typeof ESTADOS)[number]>('todos');
  const [ordenU, setOrdenU] = useState<{ key: 'nombre' | 'alta'; dir: 'asc' | 'desc' }>({
    key: 'nombre',
    dir: 'asc',
  });
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
          setUsuarios(await api.usuarios(authToken));
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

  /** Live filtering + sorting for the usuarios table (client-side, demo-style). */
  const qU = busquedaU.trim().toLowerCase();
  const usuariosVisibles = useMemo(() => {
    const dir = ordenU.dir === 'asc' ? 1 : -1;
    return usuarios
      .filter((u) => {
        const okEstado = filtroEstadoU === 'todos' || u.estadoActual === filtroEstadoU;
        const texto = `${u.nombre} ${u.apellido} ${u.email} ${u.username}`.toLowerCase();
        return okEstado && (qU === '' || texto.includes(qU));
      })
      .sort((a, b) => {
        const x = ordenU.key === 'nombre' ? `${a.apellido} ${a.nombre}`.toLowerCase() : a.createdAt;
        const y = ordenU.key === 'nombre' ? `${b.apellido} ${b.nombre}`.toLowerCase() : b.createdAt;
        return (x > y ? 1 : x < y ? -1 : 0) * dir;
      });
  }, [usuarios, qU, filtroEstadoU, ordenU]);

  const ordenarPor = (key: 'nombre' | 'alta'): void => {
    setOrdenU((prev) =>
      prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' },
    );
  };

  const ariaSortU = (key: 'nombre' | 'alta'): 'ascending' | 'descending' | 'none' => {
    if (ordenU.key !== key) {
      return 'none';
    }
    return ordenU.dir === 'asc' ? 'ascending' : 'descending';
  };

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
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-baseline gap-3">
              <h2 className="m-0 text-lg font-semibold text-musgo">Usuarios del club</h2>
              <span
                role="status"
                className="rounded-full bg-[#E8F5F0] px-2.5 py-0.5 text-xs font-semibold text-musgo border border-sereno"
              >
                {usuariosVisibles.length}{' '}
                {usuariosVisibles.length === 1 ? 'usuario' : 'usuarios'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="relative">
                <span className="sr-only">Buscar por nombre, email o usuario</span>
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#5A6661]"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  placeholder="Buscar nombre o email…"
                  value={busquedaU}
                  onChange={(event) => setBusquedaU(event.target.value)}
                  className="min-h-[44px] w-56 rounded-lg bg-white pl-9 pr-3 text-sm text-musgo border border-sereno transition placeholder:text-[#5A6661] focus:outline-none focus:ring-2 focus:ring-peridot"
                />
              </label>
              <div
                className="flex gap-1 rounded-lg bg-white p-1 border border-sereno"
                role="group"
                aria-label="Filtrar por estado"
              >
                {(['todos', ...ESTADOS] as const).map((filtro) => (
                  <button
                    key={filtro}
                    type="button"
                    aria-pressed={filtroEstadoU === filtro}
                    onClick={() => setFiltroEstadoU(filtro)}
                    className={`min-h-[36px] rounded-md px-3 text-xs font-semibold transition cursor-pointer ${
                      filtroEstadoU === filtro
                        ? 'bg-[#E8F5F0] text-peridot'
                        : 'text-[#5A6661] hover:text-musgo'
                    }`}
                  >
                    {filtro === 'todos' ? 'Todos' : filtro}
                  </button>
                ))}
              </div>
            </div>
          </header>

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
            <EmptyState message="Todavía no hay usuarios registrados." />
          ) : (
            <div
              tabIndex={0}
              role="region"
              aria-label="Usuarios, tabla deslizable"
              className="relative max-h-[26rem] overflow-auto rounded-xl bg-white border border-sereno focus-visible:outline-2 focus-visible:outline-peridot"
            >
              <table className="w-full min-w-[820px] border-collapse text-left text-[13px]">
                <caption className="sr-only">
                  Usuarios del club con rol, estado, socio y fecha de alta
                </caption>
                <thead>
                  <tr className="bg-[#E8F5F0] shadow-[inset_0_-1px_0_var(--color-sereno)]">
                    <th
                      scope="col"
                      aria-sort={ariaSortU('nombre')}
                      className="sticky top-0 z-10 bg-[#E8F5F0] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5A6661]"
                    >
                      <button
                        type="button"
                        onClick={() => ordenarPor('nombre')}
                        className="inline-flex min-h-[36px] items-center gap-1.5 rounded px-2 uppercase transition hover:text-musgo cursor-pointer focus-visible:outline-2 focus-visible:outline-peridot"
                      >
                        Usuario
                        <svg
                          className={`size-3.5 transition ${
                            ordenU.key === 'nombre' && ordenU.dir === 'desc' ? 'rotate-180' : ''
                          } ${ordenU.key === 'nombre' ? 'opacity-100 text-peridot' : 'opacity-50'}`}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.4"
                          strokeLinecap="round"
                          aria-hidden="true"
                        >
                          <path d="M12 19V5M6 11l6-6 6 6" />
                        </svg>
                      </button>
                    </th>
                    <th
                      scope="col"
                      className="sticky top-0 z-10 bg-[#E8F5F0] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5A6661]"
                    >
                      Email
                    </th>
                    <th
                      scope="col"
                      className="sticky top-0 z-10 bg-[#E8F5F0] px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5A6661]"
                    >
                      Rol
                    </th>
                    <th
                      scope="col"
                      className="sticky top-0 z-10 bg-[#E8F5F0] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5A6661]"
                    >
                      Estado
                    </th>
                    <th
                      scope="col"
                      className="sticky top-0 z-10 bg-[#E8F5F0] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5A6661]"
                    >
                      Alta
                    </th>
                    <th
                      scope="col"
                      className="sticky top-0 z-10 bg-[#E8F5F0] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5A6661]"
                    >
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ECEEEB]">
                  {usuariosVisibles.map((u) => (
                    <TableRowUsuario
                      key={u.id}
                      u={u}
                      editando={editandoId === u.id}
                      formEdicion={editandoId === u.id ? formEdicion : null}
                      rolElegido={rolElegido[u.id] ?? ''}
                      confirmandoBaja={confirmandoBaja === u.id}
                      guardando={guardando}
                      token={token}
                      onEditar={() =>
                        editandoId === u.id ? setEditandoId(null) : abrirEdicion(u)
                      }
                      onFormChange={setFormEdicion}
                      onGuardarEdicion={() => void guardarEdicion(token, u.id)}
                      onRolElegido={(rol) =>
                        setRolElegido((prev) => ({ ...prev, [u.id]: rol }))
                      }
                      onGuardarRol={() => void guardarRol(token, u)}
                      onPedirBaja={() => setConfirmandoBaja(u.id)}
                      onConfirmarBaja={() => void darDeBaja(token, u.id)}
                      onCancelarBaja={() => setConfirmandoBaja(null)}
                    />
                  ))}
                  {usuariosVisibles.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-12 text-center text-[#5A6661]"
                      >
                        No hay usuarios para ese filtro.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
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
