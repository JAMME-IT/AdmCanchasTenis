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
  type Cancha,
  type DiaFuncionamiento,
  type EditarUsuarioBody,
  type EstadoCancha,
  type EstadoCanchaValor,
  type EstadisticasResponse,
  type FinancieroResponse,
  type HistorialTarifasParams,
  type PagoLuz,
  type PagoTurno,
  type PagosLuzParams,
  type RangoHorarioBody,
  type SuperficieCancha,
  type TarifaHistorialItem,
  type TarifaLuz,
  type TarifasResponse,
  type TipoTarifaHistorial,
  type TurnoAdmin,
  type Usuario,
} from '../lib/api';
import { EmptyState, ErrorCard, Skeleton, StatusPill } from '../components/Feedback';

type Tab =
  | 'turnos'
  | 'canchas'
  | 'pagos'
  | 'reportes'
  | 'usuarios'
  | 'tarifas'
  | 'luz'
  | 'historial'
  | 'config';

const TABS: { id: Tab; label: string }[] = [
  { id: 'turnos', label: 'Turnos' },
  { id: 'canchas', label: 'Canchas' },
  { id: 'pagos', label: 'Pagos' },
  { id: 'reportes', label: 'Reportes' },
  { id: 'usuarios', label: 'Usuarios' },
  { id: 'tarifas', label: 'Tarifas' },
  { id: 'luz', label: 'Luz' },
  { id: 'historial', label: 'Historial' },
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

/** Human labels for the tariff history type (ACT-44). */
const ETIQUETAS_TIPO_TARIFA: Record<TipoTarifaHistorial, string> = {
  turno: 'Turno',
  luz: 'Luz',
  cuota: 'Cuota',
};

const CHIP_TIPO_TARIFA: Record<TipoTarifaHistorial, string> = {
  turno: 'bg-[#E8F5F0] text-musgo',
  luz: 'bg-[#FDF0D5] text-[#7A5200]',
  cuota: 'bg-[#ECEEEB] text-[#5A6661]',
};

const ROLES = ['admin', 'socio', 'no_socio'] as const;
const ESTADOS = ['activo', 'moroso', 'suspendido', 'inactivo'] as const;

/** Human labels for the court surface enum (API stores snake_case). */
const SUPERFICIES: { value: SuperficieCancha; label: string }[] = [
  { value: 'dura', label: 'Dura' },
  { value: 'polvo_de_ladrillo', label: 'Polvo de ladrillo' },
  { value: 'cesped', label: 'Césped' },
];

/** Human labels for the court operational state enum. */
const ESTADOS_CANCHA: { value: EstadoCanchaValor; label: string }[] = [
  { value: 'disponible', label: 'Disponible' },
  { value: 'en_mantenimiento', label: 'En mantenimiento' },
  { value: 'inhabilitada', label: 'Inhabilitada' },
];

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

interface FormEdicionCanchaT {
  superficie: SuperficieCancha;
  iluminacion: boolean;
  estado: EstadoCanchaValor;
  motivo: string;
}

/** Compares the unified court form with the stored court to know which PATCH each change needs. */
function compararFormCancha(
  cancha: Cancha,
  form: FormEdicionCanchaT,
): { datos: boolean; estado: boolean } {
  return {
    datos: form.superficie !== cancha.superficie || form.iluminacion !== cancha.iluminacion,
    estado: form.estado !== cancha.estadoActual,
  };
}

interface FormEdicionUsuarioProps {
  u: Usuario;
  formEdicion: FormEdicionT;
  rolElegido: string;
  confirmandoBaja: boolean;
  guardando: boolean;
  onFormChange: Dispatch<SetStateAction<FormEdicionT | null>>;
  onGuardarEdicion: () => void;
  onRolElegido: (rol: string) => void;
  onGuardarRol: () => void;
  onPedirBaja: () => void;
  onConfirmarBaja: () => void;
  onCancelarBaja: () => void;
}

/** Admin edit + role change + logical deactivation for one user. Shared by the
 * desktop table row and the mobile stacked card. */
function FormEdicionUsuario(props: FormEdicionUsuarioProps): JSX.Element {
  const {
    u,
    formEdicion,
    rolElegido,
    confirmandoBaja,
    guardando,
    onFormChange,
    onGuardarEdicion,
    onRolElegido,
    onGuardarRol,
    onPedirBaja,
    onConfirmarBaja,
    onCancelarBaja,
  } = props;

  return (
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
          onChange={(event) => onFormChange({ ...formEdicion, estadoActual: event.target.value })}
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
                {ETIQUETAS_ROL[rol] ?? rol}
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
  );
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
  const { u, editando, formEdicion, onEditar } = props;

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
        <td className="px-4 py-3 text-[#5A6661] min-w-0">
          <div className="break-all">{u.email}</div>
          {u.telefono !== null && u.telefono !== '' && (
            <div className="text-[11px] break-words">{u.telefono}</div>
          )}
        </td>
        <td className="px-4 py-3 text-[#5A6661] tabular-nums whitespace-nowrap">{u.dni}</td>
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
          <td colSpan={7} className="bg-[#FBFCFB] px-4 py-4">
            <FormEdicionUsuario
              u={u}
              formEdicion={formEdicion}
              rolElegido={props.rolElegido}
              confirmandoBaja={props.confirmandoBaja}
              guardando={props.guardando}
              onFormChange={props.onFormChange}
              onGuardarEdicion={props.onGuardarEdicion}
              onRolElegido={props.onRolElegido}
              onGuardarRol={props.onGuardarRol}
              onPedirBaja={props.onPedirBaja}
              onConfirmarBaja={props.onConfirmarBaja}
              onCancelarBaja={props.onCancelarBaja}
            />
          </td>
        </tr>
      )}
    </>
  );
}

interface EditorCanchaProps {
  cancha: Cancha;
  formEdicion: FormEdicionCanchaT;
  guardando: boolean;
  onFormChange: Dispatch<SetStateAction<FormEdicionCanchaT | null>>;
  onGuardar: () => void;
  onCancelar: () => void;
}

/** Single inline form for one court: data, state and the reason for a non-available state.
 * Shared by the desktop table row and the mobile stacked card. */
function EditorCancha(props: EditorCanchaProps): JSX.Element {
  const { cancha, formEdicion } = props;
  const cambios = compararFormCancha(cancha, formEdicion);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        props.onGuardar();
      }}
      className="flex flex-col gap-3"
    >
      <div className="flex gap-3 flex-wrap items-end">
        <label className="flex flex-col gap-1 text-sm text-[#5A6661]">
          Superficie
          <select
            aria-label={`Superficie de la cancha ${cancha.nroCancha}`}
            value={formEdicion.superficie}
            onChange={(event) =>
              props.onFormChange({
                ...formEdicion,
                superficie: event.target.value as SuperficieCancha,
              })
            }
            className="min-h-[44px] rounded-md border border-sereno px-3 py-2.5 text-base bg-white text-musgo"
          >
            {SUPERFICIES.map((superficie) => (
              <option key={superficie.value} value={superficie.value}>
                {superficie.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 min-h-[44px] text-sm text-musgo">
          <input
            type="checkbox"
            checked={formEdicion.iluminacion}
            onChange={(event) =>
              props.onFormChange({ ...formEdicion, iluminacion: event.target.checked })
            }
          />
          Con iluminación
        </label>
        <label className="flex flex-col gap-1 text-sm text-[#5A6661]">
          Estado
          <select
            aria-label={`Estado de la cancha ${cancha.nroCancha}`}
            value={formEdicion.estado}
            onChange={(event) => {
              const estado = event.target.value as EstadoCanchaValor;
              props.onFormChange({
                ...formEdicion,
                estado,
                // Leaving `disponible` clears the reason; going back to it keeps none.
                motivo: estado === 'disponible' ? '' : formEdicion.motivo,
              });
            }}
            className="min-h-[44px] rounded-md border border-sereno px-3 py-2.5 text-base bg-white text-musgo"
          >
            {ESTADOS_CANCHA.map((estado) => (
              <option key={estado.value} value={estado.value}>
                {estado.label}
              </option>
            ))}
          </select>
        </label>
        {formEdicion.estado !== 'disponible' && (
          <label className="flex flex-col gap-1 text-sm text-[#5A6661] flex-[1_1_240px]">
            Motivo
            <input
              type="text"
              maxLength={500}
              aria-label={`Motivo del cambio de estado de la cancha ${cancha.nroCancha}`}
              placeholder="Riego programado"
              value={formEdicion.motivo}
              onChange={(event) =>
                props.onFormChange({ ...formEdicion, motivo: event.target.value })
              }
              className="min-h-[44px] rounded-md border border-sereno px-3 py-2.5 text-base bg-white text-musgo"
            />
          </label>
        )}
      </div>
      <div className="flex gap-2 flex-wrap">
        <button
          type="submit"
          disabled={props.guardando || (!cambios.datos && !cambios.estado)}
          className="min-h-[44px] rounded-md px-4 py-2.5 font-bold cursor-pointer bg-peridot text-whisper border-none disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {props.guardando ? 'Guardando…' : 'Guardar cambios'}
        </button>
        <button
          type="button"
          onClick={props.onCancelar}
          disabled={props.guardando}
          className="min-h-[44px] rounded-md px-4 py-2.5 font-semibold cursor-pointer bg-white border border-sereno text-musgo transition hover:border-peridot hover:text-peridot disabled:opacity-60 disabled:cursor-not-allowed"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

interface TableRowCanchaProps {
  cancha: Cancha;
  editando: boolean;
  formEdicion: FormEdicionCanchaT | null;
  guardando: boolean;
  onEditar: () => void;
  onFormChange: Dispatch<SetStateAction<FormEdicionCanchaT | null>>;
  onGuardar: () => void;
  onCancelar: () => void;
}

/** One court: data row plus its expanded editor row when the edit action is open. */
function TableRowCancha(props: TableRowCanchaProps): JSX.Element {
  const { cancha, editando } = props;
  const ultimo = cancha.estados?.[0];

  return (
    <>
      <tr className="transition-colors hover:bg-peridot/5">
        <td className="px-4 py-3 font-semibold text-musgo tabular-nums">{cancha.nroCancha}</td>
        <td className="px-4 py-3 text-[#5A6661]">{etiquetaSuperficie(cancha.superficie)}</td>
        <td className="px-4 py-3 text-[#5A6661]">{cancha.iluminacion ? 'Sí' : 'No'}</td>
        <td className="px-4 py-3">
          <StatusPill
            estado={cancha.estadoActual}
            label={etiquetaEstadoCancha(cancha.estadoActual)}
          />
        </td>
        <td className="px-4 py-3 text-[#5A6661]">
          {ultimo !== undefined ? (
            <div className="flex flex-col gap-0.5">
              <span className="tabular-nums">{formatoFechaHora(ultimo.fechaCambio)}</span>
              {ultimo.motivo !== null && ultimo.motivo !== '' && (
                <span className="text-[11px] break-words">{ultimo.motivo}</span>
              )}
            </div>
          ) : (
            <span>—</span>
          )}
        </td>
        <td className="px-4 py-3">
          <div className="flex justify-end gap-1">
            <button
              type="button"
              aria-label={
                editando
                  ? `Cerrar edición de la cancha ${cancha.nroCancha}`
                  : `Editar cancha ${cancha.nroCancha}`
              }
              aria-expanded={editando}
              onClick={props.onEditar}
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

      {editando && props.formEdicion !== null && (
        <tr>
          <td colSpan={6} className="bg-[#FBFCFB] px-4 py-4">
            <EditorCancha
              cancha={cancha}
              formEdicion={props.formEdicion}
              guardando={props.guardando}
              onFormChange={props.onFormChange}
              onGuardar={props.onGuardar}
              onCancelar={props.onCancelar}
            />
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

/** Light and payment amounts allow cents (ACT-43). */
function formatoMonedaLuz(valor: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 2,
  }).format(valor);
}

/** Tariffs allow cents, so this helper keeps two decimals (ACT-42). */
function formatoMonedaTarifa(valor: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 2,
  }).format(valor);
}

function formatoFechaCorta(fecha: string): string {
  const [anio, mes, dia] = fecha.slice(0, 10).split('-');
  return `${dia}/${mes}/${anio}`;
}

function formatoFechaHora(fecha: string): string {
  const parsed = new Date(fecha);
  if (Number.isNaN(parsed.getTime())) {
    return fecha;
  }
  return parsed.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
}

function etiquetaSuperficie(superficie: SuperficieCancha): string {
  return SUPERFICIES.find((item) => item.value === superficie)?.label ?? superficie;
}

/** Keeps the court list in the same order the API returns it. */
function ordenarCanchas(lista: Cancha[]): Cancha[] {
  return [...lista].sort((a, b) => a.nroCancha - b.nroCancha);
}

/** Resolves the court number from a payment's `canchaId` (ACT-43). */
function nroCanchaPorId(canchas: Cancha[], id: string): number | null {
  return canchas.find((cancha) => cancha.id === id)?.nroCancha ?? null;
}

function etiquetaEstadoCancha(estado: EstadoCanchaValor): string {
  return ESTADOS_CANCHA.find((item) => item.value === estado)?.label ?? estado;
}

/** Maps court API failures to the copy the admin panel shows. */
function mensajeErrorCancha(caught: unknown, porDefecto: string): string {
  if (caught instanceof ApiError) {
    if (caught.status === 422) {
      return 'La cancha ya está en ese estado.';
    }
    return caught.message;
  }
  return porDefecto;
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
  const [canchas, setCanchas] = useState<Cancha[]>([]);
  const [errorCanchas, setErrorCanchas] = useState<string | null>(null);
  const [guardandoCancha, setGuardandoCancha] = useState(false);
  const [editandoCanchaId, setEditandoCanchaId] = useState<string | null>(null);
  const [formCanchaEdicion, setFormCanchaEdicion] = useState<FormEdicionCanchaT | null>(null);
  const [luz, setLuz] = useState<TarifaLuz | null>(null);
  const [formLuzCosto, setFormLuzCosto] = useState('');
  const [formLuzInicio, setFormLuzInicio] = useState('18:30');
  const [formLuzFin, setFormLuzFin] = useState('22:00');
  const [guardandoLuz, setGuardandoLuz] = useState(false);
  const [errorLuz, setErrorLuz] = useState<string | null>(null);
  const [mensajeLuz, setMensajeLuz] = useState<string | null>(null);
  const [pagosLuz, setPagosLuz] = useState<PagoLuz[]>([]);
  const [turnosLuz, setTurnosLuz] = useState<TurnoAdmin[]>([]);
  const [canchasLuz, setCanchasLuz] = useState<Cancha[]>([]);
  const [formPagoTurno, setFormPagoTurno] = useState('');
  const [formPagoMonto, setFormPagoMonto] = useState('');
  const [formPagoFecha, setFormPagoFecha] = useState('');
  const [guardandoPagoLuz, setGuardandoPagoLuz] = useState(false);
  const [errorPagoLuz, setErrorPagoLuz] = useState<string | null>(null);
  const [mensajePagoLuz, setMensajePagoLuz] = useState<string | null>(null);
  const [filtroTurnoPago, setFiltroTurnoPago] = useState('');
  const [filtroUsuarioPago, setFiltroUsuarioPago] = useState('');
  const [filtroDesdePago, setFiltroDesdePago] = useState('');
  const [filtroHastaPago, setFiltroHastaPago] = useState('');
  const [tarifas, setTarifas] = useState<TarifasResponse | null>(null);
  const [formTarifaTurno, setFormTarifaTurno] = useState('');
  const [formTarifaCuota, setFormTarifaCuota] = useState('');
  const [guardandoTarifa, setGuardandoTarifa] = useState<'turno' | 'cuota' | null>(null);
  const [errorTarifas, setErrorTarifas] = useState<string | null>(null);
  const [mensajeTarifas, setMensajeTarifas] = useState<string | null>(null);
  const [historial, setHistorial] = useState<TarifaHistorialItem[]>([]);
  const [filtroTipoHistorial, setFiltroTipoHistorial] = useState<
    'todos' | TipoTarifaHistorial
  >('todos');
  const [filtroDesdeHistorial, setFiltroDesdeHistorial] = useState('');
  const [filtroHastaHistorial, setFiltroHastaHistorial] = useState('');
  const [filtroMontoMinHistorial, setFiltroMontoMinHistorial] = useState('');
  const [filtroMontoMaxHistorial, setFiltroMontoMaxHistorial] = useState('');
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
        } else if (tabActual === 'canchas') {
          setCanchas(await api.canchas(authToken, { conEstados: true }));
        } else if (tabActual === 'luz') {
          const [tarifasData, pagosData, turnosData, canchasData] = await Promise.all([
            api.tarifas(authToken),
            api.pagosLuz(authToken),
            api.turnosAdmin(authToken),
            api.canchas(authToken),
          ]);
          setLuz(tarifasData.luz);
          setFormLuzCosto(tarifasData.luz ? String(tarifasData.luz.costoXHora) : '');
          setFormLuzInicio(tarifasData.luz?.franjaHorarioInicio ?? '18:30');
          setFormLuzFin(tarifasData.luz?.franjaHorarioFin ?? '22:00');
          setPagosLuz(pagosData);
          setCanchasLuz(canchasData);
          const pagados = new Set(pagosData.map((pago) => pago.turnoId));
          setTurnosLuz(
            turnosData.filter(
              (turno) =>
                turno.requiereLuz &&
                turno.estadoActual !== 'cancelado' &&
                !pagados.has(turno.id),
            ),
          );
        } else if (tabActual === 'tarifas') {
          const data = await api.tarifas(authToken);
          setTarifas(data);
          setFormTarifaTurno(data.turno ? String(data.turno.costoXHora) : '');
          setFormTarifaCuota(data.cuota ? String(data.cuota.precio) : '');
        } else if (tabActual === 'historial') {
          const montoMin =
            filtroMontoMinHistorial.trim() === ''
              ? undefined
              : Number(filtroMontoMinHistorial);
          const montoMax =
            filtroMontoMaxHistorial.trim() === ''
              ? undefined
              : Number(filtroMontoMaxHistorial);
          if (
            (montoMin !== undefined && !Number.isFinite(montoMin)) ||
            (montoMax !== undefined && !Number.isFinite(montoMax))
          ) {
            setError('Los montos del historial deben ser numéricos.');
            return;
          }
          if (montoMin !== undefined && montoMax !== undefined && montoMin > montoMax) {
            setError('El monto mínimo del historial no puede superar al máximo.');
            return;
          }
          const params: HistorialTarifasParams = {
            ...(filtroTipoHistorial !== 'todos' ? { tipo: filtroTipoHistorial } : {}),
            ...(filtroDesdeHistorial !== '' ? { desde: filtroDesdeHistorial } : {}),
            ...(filtroHastaHistorial !== '' ? { hasta: filtroHastaHistorial } : {}),
            ...(montoMin !== undefined ? { montoMin } : {}),
            ...(montoMax !== undefined ? { montoMax } : {}),
          };
          setHistorial(await api.historialTarifas(authToken, params));
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
    [
      busqueda,
      fecha,
      filtroTipoHistorial,
      filtroDesdeHistorial,
      filtroHastaHistorial,
      filtroMontoMinHistorial,
      filtroMontoMaxHistorial,
    ],
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

  /** Saves the lighting config (ACT-43). PUT is admin-only. */
  const guardarLuz = useCallback(
    async (authToken: string | null) => {
      setErrorLuz(null);
      setMensajeLuz(null);
      const costoTexto = formLuzCosto.trim();
      if (costoTexto === '') {
        setErrorLuz('El costo de luz es obligatorio.');
        return;
      }
      if (!/^\d+(\.\d{1,2})?$/.test(costoTexto)) {
        setErrorLuz('El costo debe ser un número mayor o igual a 0 con hasta 2 decimales.');
        return;
      }
      const costo = Number(costoTexto);
      const inicio = formLuzInicio.trim();
      const fin = formLuzFin.trim();
      if ((inicio === '') !== (fin === '')) {
        setErrorLuz('La franja debe tener inicio y fin, o quedar los dos vacíos.');
        return;
      }
      if (inicio !== '' && fin !== '') {
        if (
          !/^([01]\d|2[0-3]):[0-5]\d$/.test(inicio) ||
          !/^([01]\d|2[0-3]):[0-5]\d$/.test(fin)
        ) {
          setErrorLuz('La franja debe usar el formato HH:MM.');
          return;
        }
        if (fin <= inicio) {
          setErrorLuz('El fin de la franja debe ser posterior al inicio.');
          return;
        }
      }

      setGuardandoLuz(true);
      try {
        const actualizada = await api.actualizarTarifaLuz(authToken, {
          costoXHora: costo,
          ...(inicio !== '' && fin !== ''
            ? { franjaHorarioInicio: inicio, franjaHorarioFin: fin }
            : {}),
        });
        setLuz(actualizada);
        setFormLuzCosto(String(actualizada.costoXHora));
        setFormLuzInicio(actualizada.franjaHorarioInicio);
        setFormLuzFin(actualizada.franjaHorarioFin);
        setMensajeLuz('Configuración de luz actualizada.');
      } catch (caught) {
        setErrorLuz(
          caught instanceof ApiError ? caught.message : 'No se pudo guardar la luz.',
        );
      } finally {
        setGuardandoLuz(false);
      }
    },
    [formLuzCosto, formLuzInicio, formLuzFin],
  );

  /** Reloads the luz payments with the current filters (ACT-43). */
  const cargarPagosLuz = useCallback(
    async (authToken: string | null) => {
      setErrorPagoLuz(null);
      try {
        const params: PagosLuzParams = {
          ...(filtroTurnoPago.trim() !== '' ? { turnoId: filtroTurnoPago.trim() } : {}),
          ...(filtroUsuarioPago.trim() !== ''
            ? { usuarioId: filtroUsuarioPago.trim() }
            : {}),
          ...(filtroDesdePago !== '' ? { desde: filtroDesdePago } : {}),
          ...(filtroHastaPago !== '' ? { hasta: filtroHastaPago } : {}),
        };
        setPagosLuz(await api.pagosLuz(authToken, params));
      } catch (caught) {
        setErrorPagoLuz(
          caught instanceof ApiError ? caught.message : 'No se pudieron cargar los pagos.',
        );
      }
    },
    [filtroTurnoPago, filtroUsuarioPago, filtroDesdePago, filtroHastaPago],
  );

  /** Registers one verified lighting payment (ACT-43). */
  const registrarPagoLuz = useCallback(
    async (authToken: string | null) => {
      setErrorPagoLuz(null);
      setMensajePagoLuz(null);
      if (formPagoTurno.trim() === '') {
        setErrorPagoLuz('Elegí un turno.');
        return;
      }
      const montoTexto =
        formPagoMonto.trim() !== '' ? formPagoMonto.trim() : luz ? String(luz.costoXHora) : '';
      if (!/^\d+(\.\d{1,2})?$/.test(montoTexto)) {
        setErrorPagoLuz('El monto debe ser un número mayor a 0 con hasta 2 decimales.');
        return;
      }
      const monto = Number(montoTexto);
      if (!Number.isFinite(monto) || monto <= 0) {
        setErrorPagoLuz('El monto debe ser mayor a 0.');
        return;
      }
      let fechaPago: string | undefined;
      if (formPagoFecha.trim() !== '') {
        const parsed = new Date(formPagoFecha);
        if (Number.isNaN(parsed.getTime())) {
          setErrorPagoLuz('La fecha de pago no es válida.');
          return;
        }
        if (parsed.getTime() > Date.now()) {
          setErrorPagoLuz('La fecha de pago no puede ser futura.');
          return;
        }
        fechaPago = parsed.toISOString();
      }

      const turnoId = formPagoTurno.trim();
      setGuardandoPagoLuz(true);
      try {
        const creado = await api.registrarPagoLuz(authToken, {
          turnoId,
          montoTotalLuz: monto,
          ...(fechaPago !== undefined ? { fechaPago } : {}),
        });
        setPagosLuz((prev) => [creado, ...prev]);
        setTurnosLuz((prev) => prev.filter((turno) => turno.id !== turnoId));
        setFormPagoTurno('');
        setFormPagoMonto('');
        setFormPagoFecha('');
        setMensajePagoLuz('Pago de luz registrado.');
      } catch (caught) {
        setErrorPagoLuz(
          caught instanceof ApiError ? caught.message : 'No se pudo registrar el pago.',
        );
      } finally {
        setGuardandoPagoLuz(false);
      }
    },
    [formPagoTurno, formPagoMonto, formPagoFecha, luz],
  );

  /** Saves one tariff (ACT-42). PUT is admin-only; validates before calling the API. */
  const guardarTarifa = useCallback(
    async (authToken: string | null, tipo: 'turno' | 'cuota') => {
      setErrorTarifas(null);
      setMensajeTarifas(null);

      const valor = (tipo === 'turno' ? formTarifaTurno : formTarifaCuota).trim();
      const etiqueta = tipo === 'turno' ? 'La tarifa de turno' : 'La cuota mensual';

      if (valor === '') {
        setErrorTarifas(`${etiqueta} es obligatoria.`);
        return;
      }
      if (!/^\d+(\.\d{1,2})?$/.test(valor)) {
        setErrorTarifas(
          `${etiqueta} debe ser un número mayor o igual a 0 con hasta 2 decimales.`,
        );
        return;
      }
      const numero = Number(valor);
      if (!Number.isFinite(numero) || numero < 0) {
        setErrorTarifas(`${etiqueta} debe ser un número mayor o igual a 0.`);
        return;
      }

      setGuardandoTarifa(tipo);
      try {
        if (tipo === 'turno') {
          const actualizada = await api.actualizarTarifaTurno(authToken, { costoXHora: numero });
          setTarifas((prev) => ({
            turno: actualizada,
            luz: prev?.luz ?? null,
            cuota: prev?.cuota ?? null,
          }));
          setFormTarifaTurno(String(actualizada.costoXHora));
          setMensajeTarifas('Tarifa de turno actualizada.');
        } else {
          const actualizada = await api.actualizarTarifaCuota(authToken, { precio: numero });
          setTarifas((prev) => ({
            turno: prev?.turno ?? null,
            luz: prev?.luz ?? null,
            cuota: actualizada,
          }));
          setFormTarifaCuota(String(actualizada.precio));
          setMensajeTarifas('Cuota mensual actualizada.');
        }
      } catch (caught) {
        setErrorTarifas(
          caught instanceof ApiError ? caught.message : 'No se pudo guardar la tarifa.',
        );
      } finally {
        setGuardandoTarifa(null);
      }
    },
    [formTarifaTurno, formTarifaCuota],
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

  /** Opens/closes the inline edit form for one court (data and state share one form). */
  const alternarEdicionCancha = (cancha: Cancha): void => {
    setErrorCanchas(null);
    if (editandoCanchaId === cancha.id) {
      setEditandoCanchaId(null);
      setFormCanchaEdicion(null);
      return;
    }
    setEditandoCanchaId(cancha.id);
    setFormCanchaEdicion({
      superficie: cancha.superficie,
      iluminacion: cancha.iluminacion,
      estado: cancha.estadoActual,
      motivo: '',
    });
  };

  /** Closes the editor without saving. */
  const cerrarEdicionCancha = (): void => {
    setEditandoCanchaId(null);
    setFormCanchaEdicion(null);
  };

  /** Single save handler: PATCHes only the resources that actually changed.
   * The data PATCH runs first because a failed estado PATCH still leaves the
   * court data saved; on any failure the list is resynced from the server. */
  const guardarCancha = useCallback(
    async (authToken: string | null, cancha: Cancha) => {
      if (formCanchaEdicion === null) {
        return;
      }
      const cambios = compararFormCancha(cancha, formCanchaEdicion);
      if (!cambios.datos && !cambios.estado) {
        return;
      }
      // Only a real estado change needs a reason; disponible clears it.
      const motivo =
        formCanchaEdicion.estado === 'disponible' ? '' : formCanchaEdicion.motivo.trim();
      if (cambios.estado && formCanchaEdicion.estado !== 'disponible' && motivo === '') {
        setErrorCanchas('El motivo es obligatorio cuando la cancha no queda disponible.');
        return;
      }
      if (motivo.length > 500) {
        setErrorCanchas('El motivo no puede superar los 500 caracteres.');
        return;
      }

      setErrorCanchas(null);
      setGuardandoCancha(true);
      let guardada = cancha;
      try {
        if (cambios.datos) {
          guardada = await api.editarCancha(authToken, cancha.id, {
            superficie: formCanchaEdicion.superficie,
            iluminacion: formCanchaEdicion.iluminacion,
          });
        }
        if (cambios.estado) {
          const conEstado = await api.cambiarEstadoCancha(authToken, cancha.id, {
            estado: formCanchaEdicion.estado,
            ...(motivo === '' ? {} : { motivo }),
          });
          // The estado endpoint returns the court without `estados`; prepend the
          // new history entry locally so the row keeps showing the latest change.
          const entrada: EstadoCancha = {
            valorState: conEstado.estadoActual,
            fechaCambio: new Date().toISOString(),
            motivo: motivo === '' ? null : motivo,
          };
          guardada = {
            ...conEstado,
            estados: [entrada, ...(conEstado.estados ?? guardada.estados ?? cancha.estados ?? [])],
          };
        }
        setCanchas((lista) =>
          ordenarCanchas(
            lista.map((item) =>
              item.id === cancha.id
                ? { ...guardada, estados: guardada.estados ?? item.estados }
                : item,
            ),
          ),
        );
        cerrarEdicionCancha();
      } catch (caught) {
        setErrorCanchas(mensajeErrorCancha(caught, 'No se pudo guardar la cancha.'));
        // A previous call may have succeeded, so the list must reflect the server.
        // The editor stays open so the admin keeps what they typed and can retry.
        await cargar(authToken, 'canchas');
      } finally {
        setGuardandoCancha(false);
      }
    },
    [formCanchaEdicion, cargar],
  );

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
        if (qU === '') {
          return okEstado;
        }
        const texto = `${u.nombre} ${u.apellido} ${u.email} ${u.username}`.toLowerCase();
        if (texto.includes(qU)) {
          return okEstado;
        }
        // DNI inteligente: ignora puntos, espacios y guiones de ambos lados,
        // así "30123456" encuentra "30.123.456" y viceversa.
        const qDigitos = qU.replace(/\D/g, '');
        const matchDni =
          u.dni.toLowerCase().includes(qU) ||
          (qDigitos !== '' && u.dni.replace(/\D/g, '').includes(qDigitos));
        return okEstado && matchDni;
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
    <div className="flex flex-col gap-6 min-w-0 max-w-full">
      <header>
        <p className="m-0 text-sereno font-semibold">Club · Admin</p>
        <h1 className="mt-1 mb-0">Panel admin</h1>
      </header>

      <div
        className="flex gap-2 overflow-x-auto pb-1 max-w-full"
        role="tablist"
        aria-label="Panel admin"
      >
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`min-h-[44px] shrink-0 rounded-full px-4 py-2 font-semibold cursor-pointer transition-colors ${
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
                <li key={turno.id} className="bg-white rounded-lg p-6 shadow-[0_2px_8px_rgba(56,69,67,0.08)]">
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

      {tab === 'canchas' && (
        <section aria-label="Canchas" className="flex flex-col gap-4">
          <header className="flex flex-col gap-1">
            <div className="flex items-baseline gap-3">
              <h2 className="m-0 text-lg font-semibold text-musgo">Canchas del club</h2>
              <span
                role="status"
                className="rounded-full bg-[#E8F5F0] px-2.5 py-0.5 text-xs font-semibold text-musgo"
              >
                {canchas.length} {canchas.length === 1 ? 'cancha' : 'canchas'}
              </span>
            </div>
            <p className="m-0 text-sm text-[#5A6661]">
              El club tiene 3 canchas fijas: el número no se edita, solo la superficie, la iluminación
              y el estado.
            </p>
          </header>

          {errorCanchas !== null && (
            <div role="alert" className="bg-white border border-error rounded-lg p-6 text-error">
              {errorCanchas}
            </div>
          )}

          {cargando ? (
            <Skeleton rows={4} label="Cargando canchas…" />
          ) : error ? (
            <ErrorCard message={error} onRetry={() => void cargar(token, 'canchas')} />
          ) : canchas.length === 0 ? (
            <EmptyState message="Todavía no hay canchas registradas." />
          ) : (
            <>
              <div className="hidden md:block overflow-auto rounded-xl bg-white shadow-[0_2px_8px_rgba(56,69,67,0.08)]">
                <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
                  <caption className="sr-only">
                    Canchas del club con superficie, iluminación, estado vigente y último cambio
                  </caption>
                  <thead>
                    <tr className="bg-[#E8F5F0] shadow-[inset_0_-1px_0_var(--color-sereno)]">
                      <th
                        scope="col"
                        className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5A6661]"
                      >
                        Cancha
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5A6661]"
                      >
                        Superficie
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5A6661]"
                      >
                        Iluminación
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5A6661]"
                      >
                        Estado
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5A6661]"
                      >
                        Último cambio
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5A6661]"
                      >
                        <span className="sr-only">Acciones</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ECEEEB]">
                    {canchas.map((cancha) => (
                      <TableRowCancha
                        key={cancha.id}
                        cancha={cancha}
                        editando={editandoCanchaId === cancha.id}
                        formEdicion={
                          editandoCanchaId === cancha.id ? formCanchaEdicion : null
                        }
                        guardando={guardandoCancha}
                        onEditar={() => alternarEdicionCancha(cancha)}
                        onFormChange={setFormCanchaEdicion}
                        onGuardar={() => void guardarCancha(token, cancha)}
                        onCancelar={cerrarEdicionCancha}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile: the same list as stacked cards, zero horizontal scroll. */}
              <ul className="md:hidden list-none m-0 p-0 grid gap-3">
                {canchas.map((cancha) => {
                  const ultimo = cancha.estados?.[0];
                  const editando = editandoCanchaId === cancha.id;
                  return (
                    <li
                      key={cancha.id}
                      className="bg-white rounded-lg p-4 min-w-0 max-w-full overflow-hidden shadow-[0_2px_8px_rgba(56,69,67,0.08)]"
                    >
                      <div className="flex gap-3 items-start flex-wrap min-w-0">
                        <div className="flex flex-col gap-1 flex-1 min-w-0">
                          <div className="flex gap-2 flex-wrap items-center">
                            <strong className="text-musgo">Cancha {cancha.nroCancha}</strong>
                            <StatusPill
                              estado={cancha.estadoActual}
                              label={etiquetaEstadoCancha(cancha.estadoActual)}
                            />
                          </div>
                          <span className="text-sm leading-snug text-[#5A6661]">
                            {etiquetaSuperficie(cancha.superficie)} · Iluminación:{' '}
                            {cancha.iluminacion ? 'sí' : 'no'}
                          </span>
                          {ultimo !== undefined && (
                            <span className="text-xs leading-snug text-[#5A6661] break-words">
                              Último cambio: {formatoFechaHora(ultimo.fechaCambio)}
                              {ultimo.motivo !== null && ultimo.motivo !== ''
                                ? ` · ${ultimo.motivo}`
                                : ''}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-1 flex-wrap">
                          <button
                            type="button"
                            aria-label={
                              editando
                                ? `Cerrar edición de la cancha ${cancha.nroCancha}`
                                : `Editar cancha ${cancha.nroCancha}`
                            }
                            aria-expanded={editando}
                            onClick={() => alternarEdicionCancha(cancha)}
                            className="grid size-11 place-items-center rounded-md text-[#5A6661] bg-white border border-sereno transition hover:text-peridot hover:border-peridot cursor-pointer focus-visible:outline-2 focus-visible:outline-peridot"
                          >
                            {editando ? (
                              <X className="size-4" aria-hidden="true" />
                            ) : (
                              <Pencil className="size-4" aria-hidden="true" />
                            )}
                          </button>
                        </div>
                      </div>

                      {editando && formCanchaEdicion !== null && (
                        <div className="mt-4 pt-4 border-t border-sereno">
                          <EditorCancha
                            cancha={cancha}
                            formEdicion={formCanchaEdicion}
                            guardando={guardandoCancha}
                            onFormChange={setFormCanchaEdicion}
                            onGuardar={() => void guardarCancha(token, cancha)}
                            onCancelar={cerrarEdicionCancha}
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
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
                <li key={pago.id} className="bg-white rounded-lg p-6 shadow-[0_2px_8px_rgba(56,69,67,0.08)]">
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
              <article className="bg-white rounded-lg p-6 shadow-[0_2px_8px_rgba(56,69,67,0.08)]">
                <h2 className="mt-0">Turnos</h2>
                <p className="text-3xl my-1 tabular-nums">
                  {estadisticas.turnos.total}
                </p>
                <p className="m-0 text-sereno">
                  Socios activos: {estadisticas.usuarios.sociosActivos} · Morosos:{' '}
                  {estadisticas.usuarios.morosos}
                </p>
              </article>
              <article className="bg-white rounded-lg p-6 shadow-[0_2px_8px_rgba(56,69,67,0.08)]">
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
              <article className="bg-white rounded-lg p-6 shadow-[0_2px_8px_rgba(56,69,67,0.08)]">
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
                className="rounded-full bg-[#E8F5F0] px-2.5 py-0.5 text-xs font-semibold text-musgo"
              >
                {usuariosVisibles.length}{' '}
                {usuariosVisibles.length === 1 ? 'usuario' : 'usuarios'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="relative">
                <span className="sr-only">Buscar por nombre, email o DNI</span>
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#5A6661]"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  placeholder="Buscar nombre, email o DNI…"
                  value={busquedaU}
                  onChange={(event) => setBusquedaU(event.target.value)}
                  className="min-h-[44px] w-56 rounded-lg bg-white pl-9 pr-3 text-sm text-musgo border border-sereno transition placeholder:text-[#5A6661] focus:outline-none focus:ring-2 focus:ring-peridot"
                />
              </label>
              <div
                className="flex gap-1 flex-wrap max-w-full rounded-lg bg-white p-1 shadow-[0_2px_8px_rgba(56,69,67,0.08)]"
                role="group"
                aria-label="Filtrar por estado"
              >
                {(['todos', ...ESTADOS] as const).map((filtro) => (
                  <button
                    key={filtro}
                    type="button"
                    aria-pressed={filtroEstadoU === filtro}
                    onClick={() => setFiltroEstadoU(filtro)}
                    className={`min-h-[36px] shrink-0 rounded-md px-3 text-xs font-semibold transition cursor-pointer ${
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
              className="relative max-h-[26rem] overflow-auto rounded-xl bg-white shadow-[0_2px_8px_rgba(56,69,67,0.08)] focus-visible:outline-2 focus-visible:outline-peridot hidden md:block"
            >
              <table className="w-full min-w-[920px] border-collapse text-left text-[13px]">
                <caption className="sr-only">
                  Usuarios del club con contacto, DNI, rol, estado, socio y fecha de alta
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
                      Contacto
                    </th>
                    <th
                      scope="col"
                      className="sticky top-0 z-10 bg-[#E8F5F0] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5A6661]"
                    >
                      DNI
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
                        colSpan={7}
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

          {/* Mobile: the same list as stacked cards, zero horizontal scroll. */}
          {!cargando && !error && usuarios.length > 0 && (
            <ul className="md:hidden list-none m-0 p-0 grid gap-3">
              {usuariosVisibles.map((u) => (
                <li key={u.id} className="bg-white rounded-lg p-4 min-w-0 max-w-full overflow-hidden shadow-[0_2px_8px_rgba(56,69,67,0.08)]">
                  <div className="flex gap-3 items-center flex-wrap min-w-0">
                    <span
                      aria-hidden="true"
                      className="grid size-10 shrink-0 place-items-center rounded-full bg-linear-135 from-musgo to-peridot text-xs font-semibold text-white"
                    >
                      {iniciales(u.nombre, u.apellido)}
                    </span>
                    <div className="flex flex-col gap-1 flex-1 min-w-0">
                      <div className="flex gap-2 flex-wrap items-center">
                        <strong>
                          {u.nombre} {u.apellido}
                        </strong>
                        {u.rol !== null && (
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${
                              CHIP_ROL[u.rol] ?? CHIP_ROL.no_socio
                            }`}
                          >
                            {ETIQUETAS_ROL[u.rol] ?? u.rol}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 min-w-0">
                        <span className="text-sm leading-snug text-musgo break-all">
                          {u.email}
                        </span>
                        {u.telefono !== null && u.telefono !== '' && (
                          <span className="text-[13px] leading-snug text-[#5A6661] break-words">
                            {u.telefono}
                          </span>
                        )}
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#5A6661]">
                          <span className="whitespace-nowrap">DNI {u.dni}</span>
                          {u.numeroSocio !== null && (
                            <span className="inline-flex items-center gap-1 whitespace-nowrap">
                              <span
                                aria-hidden="true"
                                className="size-1 rounded-full bg-current opacity-40"
                              />
                              socio {u.numeroSocio}
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label={editandoId === u.id ? `Cerrar edición de ${u.nombre}` : `Editar ${u.nombre} ${u.apellido}`}
                      aria-expanded={editandoId === u.id}
                      onClick={() =>
                        editandoId === u.id ? setEditandoId(null) : abrirEdicion(u)
                      }
                      className="grid size-11 place-items-center rounded-md text-[#5A6661] bg-white border border-sereno transition hover:text-peridot hover:border-peridot cursor-pointer focus-visible:outline-2 focus-visible:outline-peridot"
                    >
                      {editandoId === u.id ? (
                        <X className="size-4" aria-hidden="true" />
                      ) : (
                        <Pencil className="size-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>

                  {editandoId === u.id && formEdicion !== null && (
                    <div className="mt-4 pt-4 border-t border-sereno">
                      <FormEdicionUsuario
                        u={u}
                        formEdicion={formEdicion}
                        rolElegido={rolElegido[u.id] ?? ''}
                        confirmandoBaja={confirmandoBaja === u.id}
                        guardando={guardando}
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
                    </div>
                  )}
                </li>
              ))}
              {usuariosVisibles.length === 0 && (
                <li role="status" className="px-2 py-8 text-center text-[#5A6661]">
                  No hay usuarios para ese filtro.
                </li>
              )}
            </ul>
          )}
        </section>
      )}

      {tab === 'tarifas' && (
        <section aria-label="Tarifas" className="flex flex-col gap-4">
          <header className="flex flex-col gap-1">
            <h2 className="m-0 text-lg font-semibold text-musgo">Tarifas del club</h2>
            <p className="m-0 text-sm text-[#5A6661]">
              Consultá y actualizá la tarifa por hora de cancha y la cuota mensual. La luz se
              configura en el módulo de luz (ACT-43).
            </p>
          </header>

          {errorTarifas !== null && (
            <div role="alert" className="bg-white border border-error rounded-lg p-6 text-error">
              {errorTarifas}
            </div>
          )}
          {mensajeTarifas !== null && (
            <div
              role="status"
              className="bg-[#DDF0E3] border border-peridot rounded-lg p-4 text-[#1F6B45]"
            >
              {mensajeTarifas}
            </div>
          )}

          {cargando ? (
            <Skeleton rows={3} label="Cargando tarifas…" />
          ) : error ? (
            <ErrorCard message={error} onRetry={() => void cargar(token, 'tarifas')} />
          ) : tarifas === null ? (
            <EmptyState message="No se pudieron cargar las tarifas." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <article className="bg-white rounded-lg p-6 shadow-[0_2px_8px_rgba(56,69,67,0.08)] flex flex-col gap-3">
                <div>
                  <h3 className="m-0 text-lg font-semibold text-musgo">Tarifa de turno</h3>
                  <p className="m-0 mt-1 text-sm text-[#5A6661]">Valor por hora de cancha.</p>
                </div>
                <p className="m-0 text-3xl font-display tabular-nums text-musgo">
                  {tarifas.turno
                    ? formatoMonedaTarifa(tarifas.turno.costoXHora)
                    : 'Sin tarifa configurada'}
                </p>
                {tarifas.turno !== null && (
                  <p className="m-0 text-xs text-[#5A6661]">
                    Vigente desde {formatoFechaHora(tarifas.turno.fechaCambio)}
                  </p>
                )}
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void guardarTarifa(token, 'turno');
                  }}
                  className="flex gap-3 flex-wrap items-end mt-2"
                >
                  <label className="flex flex-col gap-1 text-sm text-[#5A6661] flex-[1_1_180px]">
                    Nueva tarifa por hora
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      aria-label="Nueva tarifa por hora de cancha"
                      value={formTarifaTurno}
                      onChange={(event) => setFormTarifaTurno(event.target.value)}
                      className="min-h-[44px] rounded-md border border-sereno px-3 py-2.5 text-base bg-white text-musgo"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={guardandoTarifa !== null}
                    className="min-h-[44px] rounded-md px-4 py-2.5 font-bold cursor-pointer bg-peridot text-whisper border-none disabled:opacity-60 disabled:cursor-wait"
                  >
                    {guardandoTarifa === 'turno' ? 'Guardando…' : 'Guardar tarifa'}
                  </button>
                </form>
              </article>

              <article className="bg-white rounded-lg p-6 shadow-[0_2px_8px_rgba(56,69,67,0.08)] flex flex-col gap-3">
                <div>
                  <h3 className="m-0 text-lg font-semibold text-musgo">Cuota mensual</h3>
                  <p className="m-0 mt-1 text-sm text-[#5A6661]">Valor de la cuota de socio.</p>
                </div>
                <p className="m-0 text-3xl font-display tabular-nums text-musgo">
                  {tarifas.cuota
                    ? formatoMonedaTarifa(tarifas.cuota.precio)
                    : 'Sin tarifa configurada'}
                </p>
                {tarifas.cuota !== null && (
                  <p className="m-0 text-xs text-[#5A6661]">
                    Vigente desde {formatoFechaHora(tarifas.cuota.fechaCambio)}
                  </p>
                )}
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void guardarTarifa(token, 'cuota');
                  }}
                  className="flex gap-3 flex-wrap items-end mt-2"
                >
                  <label className="flex flex-col gap-1 text-sm text-[#5A6661] flex-[1_1_180px]">
                    Nueva cuota mensual
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      aria-label="Nueva cuota mensual"
                      value={formTarifaCuota}
                      onChange={(event) => setFormTarifaCuota(event.target.value)}
                      className="min-h-[44px] rounded-md border border-sereno px-3 py-2.5 text-base bg-white text-musgo"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={guardandoTarifa !== null}
                    className="min-h-[44px] rounded-md px-4 py-2.5 font-bold cursor-pointer bg-peridot text-whisper border-none disabled:opacity-60 disabled:cursor-wait"
                  >
                    {guardandoTarifa === 'cuota' ? 'Guardando…' : 'Guardar cuota'}
                  </button>
                </form>
              </article>

              <article className="bg-white rounded-lg p-6 shadow-[0_2px_8px_rgba(56,69,67,0.08)] md:col-span-2">
                <h3 className="m-0 text-lg font-semibold text-musgo">Luz</h3>
                <p className="m-0 mt-1 text-sm text-[#5A6661]">
                  La configuración de luz se edita en el módulo de luz (ACT-43).
                </p>
                {tarifas.luz !== null ? (
                  <div className="mt-3 flex gap-6 flex-wrap items-baseline">
                    <p className="m-0 text-2xl font-display tabular-nums text-musgo">
                      {formatoMonedaTarifa(tarifas.luz.costoXHora)}
                      <span className="text-sm font-body text-[#5A6661]"> /hora</span>
                    </p>
                    <p className="m-0 text-sm text-[#5A6661]">
                      Franja {tarifas.luz.franjaHorarioInicio}–{tarifas.luz.franjaHorarioFin}
                    </p>
                    <p className="m-0 text-xs text-[#5A6661]">
                      Vigente desde {formatoFechaHora(tarifas.luz.fechaCambio)}
                    </p>
                  </div>
                ) : (
                  <p className="m-0 mt-3 text-sm text-[#5A6661]">Sin configuración de luz.</p>
                )}
              </article>
            </div>
          )}
        </section>
      )}

      {tab === 'luz' && (
        <section aria-label="Luz" className="flex flex-col gap-4">
          <header className="flex flex-col gap-1">
            <h2 className="m-0 text-lg font-semibold text-musgo">Luz</h2>
            <p className="m-0 text-sm text-[#5A6661]">
              Configurá el costo y la franja de iluminación, y registrá los pagos del cargo de luz
              por turno.
            </p>
          </header>

          {cargando ? (
            <Skeleton rows={4} label="Cargando luz y pagos…" />
          ) : error ? (
            <ErrorCard message={error} onRetry={() => void cargar(token, 'luz')} />
          ) : (
            <>
              <article className="bg-white rounded-lg p-6 shadow-[0_2px_8px_rgba(56,69,67,0.08)] flex flex-col gap-3">
                <div>
                  <h3 className="m-0 text-lg font-semibold text-musgo">Configuración de luz</h3>
                  <p className="m-0 mt-1 text-sm text-[#5A6661]">
                    El costo se versiona en el historial cuando cambia; la franja no.
                  </p>
                </div>
                {luz !== null ? (
                  <div className="flex gap-6 flex-wrap items-baseline">
                    <p className="m-0 text-3xl font-display tabular-nums text-musgo">
                      {formatoMonedaLuz(luz.costoXHora)}
                      <span className="text-sm font-body text-[#5A6661]"> /hora</span>
                    </p>
                    <p className="m-0 text-sm text-[#5A6661]">
                      Franja {luz.franjaHorarioInicio}–{luz.franjaHorarioFin}
                    </p>
                    <p className="m-0 text-xs text-[#5A6661]">
                      Vigente desde {formatoFechaHora(luz.fechaCambio)}
                    </p>
                  </div>
                ) : (
                  <p className="m-0 text-sm text-[#5A6661]">Sin configuración de luz.</p>
                )}
                {errorLuz !== null && (
                  <div
                    role="alert"
                    className="bg-white border border-error rounded-lg p-4 text-error"
                  >
                    {errorLuz}
                  </div>
                )}
                {mensajeLuz !== null && (
                  <div
                    role="status"
                    className="bg-[#DDF0E3] border border-peridot rounded-lg p-4 text-[#1F6B45]"
                  >
                    {mensajeLuz}
                  </div>
                )}
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void guardarLuz(token);
                  }}
                  className="flex gap-3 flex-wrap items-end mt-2"
                >
                  <label className="flex flex-col gap-1 text-sm text-[#5A6661] flex-[1_1_160px]">
                    Costo por hora
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      aria-label="Costo de luz por hora"
                      value={formLuzCosto}
                      onChange={(event) => setFormLuzCosto(event.target.value)}
                      className="min-h-[44px] rounded-md border border-sereno px-3 py-2.5 text-base bg-white text-musgo"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-[#5A6661]">
                    Desde
                    <input
                      type="time"
                      aria-label="Inicio de la franja de luz"
                      value={formLuzInicio}
                      onChange={(event) => setFormLuzInicio(event.target.value)}
                      className="min-h-[44px] rounded-md border border-sereno px-3 py-2.5 text-base bg-white text-musgo"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-[#5A6661]">
                    Hasta
                    <input
                      type="time"
                      aria-label="Fin de la franja de luz"
                      value={formLuzFin}
                      onChange={(event) => setFormLuzFin(event.target.value)}
                      className="min-h-[44px] rounded-md border border-sereno px-3 py-2.5 text-base bg-white text-musgo"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={guardandoLuz}
                    className="min-h-[44px] rounded-md px-4 py-2.5 font-bold cursor-pointer bg-peridot text-whisper border-none disabled:opacity-60 disabled:cursor-wait"
                  >
                    {guardandoLuz ? 'Guardando…' : 'Guardar luz'}
                  </button>
                </form>
              </article>

              <article className="bg-white rounded-lg p-6 shadow-[0_2px_8px_rgba(56,69,67,0.08)] flex flex-col gap-3">
                <div>
                  <h3 className="m-0 text-lg font-semibold text-musgo">Pagos de luz</h3>
                  <p className="m-0 mt-1 text-sm text-[#5A6661]">
                    Registrá el pago verificado del cargo de luz de un turno nocturno. Un pago por
                    turno.
                  </p>
                </div>
                {errorPagoLuz !== null && (
                  <div
                    role="alert"
                    className="bg-white border border-error rounded-lg p-4 text-error"
                  >
                    {errorPagoLuz}
                  </div>
                )}
                {mensajePagoLuz !== null && (
                  <div
                    role="status"
                    className="bg-[#DDF0E3] border border-peridot rounded-lg p-4 text-[#1F6B45]"
                  >
                    {mensajePagoLuz}
                  </div>
                )}
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void registrarPagoLuz(token);
                  }}
                  className="flex gap-3 flex-wrap items-end"
                >
                  <label className="flex flex-col gap-1 text-sm text-[#5A6661] flex-[1_1_260px]">
                    Turno
                    <select
                      aria-label="Turno con luz"
                      value={formPagoTurno}
                      onChange={(event) => {
                        setFormPagoTurno(event.target.value);
                        if (event.target.value !== '' && luz !== null) {
                          setFormPagoMonto(String(luz.costoXHora));
                        }
                      }}
                      className="min-h-[44px] rounded-md border border-sereno px-3 py-2.5 text-base bg-white text-musgo"
                    >
                      <option value="">Elegir…</option>
                      {turnosLuz.map((turno) => (
                        <option key={turno.id} value={turno.id}>
                          Cancha {turno.cancha.nroCancha} · {formatoFechaCorta(turno.fecha)}{' '}
                          {turno.horaInicio.slice(0, 5)} · {turno.usuario.nombre}{' '}
                          {turno.usuario.apellido}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-[#5A6661] flex-[1_1_140px]">
                    Monto
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      aria-label="Monto total de luz"
                      value={formPagoMonto}
                      onChange={(event) => setFormPagoMonto(event.target.value)}
                      className="min-h-[44px] rounded-md border border-sereno px-3 py-2.5 text-base bg-white text-musgo"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-[#5A6661] flex-[1_1_180px]">
                    Fecha de pago (opcional)
                    <input
                      type="datetime-local"
                      aria-label="Fecha de pago de luz"
                      value={formPagoFecha}
                      onChange={(event) => setFormPagoFecha(event.target.value)}
                      className="min-h-[44px] rounded-md border border-sereno px-3 py-2.5 text-base bg-white text-musgo"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={guardandoPagoLuz || formPagoTurno === ''}
                    className="min-h-[44px] rounded-md px-4 py-2.5 font-bold cursor-pointer bg-peridot text-whisper border-none disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {guardandoPagoLuz ? 'Registrando…' : 'Registrar pago'}
                  </button>
                </form>
                {turnosLuz.length === 0 && (
                  <p className="m-0 text-sm text-[#5A6661]">
                    No hay turnos con luz pendientes de pago.
                  </p>
                )}

                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void cargarPagosLuz(token);
                  }}
                  className="flex gap-3 flex-wrap items-end mt-4 pt-4 border-t border-[#ECEEEB]"
                >
                  <label className="flex flex-col gap-1 text-sm text-[#5A6661] flex-[1_1_180px]">
                    Turno ID
                    <input
                      type="text"
                      aria-label="Filtrar pagos por turno"
                      value={filtroTurnoPago}
                      onChange={(event) => setFiltroTurnoPago(event.target.value)}
                      className="min-h-[44px] rounded-md border border-sereno px-3 py-2.5 text-base bg-white text-musgo"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-[#5A6661] flex-[1_1_180px]">
                    Usuario ID
                    <input
                      type="text"
                      aria-label="Filtrar pagos por usuario"
                      value={filtroUsuarioPago}
                      onChange={(event) => setFiltroUsuarioPago(event.target.value)}
                      className="min-h-[44px] rounded-md border border-sereno px-3 py-2.5 text-base bg-white text-musgo"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-[#5A6661]">
                    Desde
                    <input
                      type="date"
                      aria-label="Filtrar pagos desde"
                      value={filtroDesdePago}
                      onChange={(event) => setFiltroDesdePago(event.target.value)}
                      className="min-h-[44px] rounded-md border border-sereno px-3 py-2.5 text-base bg-white text-musgo"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-[#5A6661]">
                    Hasta
                    <input
                      type="date"
                      aria-label="Filtrar pagos hasta"
                      value={filtroHastaPago}
                      onChange={(event) => setFiltroHastaPago(event.target.value)}
                      className="min-h-[44px] rounded-md border border-sereno px-3 py-2.5 text-base bg-white text-musgo"
                    />
                  </label>
                  <button
                    type="submit"
                    className="min-h-[44px] rounded-md px-4 py-2.5 font-bold cursor-pointer bg-peridot text-whisper border-none"
                  >
                    Filtrar
                  </button>
                </form>

                {pagosLuz.length === 0 ? (
                  <EmptyState message="No hay pagos de luz registrados." />
                ) : (
                  <ul className="list-none m-0 p-0 grid gap-3">
                    {pagosLuz.map((pago) => (
                      <li
                        key={pago.id}
                        className="bg-[#FBFCFB] rounded-md p-4 border border-[#ECEEEB]"
                      >
                        <div className="flex gap-3 flex-wrap items-center justify-between">
                          <strong className="text-musgo">
                            {formatoMonedaLuz(pago.montoTotalLuz)}
                          </strong>
                          <span className="text-sm text-[#5A6661]">
                            {formatoFechaHora(pago.fechaPago)}
                          </span>
                        </div>
                        <p className="m-0 mt-1 text-sm text-[#5A6661]">
                          Cancha {nroCanchaPorId(canchasLuz, pago.turno.canchaId) ?? '—'} ·{' '}
                          {formatoFechaCorta(pago.turno.fecha)} {pago.turno.horaInicio.slice(0, 5)}
                        </p>
                        <p className="m-0 text-sm text-[#5A6661]">
                          {pago.usuario.nombre} {pago.usuario.apellido}
                          {pago.usuario.numeroSocio !== null
                            ? ` · socio ${pago.usuario.numeroSocio}`
                            : ''}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            </>
          )}
        </section>
      )}

      {tab === 'historial' && (
        <section aria-label="Historial de tarifas" className="flex flex-col gap-4">
          <header className="flex flex-col gap-1">
            <h2 className="m-0 text-lg font-semibold text-musgo">Historial de tarifas</h2>
            <p className="m-0 text-sm text-[#5A6661]">
              Consultá los cambios de tarifas de turno, luz y cuota, ordenados por fecha
              descendente.
            </p>
          </header>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void cargar(token, 'historial');
            }}
            className="flex gap-3 flex-wrap items-end"
          >
            <label className="flex flex-col gap-1 text-sm text-[#5A6661]">
              Tipo
              <select
                aria-label="Tipo de tarifa"
                value={filtroTipoHistorial}
                onChange={(event) =>
                  setFiltroTipoHistorial(
                    event.target.value as 'todos' | TipoTarifaHistorial,
                  )
                }
                className="min-h-[44px] rounded-md border border-sereno px-3 py-2.5 text-base bg-white text-musgo"
              >
                <option value="todos">Todos</option>
                <option value="turno">Turno</option>
                <option value="luz">Luz</option>
                <option value="cuota">Cuota</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm text-[#5A6661]">
              Desde
              <input
                type="date"
                aria-label="Historial desde"
                value={filtroDesdeHistorial}
                onChange={(event) => setFiltroDesdeHistorial(event.target.value)}
                className="min-h-[44px] rounded-md border border-sereno px-3 py-2.5 text-base bg-white text-musgo"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-[#5A6661]">
              Hasta
              <input
                type="date"
                aria-label="Historial hasta"
                value={filtroHastaHistorial}
                onChange={(event) => setFiltroHastaHistorial(event.target.value)}
                className="min-h-[44px] rounded-md border border-sereno px-3 py-2.5 text-base bg-white text-musgo"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-[#5A6661] flex-[1_1_140px]">
              Monto mínimo
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                aria-label="Monto mínimo del historial"
                value={filtroMontoMinHistorial}
                onChange={(event) => setFiltroMontoMinHistorial(event.target.value)}
                className="min-h-[44px] rounded-md border border-sereno px-3 py-2.5 text-base bg-white text-musgo"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-[#5A6661] flex-[1_1_140px]">
              Monto máximo
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                aria-label="Monto máximo del historial"
                value={filtroMontoMaxHistorial}
                onChange={(event) => setFiltroMontoMaxHistorial(event.target.value)}
                className="min-h-[44px] rounded-md border border-sereno px-3 py-2.5 text-base bg-white text-musgo"
              />
            </label>
            <button
              type="submit"
              className="min-h-[44px] rounded-md px-4 py-2.5 font-bold cursor-pointer bg-peridot text-whisper border-none"
            >
              Filtrar
            </button>
            <button
              type="button"
              onClick={() => {
                setFiltroTipoHistorial('todos');
                setFiltroDesdeHistorial('');
                setFiltroHastaHistorial('');
                setFiltroMontoMinHistorial('');
                setFiltroMontoMaxHistorial('');
              }}
              className="min-h-[44px] rounded-md px-4 py-2.5 font-semibold cursor-pointer bg-white border border-sereno text-musgo"
            >
              Limpiar
            </button>
          </form>

          {cargando ? (
            <Skeleton rows={4} label="Cargando historial…" />
          ) : error ? (
            <ErrorCard message={error} onRetry={() => void cargar(token, 'historial')} />
          ) : historial.length === 0 ? (
            <EmptyState message="No hay cambios de tarifas para esos filtros." />
          ) : (
            <ul className="list-none m-0 p-0 grid gap-3">
              {historial.map((item, indice) => (
                <li
                  key={`${item.tipo}-${item.fechaCambio}-${indice}`}
                  className="bg-white rounded-lg p-4 shadow-[0_2px_8px_rgba(56,69,67,0.08)] flex flex-wrap items-center justify-between gap-3"
                >
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${CHIP_TIPO_TARIFA[item.tipo]}`}
                  >
                    {ETIQUETAS_TIPO_TARIFA[item.tipo]}
                  </span>
                  <strong className="text-musgo tabular-nums">
                    {formatoMonedaTarifa(item.monto)}
                  </strong>
                  <span className="text-sm text-[#5A6661]">
                    {formatoFechaHora(item.fechaCambio)}
                  </span>
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

              <article className="bg-white rounded-lg p-6 shadow-[0_2px_8px_rgba(56,69,67,0.08)]">
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

              <article className="bg-white rounded-lg p-6 shadow-[0_2px_8px_rgba(56,69,67,0.08)]">
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

              <article className="bg-white rounded-lg p-6 text-sereno shadow-[0_2px_8px_rgba(56,69,67,0.08)]">
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
