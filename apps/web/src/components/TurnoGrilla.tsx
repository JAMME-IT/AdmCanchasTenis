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
    <div className="bg-white rounded-2xl border-2 border-sereno p-6">
      {porCancha.length === 0 ? (
        <p className="text-center text-sereno py-8">No hay canchas configuradas para este día.</p>
      ) : (
        <>
          {/* Botones de selección de cancha */}
          <div className="flex gap-3 mb-6 flex-wrap">
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

          {/* Timeline de turnos */}
          {canchaSeleccionada !== null && porCancha.find(g => g.nro === canchaSeleccionada) && (
            <div className="flex flex-col gap-3">
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
                    className={`relative w-full text-left rounded-xl p-4 transition-all ${
                      !disponible
                        ? 'bg-gray-100 border-2 border-gray-200 cursor-not-allowed opacity-60'
                        : activo
                        ? 'bg-peridot text-white border-2 border-peridot shadow-xl scale-[1.02]'
                        : 'bg-whisper border-2 border-sereno hover:border-peridot hover:shadow-lg hover:scale-[1.01] cursor-pointer'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        {/* Hora */}
                        <div className={`text-2xl font-bold tabular-nums mb-1 ${
                          activo ? 'text-white' : disponible ? 'text-musgo' : 'text-gray-500'
                        }`}>
                          {slot.horaInicio} – {slot.horaFin}
                        </div>
                        
                        {/* Estado y detalles */}
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                            activo
                              ? 'bg-white/20 text-white'
                              : disponible
                              ? 'bg-peridot/10 text-peridot'
                              : 'bg-gray-200 text-gray-600'
                          }`}>
                            {disponible ? '✓ Disponible' : '✗ Ocupado'}
                          </span>
                          
                          {slot.requiereLuz && (
                            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
                              activo ? 'bg-white/20 text-white' : 'bg-pelota/20 text-musgo'
                            }`}>
                              💡 Con luz
                            </span>
                          )}
                          
                          {!disponible && slot.motivo && (
                            <span className="text-xs text-gray-500 italic">
                              {slot.motivo}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Indicador visual de selección */}
                      {activo && (
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 rounded-full bg-white/30 flex items-center justify-center">
                            <span className="text-white text-xl">→</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
