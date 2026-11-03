# front-canchas — Pestaña Canchas en el panel admin — Feature document

> Branch: `feat/front-canchas`, basada en `origin/feat/front-admin-config` (e85c4cb, PR #14 de Martín, abierto).
> Convención: commits en español con jerga técnica en inglés, Conventional Commits, sin `Co-Authored-By`.
> Delivery: single-pr. El PR apunta a `feat/front-admin-config` mientras el #14 siga abierto; si Martín mergea antes, se rebasa sobre `main`.

## Objective

Agregar la pestaña **Canchas** dentro de `/admin` (`apps/web/src/pages/Admin.tsx`) cableada contra los endpoints
de canchas ya mergeados en la API: `GET /canchas?conEstados=true`, `POST /canchas`, `PATCH /canchas/:id`,
`PATCH /canchas/:id/estado`.

## Problem / Why

El backend del ABM de canchas existe desde ACT-28/ACT-29 (mergeado en `a35ee15`) y el front no tiene ninguna
pantalla que lo consuma: no hay página, ni tipos, ni métodos en `lib/api.ts`. Hoy cambiar una cancha de estado
(ex. `en_mantenimiento` con motivo) requiere tocar la base o Swagger. RF-17 queda sin interfaz.

## Scope autorizado

- `apps/web/src/lib/api.ts` — tipos y métodos de canchas.
- `apps/web/src/pages/Admin.tsx` — tab, estado, loader y panel.
- `apps/web/src/components/Feedback.tsx` — tonos de `StatusPill` para los estados de cancha.
- `odd/tasks/front-canchas.md` — este documento.
- Fuera de alcance: backend (`apps/api`), `docs/API-CONTRATO.md`, `Layout.tsx`, `App.tsx`, ruteo y cualquier
  otra pestaña del admin.

## Constraints / decisiones

- **Alcance limitado a las 3 canchas del club**: el club tiene exactamente 3 canchas, así que la pantalla **no
  ofrece alta** (sin botón "Nueva cancha" ni formulario de creación). Solo lista, edita `superficie`/`iluminación`
  y cambia el estado. El `POST /canchas` sigue existiendo en el backend pero queda fuera del alcance de esta pantalla.
- **Base = rama de Martín (PR #14)**: el panel admin que vamos a extender es el suyo (Tailwind + tabs inline).
  Por eso todo se agrega **dentro de `Admin.tsx`**, sin crear archivos nuevos ni componentes separados: el diff
  queda chico y rebasear cuando él empuje cambios es barato.
- **Patrón de tabs**: `Tab` es una unión de strings (Admin.tsx:24) y `TABS` (26–32) una lista `{id,label}`. La pestaña
  `canchas` se inserta **después de `turnos`**. Los paneles son bloques `{tab === 'x' && (<section …>)}`, no componentes.
- **Gotcha del loader**: `cargar()` (433–472) tiene un `else` final que carga reportes. Hay que insertar la rama de
  canchas **antes** de ese `else`, o la pestaña nueva dispara `estadisticas`/`financiero`.
- **Datos**: siempre `conEstados=true` (la pantalla es solo admin; `RequireAdmin` ya cubre `/admin`). Se muestra el
  estado vigente con `StatusPill` y, como detalle, la última entrada de `estados` (`valorState`, `fechaCambio`, `motivo`).
- **Contrato (fuente de verdad)**:
  - `Cancha = { id, nroCancha, superficie, iluminacion, estadoActual, estados?: [{ valorState, fechaCambio, motivo }] }`
    (`apps/api/src/canchas/cancha-response.ts`). Ojo: el campo es **`valorState`**, no `estado`.
  - `superficie`: `dura | polvo_de_ladrillo | cesped`. `estadoActual`: `disponible | en_mantenimiento | inhabilitada`.
  - POST body `{ nroCancha, superficie, iluminacion? }` (iluminación default `true` en el backend).
  - PATCH `:id` body parcial, al menos un campo; 400 si viene vacío; 404; 409 si `nroCancha` se repite.
  - PATCH `:id/estado` body `{ estado, motivo? }`; `motivo` **obligatorio si `estado !== 'disponible'`** (el servicio
    trimea y rechaza con 400), máx. 500; **422 si el estado es igual al actual**.
- **Validación en cliente**: `nroCancha` entero ≥ 1; superficie y estado desde `<select>`; `motivo` requerido y no
  vacío cuando el estado no es `disponible`. Nunca bloquear por validaciones que el backend no exige.
- **Feedback**: reusar `Skeleton` / `ErrorCard onRetry` / `EmptyState` con el patrón de las otras pestañas. Sin toasts:
  el éxito se refleja actualizando el estado local con la respuesta del endpoint; solo los errores renderizan alerta.
- **Errores**: mostrar el `message` de `ApiError`; para 409 y 422 usar textos claros ("Ya existe una cancha con ese
  número", "La cancha ya está en ese estado").
- **Estado de guardado separado** (`guardandoCancha`) para no bloquear los botones de las otras pestañas.
- **Responsive**: tabla en `md+` y tarjetas apiladas en mobile, siguiendo el patrón de la pestaña Usuarios. Controles
  con `min-h-[44px]`, foco visible y `aria-*` como el resto del panel.
- **StatusPill**: agregar `disponible` (verde), `en_mantenimiento` (ámbar) e `inhabilitada` (rojo) al mapa de tonos.
  Es aditivo: no cambia los tonos existentes de turnos/cuotas.
- **Tests**: `apps/web` no tiene runner de tests (solo `build` = `tsc && vite build`). Excepción documentada a TDD:
  la verificación es typecheck + build + prueba manual con la API levantada. El backend ya tiene sus specs.

## Tasks

| ID | Tarea | Ruta | Trigger |
|---|---|---|---|
| T1 | Feature doc + mirror en Engram | inline | mecánico |
| T2 | `lib/api.ts`: tipos `Cancha`/`EstadoCancha`/`SuperficieCancha` + 4 métodos | delegate writer | 2+ archivos no triviales |
| T3 | `Feedback.tsx`: tonos de estado de cancha | delegate writer | mismo writer |
| T4 | `Admin.tsx`: tab, rama de loader, estados y panel (alta, edición, cambio de estado, historial) | delegate writer | mismo writer |
| T5 | Verificación: `npm run build --workspace=web` + revisión de diff | delegate writer | verificación |

## Acceptance criteria

- La pestaña Canchas aparece después de Turnos y no rompe las otras cinco.
- Lista las canchas ordenadas por número con superficie, iluminación y estado vigente.
- Permite crear una cancha (nro ≥ 1 único, superficie, iluminación) y editarla.
- Permite cambiar el estado; exige motivo salvo `disponible`; muestra el error del 422 al reintentar el mismo estado.
- `tsc` y `vite build` pasan sin errores ni warnings nuevos.
- El diff toca solo los tres archivos de `apps/web` listados + este documento.
