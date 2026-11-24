import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/react';
import { ApiError, api, type MiCuota } from '../lib/api';
import { CuotaProgress, EmptyState, ErrorCard, Skeleton, StatusPill } from '../components/Feedback';

function formatoARS(valor: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(valor);
}

function formatoFechaCorta(fecha: string): string {
  const partes = fecha.split('-');
  if (partes.length !== 3) {
    return fecha;
  }
  const [anio, mes, dia] = partes;
  return `${dia}/${mes}/${anio}`;
}

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
    <main className="py-10 px-6 pb-12 font-sans bg-whisper text-musgo min-h-dvh">
      <div className="max-w-[960px] mx-auto flex flex-col gap-5">
        <header className="flex flex-col gap-2">
          <p className="m-0 text-sm tracking-[0.08em] uppercase text-sereno">
            Club · Mi cuenta
          </p>
          <h1 className="m-0 text-[clamp(1.8rem,4vw,2.6rem)] leading-[1.1]">
            Mis cuotas
          </h1>
          <p className="m-0 max-w-[65ch]">
            Acá ves tus cuotas con lo pagado, el saldo y cada pago registrado.
          </p>
          <p className="m-0 text-sm text-sereno">
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
          <ul className="list-none m-0 p-0 flex flex-col gap-3">
            {cuotas.map((cuota) => (
              <li
                key={cuota.id}
                className="bg-white border border-sereno rounded-2xl px-5 py-4 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <strong>
                    {formatoFechaCorta(cuota.fechaInicio)} · vence {formatoFechaCorta(cuota.fechaVencimiento)}
                  </strong>
                  <StatusPill estado={cuota.estadoActual} label={etiquetaEstado(cuota.estadoActual)} />
                </div>
                <p className="m-0 tabular-nums">
                  Total {formatoARS(cuota.montoTotal)} · Pagado {formatoARS(cuota.totalPagado)} · Saldo{' '}
                  {formatoARS(cuota.saldo)}
                </p>
                <CuotaProgress pagado={cuota.totalPagado} total={cuota.montoTotal} />
                {cuota.pagos.length > 0 ? (
                  <ul className="m-0 ps-5 text-sm">
                    {cuota.pagos.map((pago) => (
                      <li key={pago.id}>
                        Línea {pago.numeroLinea} · {formatoARS(pago.monto)} · pagado el{' '}
                        {formatoFechaPago(pago.fechaPago)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="m-0 text-sm text-sereno">Sin pagos registrados</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
