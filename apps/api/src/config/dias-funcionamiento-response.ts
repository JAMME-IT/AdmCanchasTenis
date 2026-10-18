/** ISO-8601 weekdays: 1 = Monday, ..., 7 = Sunday (API contract §5.6, RF-35). */
export const DIAS_ISO = [1, 2, 3, 4, 5, 6, 7] as const;

/** Raw `dias_funcionamiento` row (Prisma model or test stub). */
export interface DiaFuncionamientoFila {
  dia_semana: number;
  habilitado: boolean;
}

/** `DiaFuncionamientoResponse` shape (API contract §5.6, camelCase over snake_case). */
export interface DiaFuncionamientoResponse {
  diaSemana: number;
  habilitado: boolean;
}

/** Maps one `dias_funcionamiento` row to its camelCase contract shape. */
export function toDiaFuncionamientoResponse(fila: DiaFuncionamientoFila): DiaFuncionamientoResponse {
  return {
    diaSemana: fila.dia_semana,
    habilitado: fila.habilitado,
  };
}

/**
 * Maps the stored rows to the full 7-day ISO view (1..7, ascending).
 * A day without a stored row is reported as `habilitado: false`, because booking
 * availability treats a missing row as a non-operating day (turnos.service.ts).
 */
export function toDiasFuncionamientoResponse(
  filas: DiaFuncionamientoFila[],
): DiaFuncionamientoResponse[] {
  const habilitadoPorDia = new Map(filas.map((fila) => [fila.dia_semana, fila.habilitado]));
  return DIAS_ISO.map((diaSemana) => ({
    diaSemana,
    habilitado: habilitadoPorDia.get(diaSemana) ?? false,
  }));
}
