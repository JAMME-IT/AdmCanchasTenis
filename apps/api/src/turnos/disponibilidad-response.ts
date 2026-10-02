import type { SlotDisponibilidad } from './disponibilidad-slots';

/** Slot type reused from the pure slot builder (single source of truth). */
export type SlotResponse = SlotDisponibilidad;

/** GET /turnos/disponibilidad response (API contract §5.3). */
export interface DisponibilidadResponse {
  fecha: string;
  duracionMinutos: number;
  slots: SlotResponse[];
}
