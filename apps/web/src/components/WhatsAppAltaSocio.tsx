import { useEffect, useRef, useState } from 'react';
import { ArrowRight, MessageCircle, X } from 'lucide-react';
import { mensajeAltaSocio, urlAltaSocio, type UsuarioWhatsApp } from '../lib/whatsapp';

interface MensajeChat {
  autor: 'club' | 'usuario';
  texto: string;
}

/** Delay between simulated messages, in milliseconds. */
const PAUSA_MS = 900;

/** Messages shown before the conversation waits for the user's confirmation. */
const MENSAJES_ANTES_DE_CONFIRMAR = 2;

function guion(usuario: UsuarioWhatsApp): MensajeChat[] {
  return [
    { autor: 'club', texto: `¡Hola ${usuario.nombre}! 👋 Bienvenido al Tenis Ranch Club.` },
    { autor: 'club', texto: '¿Querés hacerte socio? Te ayudamos a pedir el alta.' },
    { autor: 'usuario', texto: mensajeAltaSocio(usuario) },
    {
      autor: 'club',
      texto: '¡Perfecto! Te derivamos al chat de la administración para completar el alta.',
    },
  ];
}

function prefiereMenosMovimiento(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

/**
 * Floating WhatsApp launcher for non-members (ACT-55, RF-8). Opens a panel that
 * plays a short simulated sign-up conversation and then hands off to the real
 * WhatsApp chat with the administration, with the request message prefilled.
 */
export default function WhatsAppAltaSocio({
  usuario,
}: {
  usuario: UsuarioWhatsApp;
}): JSX.Element {
  const [abierto, setAbierto] = useState(false);
  const [visibles, setVisibles] = useState(0);
  const [confirmado, setConfirmado] = useState(false);
  const cerrarRef = useRef<HTMLButtonElement>(null);
  const lanzadorRef = useRef<HTMLButtonElement>(null);

  const mensajes = guion(usuario);
  const url = urlAltaSocio(import.meta.env.VITE_WHATSAPP_ADMIN, usuario);
  // The script pauses after the club's question until the user confirms.
  const limite = confirmado ? mensajes.length : MENSAJES_ANTES_DE_CONFIRMAR;
  const escribiendo = visibles < limite;
  const esperandoConfirmacion = !confirmado && visibles >= MENSAJES_ANTES_DE_CONFIRMAR;
  const terminado = visibles >= mensajes.length;

  // Reveal the scripted messages one by one, up to the current limit.
  useEffect(() => {
    if (!abierto) {
      setVisibles(0);
      setConfirmado(false);
      return;
    }
    if (prefiereMenosMovimiento()) {
      setVisibles(limite);
      return;
    }
    if (visibles >= limite) {
      return;
    }
    const id = window.setTimeout(() => setVisibles((n) => n + 1), PAUSA_MS);
    return () => window.clearTimeout(id);
  }, [abierto, visibles, limite]);

  // Focus management and Escape to close.
  useEffect(() => {
    if (!abierto) {
      return;
    }
    cerrarRef.current?.focus();
    const alPresionar = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setAbierto(false);
        lanzadorRef.current?.focus();
      }
    };
    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  }, [abierto]);

  return (
    <div className="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] nav:right-6 nav:bottom-6 z-50 flex flex-col items-end gap-3">
      {abierto && (
        <section
          role="dialog"
          aria-modal="false"
          aria-labelledby="wa-alta-titulo"
          className="w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl bg-white shadow-[0_12px_40px_rgba(56,69,67,0.28)]"
        >
          <header className="flex items-center gap-3 bg-[#075E54] px-4 py-3 text-white">
            <span
              aria-hidden="true"
              className="grid size-9 shrink-0 place-items-center rounded-full bg-white/20 text-sm font-bold"
            >
              TRC
            </span>
            <div className="flex-1 min-w-0">
              <h2 id="wa-alta-titulo" className="m-0 text-base font-semibold leading-tight">
                Administración
              </h2>
              <p className="m-0 text-xs text-white/80">
                {escribiendo ? 'escribiendo…' : 'en línea'}
              </p>
            </div>
            <button
              ref={cerrarRef}
              type="button"
              aria-label="Cerrar chat"
              onClick={() => {
                setAbierto(false);
                lanzadorRef.current?.focus();
              }}
              className="grid size-9 place-items-center rounded-full text-white/90 transition hover:bg-white/15 cursor-pointer focus-visible:outline-2 focus-visible:outline-white"
            >
              <X size={20} />
            </button>
          </header>

          <ol
            aria-live="polite"
            className="m-0 flex max-h-[50dvh] min-h-48 list-none flex-col gap-2 overflow-y-auto bg-[#ECE5DD] p-4"
          >
            {mensajes.slice(0, visibles).map((mensaje, indice) => (
              <li
                key={indice}
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-snug text-[#303030] shadow-[0_1px_1px_rgba(0,0,0,0.12)] ${
                  mensaje.autor === 'usuario'
                    ? 'self-end rounded-tr-none bg-[#DCF8C6]'
                    : 'self-start rounded-tl-none bg-white'
                }`}
              >
                <span className="sr-only">
                  {mensaje.autor === 'usuario' ? 'Vos: ' : 'Administración: '}
                </span>
                {mensaje.texto}
              </li>
            ))}
            {escribiendo && (
              <li
                aria-hidden="true"
                className="self-start flex gap-1 rounded-lg rounded-tl-none bg-white px-3 py-3"
              >
                <span className="size-1.5 animate-bounce rounded-full bg-sereno" />
                <span className="size-1.5 animate-bounce rounded-full bg-sereno [animation-delay:150ms]" />
                <span className="size-1.5 animate-bounce rounded-full bg-sereno [animation-delay:300ms]" />
              </li>
            )}
          </ol>

          {esperandoConfirmacion && (
            <footer className="border-t border-black/5 bg-white p-3">
              <button
                type="button"
                onClick={() => setConfirmado(true)}
                className="flex w-full min-h-11 items-center justify-center rounded-lg border-2 border-[#25D366] bg-white px-4 font-semibold text-[#128C7E] transition-colors duration-200 hover:bg-[#25D366] hover:text-white cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-musgo"
              >
                Sí, me quiero hacer socio
              </button>
            </footer>
          )}

          {terminado && (
            <footer className="border-t border-black/5 bg-white p-3">
              {url ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 font-semibold text-white no-underline transition-colors duration-200 hover:bg-[#1EBE5A]"
                >
                  Continuar en WhatsApp
                  <ArrowRight size={18} />
                </a>
              ) : (
                <p role="status" className="m-0 text-sm text-[#5A6661]">
                  El WhatsApp de la administración no está configurado. Pedí el alta al club
                  por el canal de siempre.
                </p>
              )}
            </footer>
          )}
        </section>
      )}

      <button
        ref={lanzadorRef}
        type="button"
        aria-label={abierto ? 'Cerrar chat de alta de socio' : 'Pedir alta de socio por WhatsApp'}
        aria-expanded={abierto}
        onClick={() => setAbierto((valor) => !valor)}
        className="grid size-14 place-items-center rounded-full bg-[#25D366] text-white shadow-[0_6px_20px_rgba(37,211,102,0.45)] transition hover:scale-105 hover:bg-[#1EBE5A] cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-musgo"
      >
        {abierto ? <X size={26} /> : <MessageCircle size={28} />}
      </button>
    </div>
  );
}
