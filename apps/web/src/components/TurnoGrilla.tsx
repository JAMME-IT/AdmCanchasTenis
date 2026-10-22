import { useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError, type SlotDisponibilidad } from '../lib/api';

// Slot shape shared with GET /turnos/disponibilidad (contract §5.3) via lib/api,
// so the grid and the booking page speak the same contract.
export type SlotTurno = SlotDisponibilidad;

export interface DisponibilidadInfo {
  fecha: string;
  duracionMinutos: number;
}

interface TurnoGrillaProps {
  fecha: string;
  token: string | null;
  seleccionado: SlotTurno | null;
  onSeleccionar: (slot: SlotTurno) => void;
  onDisponibilidad?: (info: DisponibilidadInfo) => void;
}

export default function TurnoGrilla({
  fecha,
  token,
  seleccionado,
  onSeleccionar,
  onDisponibilidad,
}: TurnoGrillaProps): JSX.Element {
  // Real listing wired to GET /turnos/disponibilidad through lib/api.
  const [slots, setSlots] = useState<SlotTurno[]>([]);
  const [cargando, setCargando] = useState(false);
  const [errorApi, setErrorApi] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  const [canchaSeleccionada, setCanchaSeleccionada] = useState<number | null>(null);
  // Latest callback without retriggering the fetch when the parent re-renders.
  const observadorRef = useRef(onDisponibilidad);
  observadorRef.current = onDisponibilidad;

  useEffect(() => {
    let active = true;
    setCargando(true);
    setErrorApi(null);
    void (async () => {
      try {
        const data = await api.disponibilidad(token, fecha);
        if (active) {
          setSlots(data.slots);
          // Inicializar con la primera cancha disponible
          if (data.slots.length > 0) {
            const primeraCancha = Math.min(...data.slots.map(s => s.nroCancha));
            setCanchaSeleccionada(primeraCancha);
          }
          observadorRef.current?.({
            fecha: data.fecha,
            duracionMinutos: data.duracionMinutos,
          });
        }
      } catch (error) {
        if (active) {
          setErrorApi(
            error instanceof ApiError
              ? error.message
              : 'No se pudo alcanzar la API de turnos.',
          );
          setSlots([]);
        }
      } finally {
        if (active) {
          setCargando(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [fecha, token, intento]);

  // Group slots by court so the desktop grid reads court-first (Stitch reference).
  const porCancha = useMemo(() => {
    const grupos = new Map<number, SlotTurno[]>();
    for (const slot of slots) {
      const lista = grupos.get(slot.nroCancha) ?? [];
      lista.push(slot);
      grupos.set(slot.nroCancha, lista);
    }
    return [...grupos.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([nro, lista]) => ({
        nro,
        lista: [...lista].sort((a, b) => a.horaInicio.localeCompare(b.horaInicio)),
      }));
  }, [slots]);

  if (cargando) {
    // Skeletal loader matching the grid shape, no generic spinner.
    return (
      <div aria-busy="true" aria-label="Cargando turnos" className="grid gap-3">
        {[0, 1, 2].map((fila) => (
          <div
            key={fila}
            className="h-14 rounded-xl bg-[#EAE7E0]"
          />
        ))}
      </div>
    );
  }

  if (errorApi !== null) {
    // Real API error with retry, following the page card style.
    return (
      <div
        role="alert"
        className="bg-white border border-sereno rounded-2xl p-5 flex flex-col gap-3"
      >
        <p className="m-0 font-semibold">No se pudo cargar la disponibilidad.</p>
        <p className="m-0 text-sm text-error">{errorApi}</p>
        <button
          type="button"
          onClick={() => setIntento((previo) => previo + 1)}
          className="min-h-[44px] self-start bg-peridot text-white border-none rounded-xl px-5 py-2.5 font-bold cursor-pointer"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div>
      {porCancha.length === 0 ? (
        <p className="text-center text-sereno py-8">No hay canchas configuradas para este día.</p>
      ) : (
        <>
          {/* Botones de selección de cancha */}
          <div className="flex gap-3 mb-5 flex-wrap">
            {porCancha.map((grupo) => (
              <button
                key={grupo.nro}
                type="button"
                onClick={() => setCanchaSeleccionada(grupo.nro)}
                className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all cursor-pointer ${
                  canchaSeleccionada === grupo.nro
                    ? 'bg-peridot text-white shadow-lg scale-105'
                    : 'bg-whisper text-musgo border-2 border-sereno hover:border-peridot hover:shadow-md'
                }`}
              >
                Cancha {grupo.nro}
              </button>
            ))}
          </div>

          {/* Grilla horizontal de turnos */}
          {canchaSeleccionada !== null && porCancha.find(g => g.nro === canchaSeleccionada) && (
            <div className="bg-wimbledon/90 rounded-2xl p-6">
              <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
                {porCancha.find(g => g.nro === canchaSeleccionada)!.lista.map((slot) => {
                  const key = `${slot.canchaId}-${slot.horaInicio}`;
                  const activo =
                    seleccionado?.canchaId === slot.canchaId &&
                    seleccionado?.horaInicio === slot.horaInicio;
                  const disponible = slot.disponible;
                  
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={!disponible}
                      onClick={() => onSeleccionar(slot)}
                      className={`relative h-[70px] rounded-xl p-3 transition-all flex items-center justify-center backdrop-blur-md ${
                        !disponible
                          ? 'bg-gray-500/60 cursor-not-allowed opacity-60'
                          : activo
                          ? 'bg-white/30 text-white border-2 border-white shadow-xl scale-105'
                          : 'bg-white/15 text-white hover:bg-white/25 hover:scale-105 cursor-pointer'
                      }`}
                    >
                      {/* Resplandor para turnos con luz */}
                      {slot.requiereLuz && disponible && (
                        <div className="absolute top-0 right-0 w-12 h-12 pointer-events-none">
                          <div className="absolute top-1 right-1 w-8 h-8 rounded-full bg-pelota/40 blur-md"></div>
                          <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-pelota/60 blur-sm"></div>
                        </div>
                      )}
                      
                      {/* Hora centrada */}
                      <div className="text-sm font-bold tabular-nums">
                        {slot.horaInicio} - {slot.horaFin}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
