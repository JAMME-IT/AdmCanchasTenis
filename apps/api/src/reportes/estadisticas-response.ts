/** GET /reportes/estadisticas response shape (API contract §5.10, RF-32). */

export interface PeriodoEstadisticas {
  desde: string;
  hasta: string;
}

export interface PorEstadoTurnos {
  confirmado: number;
  iniciado: number;
  finalizado: number;
  cancelado: number;
  no_asistio: number;
}

export interface PorCancha {
  canchaId: string;
  nroCancha: number;
  cantidad: number;
}

export interface PorFranja {
  horaInicio: string;
  cantidad: number;
}

export interface TurnosEstadisticas {
  total: number;
  porEstado: PorEstadoTurnos;
  porCancha: PorCancha[];
  porFranja: PorFranja[];
}

export interface UsuariosEstadisticas {
  sociosActivos: number;
  noSocios: number;
  morosos: number;
}

export interface EstadisticasResponse {
  periodo: PeriodoEstadisticas;
  turnos: TurnosEstadisticas;
  usuarios: UsuariosEstadisticas;
}
