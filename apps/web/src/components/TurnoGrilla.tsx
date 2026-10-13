import { useEffect, useMemo, useState } from 'react';
import BloqueoTemporal from './BloqueoTemporal';

// Slot shape mirrored from GET /turnos/disponibilidad (ACT-33, contract §5.3).
// Kept local so TurnoGrilla stays callable without touching lib/api.ts.
export interface SlotTurno {
  canchaId: string;
  nroCancha: number;
  horaInicio: string;
  horaFin: string;
  disponible: boolean;
  requiereLuz: boolean;
  motivo: string | null;
}

interface TurnoGrillaProps {
  fecha: string;
  token: string | null;
  seleccionado: SlotTurno | null;
  onSeleccionar: (slot: SlotTurno) => void;
}

const API_ORIGIN = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

// Example slots used ONLY when the real API is unreachable.
// They render disabled so nobody mistakes them for bookable data.
const EJEMPLO_SLOTS: SlotTurno[] = [
  { canchaId: 'ej-1', nroCancha: 1, horaInicio: '17:00', horaFin: '18:00', disponible: true, requiereLuz: false, motivo: null },
  { canchaId: 'ej-1', nroCancha: 1, horaInicio: '18:00', horaFin: '19:00', disponible: false, requiereLuz: false, motivo: 'Turno confirmado' },
  { canchaId: 'ej-1', nroCancha: 1, horaInicio: '19:00', horaFin: '20:00', disponible: true, requiereLuz: true, motivo: null },
  { canchaId: 'ej-2', nroCancha: 2, horaInicio: '17:00', horaFin: '18:00', disponible: false, requiereLuz: false, motivo: 'Cancha no disponible' },
  { canchaId: 'ej-2', nroCancha: 2, horaInicio: '18:00', horaFin: '19:00', disponible: true, requiereLuz: false, motivo: null },
  { canchaId: 'ej-2', nroCancha: 2, horaInicio: '19:00', horaFin: '20:00', disponible: true, requiereLuz: true, motivo: null },
  { canchaId: 'ej-3', nroCancha: 3, horaInicio: '17:00', horaFin: '18:00', disponible: true, requiereLuz: false, motivo: null },
  { canchaId: 'ej-3', nroCancha: 3, horaInicio: '18:00', horaFin: '19:00', disponible: true, requiereLuz: false, motivo: null },
  { canchaId: 'ej-3', nroCancha: 3, horaInicio: '19:00', horaFin: '20:00', disponible: false, requiereLuz: true, motivo: 'Turno confirmado' },
];

export default function TurnoGrilla({ fecha, token, seleccionado, onSeleccionar }: TurnoGrillaProps): JSX.Element {
  // Real listing wired to GET /turnos/disponibilidad with the Clerk token.
  const [slots, setSlots] = useState<SlotTurno[]>([]);
  const [cargando, setCargando] = useState(false);
  const [errorApi, setErrorApi] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setCargando(true);
    setErrorApi(null);
    const params = new URLSearchParams({ fecha });
    void (async () => {
      try {
        const response = await fetch(`${API_ORIGIN}/api/turnos/disponibilidad?${params.toString()}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!response.ok) {
          throw new Error(`Error ${response.status}`);
        }
        const data = (await response.json()) as { slots?: SlotTurno[] };
        if (active) {
          setSlots(Array.isArray(data.slots) ? data.slots : []);
        }
      } catch {
        if (active) {
          setErrorApi('No se pudo alcanzar la API de turnos.');
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
  }, [fecha, token]);

  // Fall back to disabled example data only when the API fails or is empty.
  const usandoEjemplo = errorApi !== null || (!cargando && slots.length === 0);
  const visibles = usandoEjemplo ? EJEMPLO_SLOTS : slots;

  // Group slots by court so the desktop grid reads court-first (Stitch reference).
  const porCancha = useMemo(() => {
    const grupos = new Map<number, SlotTurno[]>();
    for (const slot of visibles) {
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
  }, [visibles]);

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

  return (
    <div>
      {usandoEjemplo && (
        <div style={{ marginBottom: '0.75rem' }}>
          <BloqueoTemporal motivo="API pendiente" />
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem', color: '#384543' }}>
            Mostramos horarios de ejemplo deshabilitados. En cuanto la API responda, ves la
            disponibilidad real del día.
          </p>
        </div>
      )}
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
                  const bloqueado = usandoEjemplo || !slot.disponible;
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
