import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import TurnoGrilla, { type SlotTurno } from '../components/TurnoGrilla';
import BloqueoTemporal from '../components/BloqueoTemporal';

// Palette: refined green #384543, whisper white #F5F3EF,
// peridot #328161, serene gray #8A9A93, purple #68457A (sparse detail only).

// Today in Argentina (UTC-3, no DST): shift the instant so UTC getters read ART.
function hoyART(): string {
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}

// ARS formatting for all prices shown on this page.
function formatoARS(valor: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(valor);
}

// Referential rate while the club publishes official tariffs (clearly labeled).
const TARIFA_REFERENCIA_HORA = 18000;

export default function Turnos(): JSX.Element {
  const { getToken } = useAuth();
  // Token is resolved once per page; the grid re-fetches when it arrives.
  const [token, setToken] = useState<string | null>(null);
  const [fecha, setFecha] = useState<string>(() => hoyART());
  const [seleccionado, setSeleccionado] = useState<SlotTurno | null>(null);

  // Lazily fetch the Clerk token on first render.
  useMemo(() => {
    void (async () => {
      try {
        setToken(await getToken());
      } catch {
        setToken(null);
      }
    })();
  }, [getToken]);

  // Reset the selection whenever the day changes.
  function cambiarFecha(valor: string): void {
    setFecha(valor);
    setSeleccionado(null);
  }

  return (
    <main
      style={{
        fontFamily: 'system-ui, sans-serif',
        backgroundColor: '#F5F3EF',
        color: '#384543',
        minHeight: '100dvh',
        padding: '2.5rem 1.5rem 3rem',
      }}
    >
      <style>{`@media (max-width: 880px) { .turnos-split { grid-template-columns: 1fr !important; } }`}</style>
      <div style={{ maxWidth: '1120px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <p style={{ margin: 0 }}>
          <Link to="/" style={{ color: '#328161', fontWeight: 600 }}>
            ← Volver al inicio
          </Link>
        </p>

        <header style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <p style={{ margin: 0, fontSize: '0.85rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8A9A93' }}>
            Club · Reserva de canchas
          </p>
          <h1 style={{ margin: 0, fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', lineHeight: 1.1 }}>
            Elegí tu turno
          </h1>
          <p style={{ margin: 0, maxWidth: '65ch' }}>
            Mirá la disponibilidad real del día y tocá un horario libre para ver el detalle.
            La hora que ves es hora del club (ART). La confirmación se habilita cuando el club
            publique tarifas y tipos de turno.
          </p>
        </header>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <label htmlFor="fecha-turno" style={{ fontWeight: 600 }}>
            Día
          </label>
          <input
            id="fecha-turno"
            type="date"
            value={fecha}
            onChange={(event) => cambiarFecha(event.target.value)}
            style={{
              minHeight: '44px',
              borderRadius: '0.75rem',
              border: '1px solid #8A9A93',
              padding: '0.5rem 0.75rem',
              backgroundColor: '#FFFFFF',
              color: '#384543',
            }}
          />
        </div>

        {/* Asymmetric split: wide grid + narrow detail (stacks on mobile). */}
        <div className="turnos-split" style={{ display: 'grid', gridTemplateColumns: '1.9fr 1fr', gap: '1.25rem', alignItems: 'start' }}>
          <section aria-label="Grilla semanal de turnos">
            <TurnoGrilla
              fecha={fecha}
              token={token}
              seleccionado={seleccionado}
              onSeleccionar={setSeleccionado}
            />
          </section>

          <aside
            aria-label="Detalle del turno"
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #8A9A93',
              borderRadius: '1rem',
              padding: '1.25rem',
              position: 'sticky',
              top: '1rem',
            }}
          >
            <h2 style={{ marginTop: 0 }}>Tu turno</h2>
            {seleccionado ? (
              <>
                <dl style={{ display: 'grid', gap: '0.4rem', margin: '0 0 1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                    <dt>Día</dt>
                    <dd style={{ margin: 0, fontWeight: 600 }}>{fecha}</dd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                    <dt>Horario</dt>
                    <dd style={{ margin: 0, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      {seleccionado.horaInicio}–{seleccionado.horaFin} ART
                    </dd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                    <dt>Cancha</dt>
                    <dd style={{ margin: 0, fontWeight: 600 }}>{seleccionado.nroCancha}</dd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                    <dt>Luz</dt>
                    <dd style={{ margin: 0, fontWeight: 600 }}>
                      {seleccionado.requiereLuz ? 'Sí, con cargo compartido' : 'No hace falta'}
                    </dd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                    <dt>Referencia</dt>
                    <dd style={{ margin: 0, fontWeight: 600 }}>{formatoARS(TARIFA_REFERENCIA_HORA)} / hora</dd>
                  </div>
                </dl>
                {/* Sparse purple accent (under 5%): selected-day marker only. */}
                <p style={{ fontSize: '0.85rem', color: '#68457A', margin: '0 0 1rem' }}>
                  Valor referencial. El importe final lo confirma el club al habilitar la reserva.
                </p>
                <BloqueoTemporal motivo="Reserva pendiente" />
                <button
                  type="button"
                  disabled
                  style={{
                    marginTop: '0.75rem',
                    width: '100%',
                    minHeight: '44px',
                    backgroundColor: '#328161',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '0.75rem',
                    padding: '0.7rem 1rem',
                    fontWeight: 700,
                    cursor: 'not-allowed',
                    opacity: 0.75,
                  }}
                >
                  Confirmar reserva
                </button>
                <p style={{ fontSize: '0.9rem', marginBottom: 0 }}>
                  Falta que la API exponga tipos de turno y tarifas para confirmar con tu sesión.
                </p>
              </>
            ) : (
              <>
                <p style={{ marginTop: 0 }}>
                  Todavía no elegiste horario. Tocá un bloque libre de la grilla y acá ves el
                  resumen con precio estimado en ARS.
                </p>
                <BloqueoTemporal motivo="Sin selección" />
              </>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
