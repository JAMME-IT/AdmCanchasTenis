// Acceso directo al WhatsApp de la administradora para pedir el alta como
// socio (RF-8). El numero se configura por entorno para no hardcodear un
// dato personal en el repo. Formato esperado: internacional, solo digitos.
export interface UsuarioWhatsApp {
  nombre: string;
  apellido: string;
  username: string;
}

export function normalizarWhatsApp(valor: string | undefined): string {
  return (valor ?? '').replace(/\D/g, '');
}

export function urlAltaSocio(
  telefono: string | undefined,
  usuario: UsuarioWhatsApp,
): string | null {
  const numero = normalizarWhatsApp(telefono);
  if (numero.length < 8) {
    return null;
  }
  const mensaje =
    'Hola, quiero solicitar el alta como socio del Tenis Ranch Club. ' +
    `Soy ${usuario.nombre} ${usuario.apellido} (usuario: @${usuario.username}).`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
}
