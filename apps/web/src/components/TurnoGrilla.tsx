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
      <div aria-busy="true" aria-label="Cargando turnos" style={{ display: 'grid', gap: '0.75rem' }}>
        {[0, 1, 2].map((fila) => (
          <div
            key={fila}
            style={{ height: '3.5rem', borderRadius: '0.75rem', backgroundColor: '#EAE7E0' }}
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
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #8A9A93',
          borderRadius: '1rem',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}
      >
        <p style={{ margin: 0, fontWeight: 600 }}>No se pudo cargar la disponibilidad.</p>
        <p style={{ margin: 0, fontSize: '0.9rem', color: '#9B2C2C' }}>{errorApi}</p>
        <button
          type="button"
          onClick={() => setIntento((previo) => previo + 1)}
          style={{
            minHeight: '44px',
            alignSelf: 'flex-start',
            backgroundColor: '#328161',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '0.75rem',
            padding: '0.7rem 1.25rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
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
        <div style={{ display: 'grid', gap: '1rem' }}>
          {porCancha.map((grupo) => (
            <section
              key={grupo.nro}
              aria-label={`Cancha ${grupo.nro}`}
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #8A9A93',
                borderRadius: '1rem',
                padding: '1rem',
              }}
            >
              <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Cancha {grupo.nro}</h3>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                  gap: '0.6rem',
                }}
              >
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
                      style={{
                        minHeight: '44px',
                        textAlign: 'left',
                        borderRadius: '0.75rem',
                        padding: '0.6rem 0.75rem',
                        cursor: bloqueado ? 'not-allowed' : 'pointer',
                        border: activo ? '2px solid #328161' : '1px solid #8A9A93',
                        borderLeft: slot.disponible
                          ? '4px solid #328161'
                          : '4px solid #8A9A93',
                        backgroundColor: activo ? '#328161' : '#F5F3EF',
                        color: activo ? '#FFFFFF' : '#384543',
                        opacity: bloqueado ? 0.72 : 1,
                        fontWeight: 600,
                      }}
                    >
                      <span style={{ display: 'block', fontVariantNumeric: 'tabular-nums' }}>
                        {slot.horaInicio}–{slot.horaFin} ART
                      </span>
                      <span style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500 }}>
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
