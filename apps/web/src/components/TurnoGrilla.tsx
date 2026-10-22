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
        <p>No hay canchas configuradas para este día.</p>
      ) : (
        <div className="grid gap-4">
          {porCancha.map((grupo) => (
            <section
              key={grupo.nro}
              aria-label={`Cancha ${grupo.nro}`}
              className="bg-white border border-sereno rounded-2xl p-4"
            >
              <h3 className="m-0 mb-3 text-base">Cancha {grupo.nro}</h3>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5">
                {grupo.lista.map((slot) => {
                  const key = `${slot.canchaId}-${slot.horaInicio}`;
                  const activo =
                    seleccionado?.canchaId === slot.canchaId &&
                    seleccionado?.horaInicio === slot.horaInicio;
                  const bloqueado = !slot.disponible;
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={bloqueado}
                      onClick={() => onSeleccionar(slot)}
                      title={slot.motivo ?? `${slot.horaInicio} ART disponible`}
                      className={`min-h-[44px] text-left rounded-xl px-3 py-2.5 font-semibold text-sm transition-colors ${
                        bloqueado
                          ? 'cursor-not-allowed opacity-72'
                          : 'cursor-pointer'
                      } ${
                        activo
                          ? 'border-2 border-peridot border-l-4 border-l-peridot bg-peridot text-white'
                          : 'border border-sereno border-l-4 ' +
                            (slot.disponible
                              ? 'border-l-peridot bg-whisper text-musgo'
                              : 'border-l-sereno bg-whisper text-musgo')
                      }`}
                    >
                      <span className="block tabular-nums">
                        {slot.horaInicio}–{slot.horaFin} ART
                      </span>
                      <span className="block text-xs font-medium">
                        {slot.disponible ? 'Libre' : (slot.motivo ?? 'Ocupado')}
                        {slot.requiereLuz ? ' · con luz' : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
