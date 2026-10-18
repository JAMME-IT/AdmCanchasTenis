import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/react';
import { ApiError, api, type MiCuota } from '../lib/api';
import { CuotaProgress, EmptyState, ErrorCard, Skeleton, StatusPill } from '../components/Feedback';

// Palette: refined green #384543, whisper white #F5F3EF,
// peridot #328161, serene gray #8A9A93.

function formatoARS(valor: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(valor);
}

// Date-only 'YYYY-MM-DD' must be formatted by string manipulation only:
// new Date(fecha) parses as UTC and shifts the day in Argentina (UTC-3).
function formatoFechaCorta(fecha: string): string {
  const partes = fecha.split('-');
  if (partes.length !== 3) {
    return fecha;
  }
  const [anio, mes, dia] = partes;
  return `${dia}/${mes}/${anio}`;
}

// Pago timestamps may carry a time part ('YYYY-MM-DDTHH:mm…'): the day
// is what matters, so strip the time before the date-only formatting.
function formatoFechaPago(fechaPago: string): string {
  return formatoFechaCorta(fechaPago.split('T')[0]);
}

function etiquetaEstado(estado: string): string {
  switch (estado) {
    case 'pendiente':
      return 'Pendiente';
    case 'parcial':
      return 'Parcial';
    case 'pagada':
      return 'Pagada';
    case 'adeudada':
      return 'Adeudada';
    case 'cancelada':
      return 'Cancelada';
    default:
      return estado;
  }
}

export default function MisCuotas(): JSX.Element {
  const { getToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [cuotas, setCuotas] = useState<MiCuota[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        setToken(await getToken());
      } catch {
        if (active) {
          setToken(null);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [getToken]);

  const cargar = useCallback(async (authToken: string | null) => {
    setCargando(true);
    setError(null);
    try {
      const data = await api.misCuotas(authToken);
      setCuotas(data);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'No se pudieron cargar tus cuotas.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (token === null) {
      return;
    }
    void cargar(token);
  }, [token, cargar]);

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
      <div style={{ maxWidth: '960px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <header style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <p style={{ margin: 0, fontSize: '0.85rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8A9A93' }}>
            Club · Mi cuenta
          </p>
          <h1 style={{ margin: 0, fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', lineHeight: 1.1 }}>
            Mis cuotas
          </h1>
          <p style={{ margin: 0, maxWidth: '65ch' }}>
            Acá ves tus cuotas con lo pagado, el saldo y cada pago registrado.
          </p>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#8A9A93' }}>
            Se abona en el club: el pago se registra en caja, acá solo ves el estado.
          </p>
        </header>

        {cargando && <Skeleton rows={3} label="Cargando tus cuotas…" />}

        {!cargando && error && (
          <ErrorCard message={`No se pudieron cargar: ${error}`} onRetry={() => void cargar(token)} />
        )}

        {!cargando && !error && cuotas.length === 0 && (
          <EmptyState message="No tenés cuotas emitidas todavía" />
        )}

        {!cargando && !error && cuotas.length > 0 && (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {cuotas.map((cuota) => (
              <li
                key={cuota.id}
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #8A9A93',
                  borderRadius: '1rem',
                  padding: '1rem 1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                  <strong>
                    {formatoFechaCorta(cuota.fechaInicio)} · vence {formatoFechaCorta(cuota.fechaVencimiento)}
                  </strong>
                  <StatusPill estado={cuota.estadoActual} label={etiquetaEstado(cuota.estadoActual)} />
                </div>
                <p style={{ margin: 0, fontVariantNumeric: 'tabular-nums' }}>
                  Total {formatoARS(cuota.montoTotal)} · Pagado {formatoARS(cuota.totalPagado)} · Saldo{' '}
                  {formatoARS(cuota.saldo)}
                </p>
                <CuotaProgress pagado={cuota.totalPagado} total={cuota.montoTotal} />
                {cuota.pagos.length > 0 ? (
                  <ul style={{ margin: 0, paddingInlineStart: '1.25rem', fontSize: '0.9rem' }}>
                    {cuota.pagos.map((pago) => (
                      <li key={pago.id}>
                        Línea {pago.numeroLinea} · {formatoARS(pago.monto)} · pagado el{' '}
                        {formatoFechaPago(pago.fechaPago)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#8A9A93' }}>Sin pagos registrados</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
