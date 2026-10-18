# front-vistoso-quick-wins — Frontend más vistoso (quick wins)

Objetivo: dejar el front vistoso con layout, tokens y estados prolijos. Branch: feat/front-vistoso-quick-wins. Estrategia: single-pr. Test: web build + api tsc.

## Specs
- S1: "un frontend un poco más vistoso" — layout común con identidad del club en todas las páginas, sin links de volver repetidos.
- S2: "un frontend un poco más vistoso" — SEO/meta en index.html (descripción, OG, theme-color, favicon) y tokens de diseño + fuente Archivo más allá del login.
- S3: "un frontend un poco más vistoso" — skeletons + Reintentar en todos lados, región de feedback (role=status) en vez de `<p>` pelados, y sacar la tarjeta debug "Salud de la API".
- S4: "un frontend un poco más vistoso" — CompletarPerfil en español y con marca, con errores inline por campo.
- S5: "un frontend un poco más vistoso" — todo el front habla por lib/api.ts, sin UUID provisorios ni copia "API pendiente", con errores reales de la API.
- S6: "un frontend un poco más vistoso" — pills con colores por estado + barra de progreso en MisCuotas + mostrar fechaPago.
- S7: "mandale rosca con eso en una rama nueva" — trabajo en feat/front-vistoso-quick-wins, verificado con build y tsc antes de avisar.
- S8: "Haceme algo de Admin" — panel admin en /admin con turnos (filtros), pagos y reportes del backend, gated por rol, card viva en Home.
- S9: "Que directamente la primera pantalla sea el login de por sí" — hero afuera, invitados a /ingresar.
- S10: "Mira quiero que revises el navbar actual y me lo dejes bonito. Tanto en Desktop como en mobile. Volve a revisar para que quede así y borra cualquier rastro de este navbar anterior." — sticky nav de 72px a 52px, frosted, progress bar, nav de desktop y disclosure hamburger mobile; eliminar dropdown y estilos anteriores.
- S11: "no quiero que se agrande ni achique al hacer scroll ni que tenga como esa barra de carga dependiendo del scroll tampoco. Mira como queda un poco raro en mobile al tocar el menu hamburguesa." — header de alto fijo sin shrink ni progreso; panel mobile full-width en su propia fila.

## Tasks
- T0 (S7, route: inline, status: done, commit: 32e1be6): commitear fix carry-over import PrismaService en tarifas (boot API).
- T1 (S1+S2, route: delegated, status: done, commit: 9c89fb0): fundación (tokens, Layout, index.html, App, CompletarPerfil).
- T2 (S3+S6, route: delegated, status: done, commit: fbad35e): feedback y estados (skeletons, retry, pills, progreso, sin debug card).
- T3 (S5, route: delegated, status: done, commit: dd8c672): unificación api (lib/api + Turnos).
- T4 (S7, route: inline, status: done, commit: -): seam check (web build + api tsc verdes).
- T5 (S1, route: inline, status: done, commit: 87b4f9a): navbar en una fila (marca + nav flexible + acciones; apila en mobile).
- T6 (S1, route: inline, status: done, commit: dd06640): shell fluido (1400px + gutter clamp) y pills compactas en desktop, 44px en mobile.
- T7 (S8, route: inline, status: done, commit: -): panel admin (turnos con filtros, pagos, reportes) + ruta /admin + card viva en Home.
- T8 (S1, route: inline, status: done, commit: c85f18a): Mi perfil flama (avatar iniciales, pills rol/estado, chip socio).
- T9 (S1, route: inline, status: superseded-by-T18): dropdown Turnos eliminado al rehacer el navbar.
- T10 (S1, route: inline, status: revertido): hero Wimbledon revertido a pedido.
- T11 (S9, route: inline, status: done, commit: -): invitados en / van a /ingresar (redirect; Clerk es path-based) + e2e.
- T12 (S1, route: inline, status: superseded-by-T18): disclosure hamburger reimplementado con links de navegación normales y Escape.
- T13 (S1, route: inline, status: superseded-by-T18): layout mobile anterior reemplazado por una fila compacta y panel de links.
- T16 (S1, route: inline, status: superseded-by-T18): apariencia previa del navbar retirada.
- T17 (S1, route: inline, status: superseded-by-T18): shrink/progress reimplementados dentro del nuevo navbar.
- T18 (S10, route: inline, status: done, commit: 0426bf2): rehacer nav con desktop links sencillos + hamburguesa disclosure mobile; scroll-driven progress con fallback y borrar estilos/dropdown heredados. Build + e2e 8/8; capturas visuales desktop/mobile revisadas.
- T19 (S11, route: inline, status: done, commit: -): sin shrink ni barra de progreso (header fijo 64px); panel mobile abre full-width en su propia fila (fix height->min-height) verificado con screenshot.
- T14 (S1, route: inline, status: superseded-by-T18): header mobile de dos filas reemplazado por una fila con hamburger.
- T15 (S1, route: inline, status: done, commit: -): fuera botón Cerrar sesión del navbar (Clerk ya lo trae).

## Log
- L1 (2026-10-18, usuario): "Que nos está faltando para armar un frontend un poco más vistoso?"
- L2 (2026-10-18, usuario): "Dale, mandale rosca con eso en una rama nueva"
- L3: rama feat/front-vistoso-quick-wins creada desde main 3bf9707; trae fix sin commitear de tarifas (de T0).
- L4 (2026-10-18, usuario): "Haceme algo de Admin"
- L5 (2026-10-18, usuario): "Que directamente la primera pantalla sea el login de por sí"
- L6 (2026-10-18, usuario): "Mira quiero que revises el navbar actual y me lo dejes bonito. Tanto en Desktop como en mobile. Volve a revisar para que quede así y borra cualquier rastro de este navbar anterior."
- L7 (2026-10-18, usuario): "no quiero que se agrande ni achique al hacer scroll ni que tenga como esa barra de carga dependiendo del scroll tampoco. Mira como queda un poco raro en mobile al tocar el menu hamburguesa."
