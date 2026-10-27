import { useEffect, useMemo, useState } from 'react';
import { api, ApiError, type SlotDisponibilidad } from '../lib/api';
import CanchaTenis from './CanchaTenis';
import DigitoLcd from './DigitoLcd';

// Slot shape shared with GET /turnos/disponibilidad (contract §5.3) via lib/api.
export type SlotTurno = SlotDisponibilidad;

/** Slot elegido: el slot del día consultado. */
export type SlotSeleccionado = SlotTurno & { fecha: string };

interface TurnoGrillaProps {
  /** Día consultado (`YYYY-MM-DD`). */
  fecha: string;
  token: string | null;
  seleccionado: SlotSeleccionado | null;
  onSeleccionar: (slot: SlotSeleccionado) => void;
}

/**
 * Grilla de turnos de un día: cada horario es una card con forma de cancha.
 * La cancha se elige con el selector de arriba y la grilla muestra todas sus
 * franjas del día consultado.
 */
export default function TurnoGrilla({
  fecha,
  token,
  seleccionado,
  onSeleccionar,
}: TurnoGrillaProps): JSX.Element {
  const [slots, setSlots] = useState<SlotTurno[]>([]);
  const [cargando, setCargando] = useState(false);
  const [errorApi, setErrorApi] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  const [canchaSeleccionada, setCanchaSeleccionada] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    setCargando(true);
    setErrorApi(null);
    void (async () => {
      try {
        const data = await api.disponibilidad(token, fecha);
        if (!active) {
          return;
        }
        setSlots(data.slots);
        const canchas = [...new Set(data.slots.map((slot) => slot.nroCancha))].sort((a, b) => a - b);
        setCanchaSeleccionada((previa) =>
          previa !== null && canchas.includes(previa) ? previa : (canchas[0] ?? null),
        );
      } catch (error) {
        if (active) {
          setErrorApi(
            error instanceof ApiError ? error.message : 'No se pudo alcanzar la API de turnos.',
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

  const canchas = useMemo(
    () => [...new Set(slots.map((slot) => slot.nroCancha))].sort((a, b) => a - b),
    [slots],
  );

  const delDia = useMemo(
    () =>
      canchaSeleccionada === null
        ? []
        : slots
            .filter((slot) => slot.nroCancha === canchaSeleccionada)
            .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio)),
    [slots, canchaSeleccionada],
  );

  if (cargando) {
    // Skeletal loader con la forma de la grilla, sin spinner genérico.
    return (
      <div aria-busy="true" aria-label="Cargando turnos" className="bg-wimbledon rounded-2xl p-3 sm:p-4">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3">
          {Array.from({ length: 14 }, (_, i) => (
            <div key={i} className="aspect-[236/136] rounded-md bg-white/10" />
          ))}
        </div>
      </div>
    );
  }

  if (errorApi !== null) {
    return (
      <div role="alert" className="bg-white border border-sereno rounded-2xl p-5 flex flex-col gap-3">
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

  if (delDia.length === 0) {
    return (
      <p className="text-center text-sereno py-8">
        No hay disponibilidad para este día. Probá con otra fecha.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Selector de cancha: la grilla muestra los horarios de una cancha por vez. */}
      <div className="flex gap-3 flex-wrap">
        {canchas.map((nro) => (
          <button
            key={nro}
            type="button"
            onClick={() => setCanchaSeleccionada(nro)}
            aria-pressed={canchaSeleccionada === nro}
            className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all cursor-pointer ${
              canchaSeleccionada === nro
                ? 'bg-peridot text-white shadow-lg scale-105'
                : 'bg-whisper text-musgo border-2 border-sereno hover:border-peridot hover:shadow-md'
            }`}
          >
            Cancha {nro}
          </button>
        ))}
      </div>

      <div className="bg-wimbledon rounded-2xl p-3 sm:p-4">
        <ul className="m-0 p-0 list-none grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {delDia.map((slot) => {
            const activo =
              seleccionado?.fecha === fecha &&
              seleccionado.canchaId === slot.canchaId &&
              seleccionado.horaInicio === slot.horaInicio;

            if (!slot.disponible) {
              return (
                <li key={slot.horaInicio}>
                  <button
                    type="button"
                    disabled
                    title={slot.motivo ?? 'Horario no disponible'}
                    aria-label={`${slot.horaInicio} a ${slot.horaFin}, ocupado`}
                    className="relative block aspect-[236/136] w-full overflow-hidden rounded-md bg-polvo/35 saturate-50 cursor-not-allowed"
                  >
                    <CanchaTenis className="absolute inset-0 h-full w-full text-white/25" />
                    <HorarioLcd hora={slot.horaInicio} className="text-black/35" />
                  </button>
                </li>
              );
            }

            return (
              <li key={slot.horaInicio}>
                <button
                  type="button"
                  onClick={() => onSeleccionar({ ...slot, fecha })}
                  aria-pressed={activo}
                  aria-label={`${slot.horaInicio} a ${slot.horaFin}${slot.requiereLuz ? ', con luz' : ''}`}
                  title={`${slot.horaInicio} - ${slot.horaFin}${slot.requiereLuz ? ' · con luz' : ''}`}
                  className={`group relative block aspect-[236/136] w-full overflow-hidden rounded-md transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-pelota focus-visible:outline-offset-2 ${
                    activo ? 'bg-polvo ring-2 ring-white brightness-110' : 'bg-polvo hover:brightness-110'
                  }`}
                >
                  <CanchaTenis
                    className={`absolute inset-0 h-full w-full transition-colors ${
                      activo ? 'text-white/90' : 'text-white/65 group-hover:text-white/85'
                    }`}
                  />
                  {slot.requiereLuz && (
                    <span
                      aria-hidden="true"
                      className="glow-luz pointer-events-none absolute inset-0 rounded-md"
                    />
                  )}
                  <HorarioLcd hora={slot.horaInicio} className="text-black/90" />
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Leyenda: las cards no llevan texto de estado, así que se explica una vez. */}
      <ul className="m-0 p-0 list-none flex flex-wrap gap-x-4 gap-y-2 text-[0.72rem] text-sereno">
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-3.5 w-5 rounded-[3px] bg-polvo border border-white/25" />
          Libre
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-3.5 w-5 rounded-[3px] bg-polvo/35 saturate-50 border border-white/10" />
          Ocupado
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="grid h-3.5 w-5 place-items-center rounded-[3px] bg-polvo border border-white/25">
            <span className="h-2 w-2 rounded-full bg-pelota" />
          </span>
          Con luz
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-3.5 w-5 rounded-[3px] bg-polvo ring-2 ring-white" />
          Seleccionado
        </li>
      </ul>
    </div>
  );
}

/**
 * Horario `HH:MM` como display LCD en una sola línea horizontal, centrado
 * sobre la cancha. El texto accesible lo aporta el `aria-label` del botón.
 */
function HorarioLcd({ hora, className }: { hora: string; className?: string }): JSX.Element {
  return (
    <span className="pointer-events-none absolute inset-0 flex items-center justify-center gap-[2%]">
      {hora.split('').map((caracter, indice) => (
        <DigitoLcd
          key={indice}
          digito={caracter}
          className={`h-[30%] w-auto ${caracter === ':' ? 'aspect-[14/72]' : 'aspect-[40/72]'} ${className ?? ''}`}
        />
      ))}
    </span>
  );
}
