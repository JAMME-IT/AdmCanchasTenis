import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import { Calendar, Clock, CreditCard, Shield, TrendingUp } from 'lucide-react';
import { ApiError, api, type Usuario } from '../lib/api';
import { Skeleton } from '../components/Feedback';

export default function Home(): JSX.Element {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [perfilIncompleto, setPerfilIncompleto] = useState(false);

  const cargarPerfil = useCallback(async () => {
    setPerfilIncompleto(false);
    try {
      const token = await getToken();
      const perfil = await api.me(token);
      setUsuario(perfil);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 403) {
        setPerfilIncompleto(true);
      }
    }
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return;
    }
    void cargarPerfil();
  }, [cargarPerfil, isLoaded, isSignedIn]);

  if (!isLoaded) {
    return (
      <main className="py-8 px-6 pb-12 min-h-dvh font-sans bg-whisper text-musgo">
        <Skeleton rows={2} label="Cargando tu sesión…" />
      </main>
    );
  }

  if (!isSignedIn) {
    return (
      <main className="py-8 px-6 pb-12 min-h-dvh font-sans bg-whisper text-musgo">
        <div className="max-w-[1100px] mx-auto flex flex-col gap-8">
          <section className="bg-white border border-sereno rounded-2xl p-8">
            <h1 className="mb-4">Tenis Ranch Club</h1>
            <p className="mb-6 text-[#5A6661]">
              Gestión simple del club: tu sesión, tu perfil y tus turnos.
            </p>
            <div className="flex gap-4">
              <Link to="/ingresar" className="no-underline">
                <button className="px-6 py-3 bg-peridot text-white border-none rounded-lg font-semibold cursor-pointer">
                  Ingresar
                </button>
              </Link>
              <Link to="/registro" className="no-underline">
                <button className="px-6 py-3 bg-white text-peridot border-2 border-peridot rounded-lg font-semibold cursor-pointer">
                  Crear cuenta
                </button>
              </Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="py-8 px-6 pb-12 min-h-dvh font-sans bg-whisper text-musgo">
      <div className="max-w-[1100px] mx-auto flex flex-col gap-8">
        {perfilIncompleto && (
          <div className="bg-[#FFF4E5] border border-[#F5A623] rounded-lg p-4 text-[#8B6914]">
            Tu perfil está incompleto.{' '}
            <Link to="/completar-perfil" className="text-peridot font-semibold">
              Completar perfil
            </Link>
          </div>
        )}

        {usuario && (
          <div className="flex flex-col gap-2">
            <h1 className="m-0 text-3xl font-bold text-musgo">
              ¡Hola, {usuario.nombre}! 👋
            </h1>
            <p className="m-0 text-base text-[#5A6661]">
              ¿Querés hacer hoy?
            </p>
          </div>
        )}

        {/* Acciones rápidas */}
        <section className="flex flex-col gap-4">
          <h2 className="m-0 text-xl font-semibold text-musgo">Acciones rápidas</h2>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-5">
            <Link
              to="/turnos"
              className="flex flex-col bg-white rounded-2xl p-6 no-underline text-musgo border-2 border-transparent transition-all duration-200 shadow-[0_2px_8px_rgba(56,69,67,0.08)] hover:border-peridot hover:shadow-[0_4px_16px_rgba(50,129,97,0.15)]"
            >
              <div className="w-12 h-12 rounded-xl bg-[#E8F5F0] flex items-center justify-center mb-4">
                <Calendar size={24} color="#328161" strokeWidth={2} />
              </div>
              <h3 className="m-0 mb-2 text-lg font-semibold">Reservar cancha</h3>
              <p className="m-0 text-[#5A6661] text-sm leading-relaxed">
                Elegí tu horario y reservá tu cancha
              </p>
            </Link>

            <Link
              to="/mis-turnos"
              className="flex flex-col bg-white rounded-2xl p-6 no-underline text-musgo border-2 border-transparent transition-all duration-200 shadow-[0_2px_8px_rgba(56,69,67,0.08)] hover:border-fairway hover:shadow-[0_4px_16px_rgba(33,135,90,0.15)]"
            >
              <div className="w-12 h-12 rounded-xl bg-[#E8F5F0] flex items-center justify-center mb-4">
                <Clock size={24} color="#21875A" strokeWidth={2} />
              </div>
              <h3 className="m-0 mb-2 text-lg font-semibold">Mis turnos</h3>
              <p className="m-0 text-[#5A6661] text-sm leading-relaxed">
                Revisá tus turnos y cancelá si es necesario
              </p>
            </Link>

            <Link
              to="/mis-cuotas"
              className="flex flex-col bg-white rounded-2xl p-6 no-underline text-musgo border-2 border-transparent transition-all duration-200 shadow-[0_2px_8px_rgba(56,69,67,0.08)] hover:border-[#3FA67E] hover:shadow-[0_4px_16px_rgba(63,166,126,0.15)]"
            >
              <div className="w-12 h-12 rounded-xl bg-[#E8F5F0] flex items-center justify-center mb-4">
                <CreditCard size={24} color="#3FA67E" strokeWidth={2} />
              </div>
              <h3 className="m-0 mb-2 text-lg font-semibold">Mis cuotas</h3>
              <p className="m-0 text-[#5A6661] text-sm leading-relaxed">
                Controlá tus pagos y saldo pendiente
              </p>
            </Link>
          </div>
        </section>

        {/* Admin section */}
        {usuario?.rol === 'admin' && (
          <section className="flex flex-col gap-4">
            <h2 className="m-0 text-xl font-semibold text-musgo">Administración</h2>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-5">
              <Link
                to="/admin"
                className="flex flex-col bg-white rounded-2xl p-6 no-underline text-musgo border-2 border-transparent transition-all duration-200 shadow-[0_2px_8px_rgba(56,69,67,0.08)] hover:border-musgo hover:shadow-[0_4px_16px_rgba(56,69,67,0.15)]"
              >
                <div className="w-12 h-12 rounded-xl bg-[#F0F0F0] flex items-center justify-center mb-4">
                  <Shield size={24} color="#384543" strokeWidth={2} />
                </div>
                <h3 className="m-0 mb-2 text-lg font-semibold">Panel admin</h3>
                <p className="m-0 text-[#5A6661] text-sm leading-relaxed">
                  Gestioná turnos, pagos y usuarios
                </p>
              </Link>

              <Link
                to="/admin"
                className="flex flex-col bg-white rounded-2xl p-6 no-underline text-musgo border-2 border-transparent transition-all duration-200 shadow-[0_2px_8px_rgba(56,69,67,0.08)] hover:border-sereno hover:shadow-[0_4px_16px_rgba(138,154,147,0.15)]"
              >
                <div className="w-12 h-12 rounded-xl bg-[#F0F0F0] flex items-center justify-center mb-4">
                  <TrendingUp size={24} color="#8A9A93" strokeWidth={2} />
                </div>
                <h3 className="m-0 mb-2 text-lg font-semibold">Reportes</h3>
                <p className="m-0 text-[#5A6661] text-sm leading-relaxed">
                  Estadísticas e ingresos del club
                </p>
              </Link>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
