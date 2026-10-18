/** Mi cuota del socio (ACT-48, API contract §5.7 GET /cuotas/mias, RF-26). */

export interface PagoCuotaResponse {
  id: string;
  numeroLinea: number;
  monto: number;
  fechaPago: string;
  estado: string;
}

export interface MiCuotaResponse {
  id: string;
  socioId: string;
  fechaInicio: string;
  fechaVencimiento: string;
  montoTotal: number;
  estadoActual: string;
  totalPagado: number;
  saldo: number;
  pagos: PagoCuotaResponse[];
  createdAt: string;
  updatedAt: string;
}

type LineaDb = {
  id: unknown;
  numero_linea: unknown;
  monto: unknown;
  fecha_pago: unknown;
  estado: unknown;
};

type CuotaDb = {
  id: unknown;
  socio_id: unknown;
  fecha_inicio: unknown;
  fecha_vencimiento: unknown;
  monto_total: unknown;
  estado_actual: unknown;
  created_at: unknown;
  updated_at: unknown;
  lineas_cuota?: LineaDb[];
};

function fechaSoloDia(valor: unknown): string {
  if (valor instanceof Date) {
    return valor.toISOString().slice(0, 10);
  }
  return String(valor ?? '').slice(0, 10);
}

function aISO(valor: unknown): string {
  if (valor instanceof Date) {
    return valor.toISOString();
  }
  if (valor === null || valor === undefined) {
    return new Date(0).toISOString();
  }
  return new Date(String(valor)).toISOString();
}

export function toMiCuotaResponse(cuota: CuotaDb): MiCuotaResponse {
  const lineas = (cuota.lineas_cuota ?? []).filter((l) => String(l.estado) === 'registrada');
  const montoTotal = Number(cuota.monto_total ?? 0);
  const totalPagado = Math.round(lineas.reduce((acc, l) => acc + Number(l.monto ?? 0), 0) * 100) / 100;
  const saldo = Math.max(0, Math.round((montoTotal - totalPagado) * 100) / 100);
  return {
    id: String(cuota.id ?? ''),
    socioId: String(cuota.socio_id ?? ''),
    fechaInicio: fechaSoloDia(cuota.fecha_inicio),
    fechaVencimiento: fechaSoloDia(cuota.fecha_vencimiento),
    montoTotal,
    estadoActual: String(cuota.estado_actual ?? ''),
    totalPagado,
    saldo,
    pagos: lineas.map((l) => ({
      id: String(l.id ?? ''),
      numeroLinea: Number(l.numero_linea ?? 0),
      monto: Number(l.monto ?? 0),
      fechaPago: aISO(l.fecha_pago),
      estado: String(l.estado ?? ''),
    })),
    createdAt: aISO(cuota.created_at),
    updatedAt: aISO(cuota.updated_at),
  };
}
