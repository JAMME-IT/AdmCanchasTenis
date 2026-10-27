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

/** GET /turnos item for admins: booking plus expanded user and court (ACT-37). */
export interface TurnoAdmin extends Turno {
  usuario: { id: string; nombre: string; apellido: string };
  cancha: CanchaResumen;
}

export interface TurnosAdminParams {
  busqueda?: string;
  fecha?: string;
  desde?: string;
  hasta?: string;
}

/** GET /pagos-turno item (ACT-54). */
export interface PagoTurno {
  id: string;
  turnoId: string;
  montoTotalTurno: number;
  fechaPago: string;
  turno: { id: string; fecha: string; horaInicio: string; canchaId: string };
  usuario: { id: string; nombre: string; apellido: string; numeroSocio: string | null };
  lineas: { id: string; montoTurnoPago: number }[];
}

export interface PagosTurnoParams {
  turnoId?: string;
  usuarioId?: string;
  desde?: string;
  hasta?: string;
}

/** GET /reportes/estadisticas (ACT-45). */
export interface EstadisticasResponse {
  periodo: { desde: string; hasta: string };
  turnos: {
    total: number;
    porEstado: Record<string, number>;
    porCancha: { canchaId: string; nroCancha: number; cantidad: number }[];
    porFranja: { horaInicio: string; cantidad: number }[];
  };
  usuarios: { sociosActivos: number; noSocios: number; morosos: number };
}

/** GET /reportes/financiero (ACT-46). */
export interface FinancieroResponse {
  periodo: { desde: string; hasta: string };
  ingresos: { pagosTurno: number; pagosLuz: number; cuotasCobradas: number; total: number };
  cuotas: { emitidas: number; montoEmitido: number; pagadas: number; parciales: number; adeudadas: number };
  usoCanchas: { turnosTotal: number; horasOcupadas: number; ocupacionPromedio: number };
}

/** GET /config/dias-funcionamiento item (ACT-30, RF-35): ISO-8601 weekday 1..7.
 * Same shape as the PUT body row, so one interface serves both. */
export interface DiaFuncionamiento {
  diaSemana: number;
  habilitado: boolean;
}

/** GET /config/rangos-horario item (ACT-31, RF-34). */
export interface RangoHorario {
  id: string;
  nombre: string;
  horaInicio: string;
  horaFin: string;
}

/** Row of the PUT /config/rangos-horario body: `id` only for existing ranges. */
export interface RangoHorarioBody {
  id?: string;
  nombre: string;
  horaInicio: string;
  horaFin: string;
}

export interface PeriodoParams {
  desde?: string;
  hasta?: string;
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
  method?: 'GET' | 'POST' | 'PUT';
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
  turnosAdmin: (token: string | null, params?: TurnosAdminParams): Promise<TurnoAdmin[]> => {
    const query = new URLSearchParams();
    if (params?.busqueda) {
      query.set('busqueda', params.busqueda);
    }
    if (params?.fecha) {
      query.set('fecha', params.fecha);
    }
    if (params?.desde) {
      query.set('desde', params.desde);
    }
    if (params?.hasta) {
      query.set('hasta', params.hasta);
    }
    const suffix = query.size > 0 ? `?${query.toString()}` : '';
    return request<TurnoAdmin[]>(`/turnos${suffix}`, { token });
  },
  pagosTurno: (token: string | null, params?: PagosTurnoParams): Promise<PagoTurno[]> => {
    const query = new URLSearchParams();
    if (params?.turnoId) {
      query.set('turnoId', params.turnoId);
    }
    if (params?.usuarioId) {
      query.set('usuarioId', params.usuarioId);
    }
    if (params?.desde) {
      query.set('desde', params.desde);
    }
    if (params?.hasta) {
      query.set('hasta', params.hasta);
    }
    const suffix = query.size > 0 ? `?${query.toString()}` : '';
    return request<PagoTurno[]>(`/pagos-turno${suffix}`, { token });
  },
  estadisticas: (token: string | null, params?: PeriodoParams): Promise<EstadisticasResponse> => {
    const query = new URLSearchParams();
    if (params?.desde) {
      query.set('desde', params.desde);
    }
    if (params?.hasta) {
      query.set('hasta', params.hasta);
    }
    const suffix = query.size > 0 ? `?${query.toString()}` : '';
    return request<EstadisticasResponse>(`/reportes/estadisticas${suffix}`, { token });
  },
  financiero: (token: string | null, params?: PeriodoParams): Promise<FinancieroResponse> => {
    const query = new URLSearchParams();
    if (params?.desde) {
      query.set('desde', params.desde);
    }
    if (params?.hasta) {
      query.set('hasta', params.hasta);
    }
    const suffix = query.size > 0 ? `?${query.toString()}` : '';
    return request<FinancieroResponse>(`/reportes/financiero${suffix}`, { token });
  },
  diasFuncionamiento: (token: string | null): Promise<DiaFuncionamiento[]> =>
    request<DiaFuncionamiento[]>('/config/dias-funcionamiento', { token }),
  guardarDiasFuncionamiento: (
    token: string | null,
    dias: DiaFuncionamiento[],
  ): Promise<DiaFuncionamiento[]> =>
    request<DiaFuncionamiento[]>('/config/dias-funcionamiento', {
      method: 'PUT',
      token,
      body: { dias },
    }),
  rangosHorario: (token: string | null): Promise<RangoHorario[]> =>
    request<RangoHorario[]>('/config/rangos-horario', { token }),
  guardarRangosHorario: (
    token: string | null,
    rangos: RangoHorarioBody[],
  ): Promise<RangoHorario[]> =>
    request<RangoHorario[]>('/config/rangos-horario', { method: 'PUT', token, body: { rangos } }),
};
