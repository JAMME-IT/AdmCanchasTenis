import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import TurnoGrilla, { type SlotTurno } from '../components/TurnoGrilla';

function hoyART(): string {
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}

export default function Turnos(): JSX.Element {
  const { getToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [fecha, setFecha] = useState<string>(() => hoyART());
  const [seleccionado, setSeleccionado] = useState<SlotTurno | null>(null);

  useMemo(() => {
    void (async () => {
      try {
        setToken(await getToken());
      } catch {
        setToken(null);
      }
    })();
  }, [getToken]);

  function cambiarFecha(valor: string): void {
    setFecha(valor);
    setSeleccionado(null);
  }

  function elegirSlot(slot: SlotTurno): void {
    setSeleccionado(slot);
  }

  return (
    <main className="py-10 px-6 pb-12 font-sans bg-whisper text-musgo min-h-dvh">
      <div className="max-w-[1120px] mx-auto flex flex-col gap-5">
        <p className="m-0">
          <Link to="/" className="text-peridot font-semibold">
            ← Volver al inicio
          </Link>
          {' · '}
          <Link to="/mis-turnos" className="text-peridot font-semibold">
            Ver mis turnos
          </Link>
        </p>

        <header className="flex flex-col gap-2">
          <p className="m-0 text-sm tracking-[0.08em] uppercase text-sereno">
            Club · Reserva de canchas
          </p>
          <h1 className="m-0 text-[clamp(1.8rem,4vw,2.6rem)] leading-[1.1]">
            Elegí tu turno
          </h1>
          <p className="m-0 max-w-[65ch]">
            Mirá la disponibilidad real del día y tocá un horario libre para ver el detalle.
            La hora que ves es hora del club (ART).
          </p>
        </header>

        <div className="flex items-center gap-3 flex-wrap">
          <label htmlFor="fecha-turno" className="font-semibold">
            Día
          </label>
          <input
            id="fecha-turno"
            type="date"
            value={fecha}
            onChange={(event) => cambiarFecha(event.target.value)}
            className="min-h-[44px] rounded-xl border border-sereno px-3 py-2 bg-white text-musgo"
          />
        </div>

        <section aria-label="Grilla de turnos">
          <TurnoGrilla
            fecha={fecha}
            token={token}
            seleccionado={seleccionado}
            onSeleccionar={elegirSlot}
          />
        </section>
      </div>
    </main>
  );
}
