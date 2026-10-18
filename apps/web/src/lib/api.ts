const API_ORIGIN = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const API_BASE = `${API_ORIGIN}/api`;

export interface Usuario {
  id: string;
  username: string;
  email: string;
  nombre: string;
  apellido: string;
  telefono: string | null;
  dni: string;
  estadoActual: string;
  rol: string | null;
  numeroSocio: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CompletarPerfilBody {
  username: string;
  nombre: string;
  apellido: string;
  telefono?: string;
  dni: string;
}

export interface Turno {
  id: string;
  usuarioId: string;
  canchaId: string;
  tipoTurnoId: string;
  valorTurnoId: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  cantidadPersonas: number;
  cantidadNoSocios: number;
  costoTurnoNs: number;
  requiereLuz: boolean;
  estadoActual: string;
  estadoPago: string;
  createdAt: string;
  updatedAt: string;
}

/** Expanded court summary (`cancha: { id, nroCancha }`, API contract §5.3). */
export interface CanchaResumen {
  id: string;
  nroCancha: number;
}

/** Turno plus the expanded court, shared by GET /turnos/mios[/historial]. */
export interface TurnoConCanchaResponse extends Turno {
  cancha: CanchaResumen;
}

/** GET /turnos/mios item: expanded booking plus the server-computed `puedeCancelar`. */
export interface MiTurno extends TurnoConCanchaResponse {
  puedeCancelar: boolean;
}

export type EstadoHistorial = 'finalizado' | 'no_asistio' | 'cancelado';

/** Pago de cuota del socio (GET /cuotas/mias, API contract §5.7). */
export interface PagoCuota {
  id: string;
  numeroLinea: number;
  monto: number;
  fechaPago: string;
  estado: string;
}

/** Cuota propia con pagos y saldo calculado por el servidor. */
export interface MiCuota {
  id: string;
  socioId: string;
  fechaInicio: string;
  fechaVencimiento: string;
  montoTotal: number;
  estadoActual: string;
  totalPagado: number;
  saldo: number;
  pagos: PagoCuota[];
  createdAt: string;
  updatedAt: string;
}

/** Availability slot (GET /turnos/disponibilidad, API contract §5.3). */
export interface SlotDisponibilidad {
  canchaId: string;
  nroCancha: number;
  horaInicio: string;
  horaFin: string;
  disponible: boolean;
  requiereLuz: boolean;
  motivo: string | null;
}

/** GET /turnos/disponibilidad response: day, resolved duration and slots. */
export interface DisponibilidadResponse {
  fecha: string;
  duracionMinutos: number;
  slots: SlotDisponibilidad[];
}

/** POST /turnos body: the client never sends amounts (API contract §5.3). */
export interface CrearTurnoBody {
  canchaId: string;
  fecha: string;
  horaInicio: string;
  tipoTurnoId: string;
  cantidadPersonas: number;
  cantidadNoSocios: number;
  requiereLuz: boolean;
}

/** POST /turnos response: created booking plus shared lighting charge and notices. */
export interface ReservarTurnoResponse extends Turno {
  cargoLuzCompartido: number | null;
  avisos: string[];
}

export interface HistorialParams {
  estadoActual?: EstadoHistorial;
  desde?: string;
  hasta?: string;
}
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  token?: string | null;
  body?: unknown;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (!response.ok) {
    let message = `Error ${response.status}`;
    try {
      const data = (await response.json()) as { message?: string | string[] };
      if (Array.isArray(data.message)) {
        message = data.message.join(', ');
      } else if (typeof data.message === 'string') {
        message = data.message;
      }
    } catch {
      // The API did not return a JSON body; keep the generic message.
    }
    throw new ApiError(response.status, message);
  }

  return (await response.json()) as T;
}

export const api = {
  health: async (): Promise<{ status: string }> => {
    const response = await fetch(`${API_ORIGIN}/health`);
    return (await response.json()) as { status: string };
  },
  me: (token: string | null): Promise<Usuario> => request<Usuario>('/auth/me', { token }),
  completarPerfil: (token: string | null, body: CompletarPerfilBody): Promise<Usuario> =>
    request<Usuario>('/usuarios/completar-perfil', { method: 'POST', token, body }),
  logout: (token: string | null): Promise<{ message: string }> =>
    request<{ message: string }>('/auth/logout', { method: 'POST', token }),
  misTurnos: (token: string | null): Promise<MiTurno[]> =>
    request<MiTurno[]>('/turnos/mios', { token }),
  historialTurnos: (
    token: string | null,
    params?: HistorialParams,
  ): Promise<TurnoConCanchaResponse[]> => {
    const query = new URLSearchParams();
    if (params?.estadoActual) {
      query.set('estadoActual', params.estadoActual);
    }
    if (params?.desde) {
      query.set('desde', params.desde);
    }
    if (params?.hasta) {
      query.set('hasta', params.hasta);
    }
    const suffix = query.size > 0 ? `?${query.toString()}` : '';
    return request<TurnoConCanchaResponse[]>(`/turnos/mios/historial${suffix}`, { token });
  },
  cancelarTurno: (token: string | null, id: string, motivo: string): Promise<Turno> =>
    request<Turno>(`/turnos/${id}/cancelar`, { method: 'POST', token, body: { motivo } }),
  misCuotas: (token: string | null): Promise<MiCuota[]> =>
    request<MiCuota[]>('/cuotas/mias', { token }),
  disponibilidad: (
    token: string | null,
    fecha: string,
    params?: { canchaId?: string; tipoTurnoId?: string },
  ): Promise<DisponibilidadResponse> => {
    const query = new URLSearchParams({ fecha });
    if (params?.canchaId) {
      query.set('canchaId', params.canchaId);
    }
    if (params?.tipoTurnoId) {
      query.set('tipoTurnoId', params.tipoTurnoId);
    }
    return request<DisponibilidadResponse>(`/turnos/disponibilidad?${query.toString()}`, {
      token,
    });
  },
  crearTurno: (token: string | null, body: CrearTurnoBody): Promise<ReservarTurnoResponse> =>
    request<ReservarTurnoResponse>('/turnos', { method: 'POST', token, body }),
};
