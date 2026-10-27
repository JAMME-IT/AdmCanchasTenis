import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/react';
import TurnoGrilla, { type SlotSeleccionado } from '../components/TurnoGrilla';
import { hoyART } from '../lib/fecha';

export default function Turnos(): JSX.Element {
  const { getToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [fecha, setFecha] = useState<string>(() => hoyART());
  const [seleccionado, setSeleccionado] = useState<SlotSeleccionado | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const valor = await getToken();
        if (active) {
          setToken(valor);
        }
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

  function cambiarFecha(valor: string): void {
    setFecha(valor);
    setSeleccionado(null);
  }

  return (
    <main className="py-6 px-6 pb-8 font-sans bg-whisper text-musgo min-h-dvh">
      <div className="max-w-[2000px] mx-auto flex flex-col gap-4">
        <header className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="m-0 text-2xl font-bold">Elegí tu turno</h1>
            <p className="m-0 text-sm text-sereno mt-1">Seleccioná día, cancha y horario</p>
          </div>
          <div className="flex items-center gap-3">
            <label htmlFor="fecha-turno" className="font-semibold text-sm">
              Día:
            </label>
            <input
              id="fecha-turno"
              type="date"
              value={fecha}
              onChange={(event) => cambiarFecha(event.target.value)}
              className="min-h-[40px] rounded-lg border-2 border-sereno px-3 py-1.5 bg-white text-musgo font-semibold hover:border-peridot focus:border-peridot focus:outline-none transition-colors"
            />
          </div>
        </header>

        <section aria-label="Grilla de turnos">
          <TurnoGrilla
            fecha={fecha}
            token={token}
            seleccionado={seleccionado}
            onSeleccionar={setSeleccionado}
          />
        </section>
      </div>
    </main>
  );
}
