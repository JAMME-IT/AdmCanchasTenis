# admin-config-front — Pantalla de Configuración en el panel admin

## Objetivo
Cablear el front (pestaña Configuración de /admin) contra los endpoints /config que la API ya tiene mergeados (ACT-30/31/32, hechos por Agustín): días de funcionamiento y rangos horarios. Sin tocar nada del backend ni del trabajo asignado a los chicos.

Branch: feat/front-admin-config (desde main 9c79716). Estrategia: single-pr. Test: web build + api tsc.

## Specs
- S1 (usuario): "metele con esa pantalla y armemosla" — pestaña Configuración en /admin consumiendo los endpoints /config ya implementados.
- S2 (usuario): "revisa a fondo el Jira y fijate si falta alguna otra sección o subsección respecto a las tareas ya realizadas o que faltan realizar por alguno de los chicos" — informe de huecos front vs API vs Jira, entregado al cierre.
- S3 (usuario, corrección): "No quiero que toques NADA del backend ni nada de lo que tienen los chicos ya asignado, quiero que cableemos y diagramemos el frontend para lo que ya hay hecho" — solo apps/web; ningún cambio en apps/api ni docs/API-CONTRATO.md.
- S4: la pestaña Configuración respeta los patrones existentes de Admin.tsx (tabs, Feedback skeleton/error/empty, tokens) y el guard RequireAdmin ya cubre /admin.
- S5: PUT /config/dias-funcionamiento guarda los 7 días con su estado; PUT /config/rangos-horario reemplaza la lista de franjas (nombre + horaInicio + horaFin, con validación horaFin > horaInicio y nombre no vacío en el cliente).
- S6 (límite del backend existente): no existe GET /config/tipos-turno, así que la duración por tipo de turno NO se cablea en esta pantalla; queda señalada en la UI como pendiente del backend (dueño Agustín, ACT-32).
- S7 (usuario): "armame la sección para los usuarios. Con UI fachera y manteniendo los lineamientos que venimos usando" — pestaña Usuarios en /admin contra la API lista (ACT-22..26): listado con búsqueda y filtros, edición admin, cambio de rol con alta de socio, baja lógica.
- S8: mismos lineamientos: Tailwind con colores del club (@theme), 44px en controles, skeletons/ErrorCard/EmptyState de Feedback, validación cliente, estados de guardado por acción.

## Tasks
- T1 (S1/S4/S5, route: inline, status: done, commit: e8bf0f7): lib/api.ts — tipos DiaFuncionamiento/RangoHorario + métodos diasFuncionamiento, guardarDiasFuncionamiento, rangosHorario, guardarRangosHorario.
- T2 (S1/S4/S5, route: inline, status: done, commit: e8bf0f7): pestaña Configuración en Admin.tsx (días + rangos, con nota de duración pendiente), portada a Tailwind en el estilo de Edgardo.
- T3 (S7-pattern, route: inline, status: done, commit: e8bf0f7): verificación (web tsc + vite build OK, api tsc OK, spec config intacto tras el revert) y commit.
- T5 (S7/S8, route: inline, status: pending): lib/api.ts — métodos usuarios, editarUsuario, cambiarRolUsuario, darDeBajaUsuario.
- T6 (S7/S8, route: inline, status: pending): pestaña Usuarios en Admin.tsx (filtros, cards, edición inline, cambio rol, baja con confirmación).
- T7 (S8, route: inline, status: pending): verificación (web tsc + vite build) y commit.
- T4 (S2, route: inline, status: done): informe de huecos Jira/front/API entregado en chat (2026-10-27) + Jira actualizado: ACT-31, ACT-32, ACT-4 y ACT-5 a Listo (transition 41).

## Log
- L1 (2026-10-27, usuario): "Dale, metele con esa pantalla y armemosla, revisa a fondo el Jira y fijate si falta alguna otra sección o subsección respecto a las tareas ya realizadas o que faltan realizar por alguno de los chicos"
- L2 (2026-10-27, usuario): "para para, que estas haciendo? No quiero que toques NADA del backend ni nada de lo que tienen los chicos ya asignado, quiero que cableemos y diagramemos el frontend para lo que ya hay hecho porfa. Si hiciste cambios del backend o algo de eso volve para atrás y continuemos" — revertido el commit 0d560be (GET /config/tipos-turno en API + contrato) con reset --hard a main 9c79716; el front no había llegado a escribirse. Alcance restringido a apps/web; S3/S6 agregadas.
- L3 (2026-10-27, usuario): "nono, vamos a full con lo que hizo Edgar. Incorporemos TODO lo que el haya hecho y lo que los pibes hayan hecho que sume" — mergeado feat/tailwind-migration (34 commits de Edgardo, incluye d7b09f9 del hero; fue ff porque él ya había integrado main 9c79716). main ahora en 6998b26. Rama reseteada a ese main y la pestaña Configuración re-escrita con clases Tailwind (tokens.ts ya no existe; colores del club en @theme de styles/index.css). Build falló primero por deps de Tailwind faltantes; resuelto con npm install. Commit final e8bf0f7.
- L4 (2026-10-27, usuario): "Bienn, ahora si veo los cambios de Edgar" + "armame la sección para los usuarios. Con UI fachera y manteniendo los lineamientos que venimos usando" — arranca T5-T7: pestaña Usuarios contra GET/PATCH /usuarios (ACT-22..26). Enums confirmados: estado_usuario = activo|moroso|suspendido|inactivo; rol_nombre = admin|socio|no_socio.
