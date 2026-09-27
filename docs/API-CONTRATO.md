# API-CONTRATO — Contrato de la API (v1)

> Fuentes: `docs/CONTEXTO.md` (§5 roles, §6 RF, §8 RN, §9 CU), `docs/DOMINIO.md`, `docs/DB-SCHEMA.md`.
> Este documento es la fuente de verdad del contrato HTTP de la API NestJS (`apps/api`).
> Las decisiones estructurales se registran en `docs/adr/`.

## 1. Overview

- Arquitectura: REST sobre HTTP con JSON.
- Base path: `/api`. Todos los paths de este documento son relativos a esa base (por ejemplo, `POST /api/turnos`).
- Autenticación: session token de Clerk enviado como Bearer (ver §2). Header requerido: `Authorization: Bearer <token>`.
- Acceso a datos: solo la API accede a PostgreSQL; el frontend nunca toca la base (DB-SCHEMA §9).
- Sin versionado en URL en v1: los cambios incompatibles se documentan en este contrato.

Convenciones de representación:

| Concepto | Formato | Ejemplo |
|---|---|---|
| Campos JSON | camelCase en español, derivado de columnas snake_case (`cantidad_no_socios` → `cantidadNoSocios`) | `horaInicio`, `numeroSocio` |
| Fechas | `YYYY-MM-DD`, hora local del club, sin zona | `2026-09-30` |
| Horas | `HH:MM` 24 h, hora local del club | `19:00` |
| Timestamps | ISO 8601 con offset | `2026-09-25T14:30:00-03:00` |
| Dinero | number JSON, dos decimales, sin símbolo de moneda | `4000.00` |
| IDs | string UUID | `"8f14e45f-ea2b-4c3d-9a1b-2c3d4e5f6a7b"` |
| Booleanos | `true` / `false` | `requiereLuz: true` |
| Enums | snake_case tal como en la base (`estado_turno`, `estado_pago`, `estado_cuota`, `estado_usuario`, `estado_cancha`, `superficie_cancha`) | `parcial`, `no_asistio`, `polvo_de_ladrillo` |
| Listados | array JSON completo; sin paginación en v1 (ver §7) | `[ { ... } ]` |

Los montos los calcula siempre el servidor: el cliente nunca envía importes en operaciones de reserva.

## 2. Autenticación y roles

### 2.1 Session token

- El registro y el login se hacen contra **Clerk** desde el frontend; la API no emite tokens (ADR-0008).
- La API recibe el **session token** de Clerk como Bearer y lo valida con `@clerk/backend` (`verifyToken` con `CLERK_JWT_KEY` y `authorizedParties`), sin llamadas de red por request.
- `sub` = `usuarios.clerk_user_id`; el rol de negocio **no** viaja en el token: los guards lo releen de `usuarios_roles` (§2.2).
- `sid` = sesión de Clerk, usado por `POST /auth/logout` para revocarla.

Claims relevantes:

```json
{
  "sub": "user_2RfWKJREkjKbHZy0Wqa5qrHeAnb",
  "sid": "sess_2Ro7e2IxrffdqBboq8KfB6eGbIy",
  "azp": "http://localhost:5173",
  "iat": 1758825600,
  "exp": 1758854400
}
```

### 2.2 Roles del sistema

| Valor (`rol`) | Etiqueta de negocio | Origen |
|---|---|---|
| `admin` | Administrador | `roles.nombre` + `usuarios_roles` vigente |
| `socio` | Socio | idem; además tiene fila en `socios` |
| `no_socio` | No socio | idem; sin fila en `socios` |

- Rol por defecto al registrarse: `no_socio` (supuesto explícito, ver §7). El alta como socio se pide por WhatsApp (RF-8, comportamiento de frontend) y la asigna el administrador con `PATCH /usuarios/:id/rol`.
- Estados del usuario (`usuarios.estado_actual`): `activo`, `moroso`, `suspendido`, `inactivo`. Login y uso general habilitados para `activo` y `moroso` (RN-9 limita la reserva del moroso); `suspendido` e `inactivo` reciben 403.
- Los guards de rol releen el rol vigente de `usuarios_roles` en cada request, por lo que un cambio de rol impacta de inmediato aunque la sesión siga vigente.

## 3. Formato de errores

Formato NestJS estándar:

```json
{
  "statusCode": 409,
  "message": "El horario ya no esta disponible",
  "error": "Conflict"
}
```

| HTTP | `error` | Cuándo se usa |
|---|---|---|
| 400 | `Bad Request` | DTO inválido: campos faltantes, formato, enums fuera de rango, query inválida. |
| 401 | `Unauthorized` | Token ausente, malformado o expirado (login y registro ocurren en Clerk, ADR-0008). |
| 403 | `Forbidden` | Rol insuficiente; usuario `suspendido` o `inactivo`; operar un recurso ajeno. |
| 404 | `Not Found` | Recurso inexistente (usuario, turno, cuota, cancha, pago). |
| 409 | `Conflict` | Choque de unicidad: slot ocupado, `username`/`email`/`dni` duplicado, cuota mensual duplicada, pago de luz duplicado. |
| 422 | `Unprocessable Entity` | Regla de negocio violada con request sintácticamente válido: RN-1, RN-2, RN-9, RN-11, pago mayor al saldo, transición de estado inválida. |
| 500 | `Internal Server Error` | Error no controlado. |

`message` puede ser string o array de strings (validación). El frontend centraliza el copy final que ve el usuario.

## 4. Matriz de acceso por rol

`Si` = permitido; `—` = denegado (403).

| Grupo de endpoints | Público | Admin | Socio | No socio |
|---|---|---|---|---|
| `POST /usuarios/completar-perfil` | — | Si | Si | Si |
| `POST /auth/logout`, `GET /auth/me` | — | Si | Si | Si |
| `GET /usuarios`, `GET /usuarios/:id` | — | Si | — | — |
| `PATCH /usuarios/:id`, `PATCH /usuarios/:id/rol`, `DELETE /usuarios/:id` | — | Si | — | — |
| `PATCH /usuarios/me` | — | Si | Si | Si |
| `POST /turnos`, `GET /turnos/disponibilidad`, `GET /turnos/mios`, `GET /turnos/mios/historial`, `POST /turnos/:id/cancelar` | — | Si | Si | Si |
| `GET /turnos`, `PATCH /turnos/:id/estado`, `PATCH /turnos/:id/pago` | — | Si | — | — |
| `POST /pagos-turno`, `GET /pagos-turno` | — | Si | — | — |
| `GET /canchas` | — | Si | Si | Si |
| `PATCH /canchas/:id/estado` | — | Si | — | — |
| `GET /config/rangos-horario`, `GET /config/dias-funcionamiento` | — | Si | Si | Si |
| `PUT /config/rangos-horario`, `PUT /config/dias-funcionamiento` | — | Si | — | — |
| `GET /cuotas`, `POST /cuotas/:id/pagos` | — | Si | — | — |
| `GET /cuotas/mias` | — | — | Si | — |
| `GET /tarifas` | — | Si | Si | Si |
| `PUT /tarifas/*`, `GET /tarifas/historial` | — | Si | — | — |
| `POST /pagos-luz`, `GET /pagos-luz` | — | Si | — | — |
| `GET /reportes/*` | — | Si | — | — |

Notas:

- El registro y el login no son endpoints de esta API: se realizan contra Clerk desde el frontend (ADR-0008); el alta de dominio se completa con `POST /usuarios/completar-perfil`.
- El admin también puede reservar turnos y no tiene tope diario (RN-10).
- `GET /cuotas/mias` es exclusivo de `socio`; un `no_socio` recibe 403 porque no tiene cuota (el alta se pide por WhatsApp, RF-8).

## 5. Endpoints

### 5.0 Modelos de respuesta compartidos

Los endpoints referencian estos modelos para no repetir el detalle.

**Usuario**

```json
{
  "id": "8f14e45f-ea2b-4c3d-9a1b-2c3d4e5f6a7b",
  "username": "jperez",
  "email": "jperez@example.com",
  "nombre": "Juan",
  "apellido": "Perez",
  "telefono": "3454123456",
  "dni": "30123456",
  "estadoActual": "activo",
  "rol": "socio",
  "numeroSocio": "S-0001",
  "createdAt": "2026-09-25T14:30:00-03:00",
  "updatedAt": "2026-09-25T14:30:00-03:00"
}
```

`clerk_user_id` no se expone. `rol` surge de `usuarios_roles` vigente; `numeroSocio` es `null` si el usuario no tiene fila en `socios`.

**Turno**

```json
{
  "id": "5c2a9d10-1111-2222-3333-444455556666",
  "usuarioId": "8f14e45f-ea2b-4c3d-9a1b-2c3d4e5f6a7b",
  "canchaId": "0a1b2c3d-4444-5555-6666-777788889999",
  "tipoTurnoId": "9f8e7d6c-aaaa-bbbb-cccc-ddddeeeeffff",
  "valorTurnoId": "12345678-90ab-cdef-1234-567890abcdef",
  "fecha": "2026-09-30",
  "horaInicio": "19:00",
  "horaFin": "20:00",
  "cantidadPersonas": 4,
  "cantidadNoSocios": 2,
  "costoTurnoNs": 8000.00,
  "requiereLuz": true,
  "estadoActual": "confirmado",
  "estadoPago": "impago",
  "createdAt": "2026-09-25T14:30:00-03:00",
  "updatedAt": "2026-09-25T14:30:00-03:00"
}
```

En listados del admin se agrega `usuario: { id, nombre, apellido, numeroSocio }` y `cancha: { id, nroCancha }`.

**Cuota**

```json
{
  "id": "aabbccdd-1111-2222-3333-444455556666",
  "socioId": "ddeeff00-7777-8888-9999-aaaabbbbcccc",
  "fechaInicio": "2026-09-01",
  "fechaVencimiento": "2026-09-10",
  "montoTotal": 15000.00,
  "estadoActual": "parcial",
  "totalPagado": 10000.00,
  "saldo": 5000.00,
  "createdAt": "2026-09-01T00:05:00-03:00",
  "updatedAt": "2026-09-15T10:00:00-03:00"
}
```

`totalPagado` y `saldo` se calculan desde `lineas_cuota` con estado `registrada`. En listados del admin se agrega `socio: { id, numeroSocio, fechaAlta, nombre, apellido }`.

**Cancha**

```json
{
  "id": "0a1b2c3d-4444-5555-6666-777788889999",
  "nroCancha": 1,
  "superficie": "polvo_de_ladrillo",
  "iluminacion": true,
  "estadoActual": "disponible"
}
```

**PagoTurno**

```json
{
  "id": "99887766-5544-3322-1100-aabbccddeeff",
  "turnoId": "5c2a9d10-1111-2222-3333-444455556666",
  "montoTotalTurno": 8000.00,
  "fechaPago": "2026-09-30T20:15:00-03:00",
  "createdAt": "2026-09-30T20:15:00-03:00",
  "lineas": [
    { "id": "11223344-5566-7788-99aa-bbccddeeff00", "montoTurnoPago": 8000.00 }
  ]
}
```

**PagoLuz**

```json
{
  "id": "55667788-99aa-bbcc-ddee-ff0011223344",
  "turnoId": "5c2a9d10-1111-2222-3333-444455556666",
  "montoTotalLuz": 4000.00,
  "fechaPago": "2026-09-30T22:10:00-03:00",
  "createdAt": "2026-09-30T22:10:00-03:00"
}
```

`id` mapea a `pagos_luz.id_pago_luz`.

### 5.1 Auth

> El registro y el login se realizan contra **Clerk** desde el frontend (ADR-0008); la API no expone endpoints de credenciales. El alta del usuario de dominio se completa con `POST /usuarios/completar-perfil` (§5.2).

#### POST /auth/logout

- **Roles**: autenticados.
- **RF**: RF-46.
- **Descripción**: revoca la sesión de Clerk indicada por el claim `sid` del token (Backend API) y el cliente limpia su sesión.
- **Request**: sin body.
- **Response 200**: `{ "message": "Sesion cerrada" }`.
- **Errores**: 401.

#### GET /auth/me

- **Roles**: autenticados.
- **RF**: soporte de RF-6 y RF-26.
- **Descripción**: perfil del usuario autenticado con rol vigente y número de socio si corresponde.
- **Response 200**: `Usuario`.
- **Errores**: 401.

### 5.2 Usuarios

#### POST /usuarios/completar-perfil

- **Roles**: autenticados sin fila en `usuarios` (alta posterior al sign-up de Clerk).
- **RF**: RF-1.
- **Descripción**: crea `usuarios` con `clerk_user_id` (del token verificado), la fila inicial en `estados_usuario` (`activo`) y la asignación vigente en `usuarios_roles` con rol `no_socio`, en una transacción. El email se toma del usuario de Clerk (Backend API); la API no recibe passwords.
- **Request**:

| Campo | Tipo | Oblig. | Validación |
|---|---|---|---|
| `username` | string | Si | 3–50; único (`uq_usuarios_username`); minúsculas; sin espacios. |
| `nombre` | string | Si | 1–100. |
| `apellido` | string | Si | 1–100. |
| `telefono` | string | No | ≤30. |
| `dni` | string | Si | ≤15; único. |

- **Response 201**: `Usuario`.
- **Errores**: 400 (formato), 401 (sin token), 409 (`username`, `email` o `dni` duplicado). Si el usuario autenticado ya tiene fila, responde 200 con el Usuario existente (idempotente).

#### GET /usuarios

- **Roles**: admin.
- **RF**: RF-4 (listado), RF-9 (búsqueda), RF-10 (filtro por estado), RF-11 (filtro por rol).
- **Descripción**: listado de usuarios con rol y estado vigentes.
- **Query**:
  - `busqueda` (string, opcional): `ILIKE` sobre `apellido` y `nombre`.
  - `estado` (enum `estado_usuario`, opcional): `activo|moroso|suspendido|inactivo`.
  - `rol` (`admin|socio|no_socio`, opcional): filtra por `usuarios_roles` vigente.
- **Response 200**: array de `Usuario`.
- **Errores**: 400 (enum inválido), 401, 403.

#### GET /usuarios/:id

- **Roles**: admin.
- **RF**: RF-4 (detalle).
- **Descripción**: detalle de un usuario.
- **Response 200**: `Usuario`.
- **Errores**: 401, 403, 404.

#### PATCH /usuarios/:id

- **Roles**: admin.
- **RF**: RF-5; RN-4 (solo el admin cambia el estado).
- **Descripción**: edición administrativa de datos y del estado del usuario. Si cambia `estadoActual`, inserta la fila en `estados_usuario` y actualiza el caché en la misma transacción. El `email` no se edita por API: su fuente es Clerk y se sincroniza con `usuarios.email` por el webhook `user.updated` (ADR-0008).
- **Request** (al menos un campo):

| Campo | Tipo | Validación |
|---|---|---|
| `nombre` | string | 1–100. |
| `apellido` | string | 1–100. |
| `telefono` | string | ≤30. |
| `dni` | string | ≤15; único. |
| `estadoActual` | enum `estado_usuario` | `activo|moroso|suspendido|inactivo`. |

- **Response 200**: `Usuario`.
- **Errores**: 400, 401, 403, 404, 409 (`dni` duplicado).

#### PATCH /usuarios/:id/rol

- **Roles**: admin.
- **RF**: RF-3; RN-5 (solo el admin gestiona roles).
- **Descripción**: cambia el rol vigente: cierra la fila vigente de `usuarios_roles` (`fechaFin = now`) e inserta una nueva (`fechaInicio = now`) en una transacción. Si el nuevo rol es `socio` y el usuario no tiene fila en `socios`, la crea.
- **Request**:

| Campo | Tipo | Oblig. | Validación |
|---|---|---|---|
| `rol` | enum `rol_nombre` | Si | `admin|socio|no_socio`; distinto del vigente. |
| `numeroSocio` | string | No | ≤20; único. Si se omite y el rol es `socio`, la API genera el correlativo siguiente (`S-0001`, `S-0002`, ...). |

- **Response 200**: `Usuario`.
- **Errores**: 400, 401, 403, 404, 409 (`numeroSocio` duplicado), 422 (mismo rol vigente).

#### DELETE /usuarios/:id

- **Roles**: admin.
- **RF**: RF-7.
- **Descripción**: baja lógica: `usuarios.estado_actual = 'inactivo'` + fila en `estados_usuario`. No se borra ninguna fila (las FKs son `on delete restrict`). El usuario queda `inactivo`: la API responde 403 a cualquier uso; Clerk todavía puede autenticarlo, pero los guards rechazan por estado (§2.2).
- **Response 200**: `{ "id": "...", "estadoActual": "inactivo" }`.
- **Errores**: 401, 403, 404.

#### PATCH /usuarios/me

- **Roles**: autenticados.
- **RF**: RF-6.
- **Descripción**: edición de datos propios. No permite cambiar `email`, `dni`, `estadoActual` ni rol; el email y la contraseña se gestionan en el perfil de Clerk (el email se sincroniza con `usuarios.email` por el webhook `user.updated`, ADR-0008).
- **Request** (al menos un campo): `nombre`, `apellido`, `telefono`, `username` (único).
- **Response 200**: `Usuario`.
- **Errores**: 400, 401, 409 (`username` duplicado).

### 5.3 Turnos

#### POST /turnos

- **Roles**: autenticados (admin, socio, no socio). RN-6: solo usuarios registrados.
- **RF**: RF-12 (reservar), RF-13 (informar luz y costo adicional), RF-39 (confirmar con/sin luz).
- **Descripción**: reserva un turno y congela la tarifa aplicada (`valorTurnoId`). El servidor calcula `horaFin` y `costoTurnoNs`; el cliente no envía importes.
- **Request**:

| Campo | Tipo | Oblig. | Validación |
|---|---|---|---|
| `canchaId` | UUID | Si | Cancha existente y `estadoActual = disponible`. |
| `fecha` | `YYYY-MM-DD` | Si | Día habilitado en `dias_funcionamiento`; RN-11: máximo 1 día de anticipación (`fecha <= hoy + 1`). |
| `horaInicio` | `HH:MM` | Si | Dentro de la franja de apertura (`rangos_horario`). |
| `tipoTurnoId` | UUID | Si | `tipos_turno` existente (60/90). Define `horaFin = horaInicio + duracionMax`. |
| `cantidadPersonas` | int | Si | ≥1. |
| `cantidadNoSocios` | int | Si | ≥0 y ≤ `cantidadPersonas` (`ck_turnos_no_socios`). |
| `requiereLuz` | boolean | Si | Si es `true`, la cancha debe tener `iluminacion = true`. |

- **Validaciones de negocio** (en el servicio, dentro de la transacción):
  - Solapamiento: no puede existir otro turno no cancelado en la misma cancha y fecha cuyo rango `[horaInicio, horaFin)` se superponga (cubre 60 vs 90 min). Además existe `uq_turnos_cancha_fecha_hora` para inicios idénticos.
  - RN-2: máximo 2 turnos por día por usuario (no cancelados). Admin exento (RN-10).
  - RN-9: si el socio tiene 2 o más cuotas `adeudada`, solo puede registrar 1 turno más hasta regularizar.
  - `costoTurnoNs = cantidadNoSocios × tarifa vigente.costoXHora × (duracionMax / 60)`, con la tarifa vigente de `valores_turno` (`fecha_cambio <= now()` más reciente).
- **Response 201**: `Turno` más dos campos calculados:
  - `cargoLuzCompartido`: monto de `luz.costoXHora` (o tarifa de luz vigente) si `requiereLuz`, o `null`.
  - `avisos`: array de strings con el recordatorio de pago de no socios y el aviso de cargo de luz compartido (RF-13, CU04).
- **Errores**: 400, 401, 403, 404 (cancha o tipo de turno inexistente), 409 (slot ocupado), 422 (RN-2, RN-9, RN-11; cancha no disponible; día no habilitado; fuera de franja; luz pedida sin iluminación).

#### GET /turnos/disponibilidad

- **Roles**: autenticados.
- **RF**: soporte de RF-12 (CU04: elegir cancha, día y horario disponibles).
- **Descripción**: devuelve los slots del día por cancha, con el estado de disponibilidad ya resuelto.
- **Query**:
  - `fecha` (`YYYY-MM-DD`, obligatorio).
  - `canchaId` (UUID, opcional; si se omite, todas las canchas).
  - `tipoTurnoId` (UUID, opcional; si se omite, la API propone 60 min de lunes a viernes y 90 min sábados, domingos y feriados — ver §7 sobre feriados).
- **Response 200**:

```json
{
  "fecha": "2026-09-30",
  "duracionMinutos": 60,
  "slots": [
    {
      "canchaId": "0a1b2c3d-4444-5555-6666-777788889999",
      "nroCancha": 1,
      "horaInicio": "19:00",
      "horaFin": "20:00",
      "disponible": false,
      "requiereLuz": true,
      "motivo": "Turno confirmado"
    }
  ]
}
```

- `requiereLuz` se calcula por intersección del slot con la franja de iluminación configurada en `luz`.
- **Errores**: 400, 401.

#### GET /turnos/mios

- **Roles**: autenticados.
- **RF**: RF-36 (ver turnos vigentes propios), CU24.
- **Descripción**: turnos vigentes del usuario autenticado (`confirmado` o `iniciado`), ordenados por fecha y hora.
- **Query**: `fecha` (`YYYY-MM-DD`, opcional), `estadoActual` (`confirmado|iniciado`, opcional).
- **Response 200**: array de `Turno` con la expansión `cancha: { id, nroCancha }` y `puedeCancelar` (boolean calculado: `now <= fecha+horaInicio - 1h`, RN-1).
- **Errores**: 400, 401.

#### GET /turnos/mios/historial

- **Roles**: autenticados.
- **RF**: RF-18 (el socio ve su historial), CU5.
- **Descripción**: historial cronológico descendente de turnos del usuario. Por defecto `estadoActual = finalizado`; permite consultar `no_asistio` y `cancelado`.
- **Query**: `desde` (`YYYY-MM-DD`, opcional), `hasta` (opcional), `estadoActual` (`finalizado|no_asistio|cancelado`, opcional).
- **Response 200**: array de `Turno` con expansión `cancha`.
- **Errores**: 400, 401.

#### POST /turnos/:id/cancelar

- **Roles**: autenticados. El dueño del turno o el admin (CU22: cancelación desde el panel).
- **RF**: RF-14 y RF-40 (cancelar hasta 1 hora antes); RN-1.
- **Descripción**: cancela un turno confirmado e inserta la transición en `estados_turno` con `motivo`, en la misma transacción que actualiza el caché.
- **Request**: `{ "motivo": "Lesion" }` (`motivo` requerido, 1–500).
- **Response 200**: `Turno` con `estadoActual = cancelado`.
- **Errores**: 400, 401, 403 (turno de otro usuario), 404, 409 (el turno ya no está en un estado cancelable), 422 (RN-1: falta menos de 1 hora para el inicio).

#### GET /turnos

- **Roles**: admin.
- **RF**: RF-37 (búsqueda por nombre/apellido), RF-38 (filtro de vigentes por fecha), CU22.
- **Descripción**: listado general de turnos con datos del usuario y la cancha.
- **Query**:
  - `busqueda` (string, opcional): `ILIKE` sobre `usuarios.apellido` y `usuarios.nombre`.
  - `fecha` (`YYYY-MM-DD`, opcional): filtra un día exacto.
  - `desde`, `hasta` (`YYYY-MM-DD`, opcionales): rango de fechas.
  - `estadoActual`, `estadoPago` (opcionales).
  - `canchaId` (UUID, opcional).
  - `incluirCancelados` (boolean, opcional, por defecto `false`).
- **Response 200**: array de `Turno` con las expansiones `usuario` y `cancha`.
- **Errores**: 400, 401, 403.

#### PATCH /turnos/:id/estado

- **Roles**: admin.
- **RF**: ciclo de vida del turno (CU22; `estado_turno` de DB-SCHEMA §4). No crea requerimientos nuevos: opera las transiciones del modelo.
- **Descripción**: aplica una transición del ciclo de vida e inserta la fila en `estados_turno` con el snapshot combinado `(valorEstado, valorEstadoPago)` en la misma transacción.
- **Request**: `{ "estado": "iniciado", "motivo": null }`.

| Estado actual | Estados destino permitidos |
|---|---|
| `confirmado` | `iniciado`, `no_asistio` |
| `iniciado` | `finalizado` |
| `finalizado`, `no_asistio`, `cancelado` | ninguno (terminales) |

- `cancelado` solo se alcanza por `POST /turnos/:id/cancelar` (así conserva RN-1 y el motivo).
- **Response 200**: `Turno`.
- **Errores**: 400 (enum inválido), 401, 403, 404, 422 (transición no permitida).

#### PATCH /turnos/:id/pago

- **Roles**: admin.
- **RF**: soporte de RF-19/RF-42 (el alta real del pago es `POST /pagos-turno`).
- **Descripción**: corrige manualmente el estado de pago (`turnos.estado_pago`) e inserta la transición en `estados_turno`. En el flujo normal, `POST /pagos-turno` ya deja `estadoPago = pago` en la misma transacción.
- **Request**: `{ "estadoPago": "pago" }` (`impago|pago`).
- **Response 200**: `Turno`.
- **Errores**: 400, 401, 403, 404, 422 (estado igual al actual).

### 5.4 Pagos de turno

#### POST /pagos-turno

- **Roles**: admin.
- **RF**: RF-19 (registrar pago de turno de no socio), RF-42 (registro manual desde el panel).
- **Descripción**: registra el pago ya verificado por el admin (los comprobantes llegan por WhatsApp, DB-SCHEMA §5). Inserta `pagos_turno` (+ `lineas_pago_turno`), marca `turnos.estado_pago = pago` e inserta la transición en `estados_turno`, todo en una transacción.
- **Request**:

| Campo | Tipo | Oblig. | Validación |
|---|---|---|---|
| `turnoId` | UUID | Si | Turno existente y no cancelado. |
| `montoTotalTurno` | number | Si | > 0. |
| `fechaPago` | timestamp | No | Default `now()`; no futura. |
| `lineas` | array | No | `[{ "montoTurnoPago": number > 0 }]`; si viene, la suma debe igualar `montoTotalTurno`. |

- **Response 201**: `PagoTurno`.
- **Errores**: 400, 401, 403, 404, 409 (ya existe un pago registrado para el turno — ver §7), 422 (turno cancelado).

#### GET /pagos-turno

- **Roles**: admin.
- **RF**: RF-19 (consulta), insumo de RF-45.
- **Descripción**: listado de pagos de turno.
- **Query**: `turnoId` (UUID), `usuarioId` (UUID), `desde` y `hasta` (timestamps o fechas).
- **Response 200**: array de `PagoTurno` con expansión `turno: { id, fecha, horaInicio, canchaId }` y `usuario: { id, nombre, apellido, numeroSocio }`.
- **Errores**: 400, 401, 403.

### 5.5 Canchas

#### GET /canchas

- **Roles**: autenticados.
- **RF**: soporte de RF-12 (elegir cancha) y RF-17 (visor de estados del admin).
- **Descripción**: catálogo de canchas con su estado operativo vigente.
- **Query**: `conEstados` (boolean, opcional, solo admin, por defecto `false`): agrega el historial `estados: [{ valorState, fechaCambio, motivo }]` (vista admin con estados).
- **Response 200**: array de `Cancha` (con `estados` cuando `conEstados=true`).
- **Errores**: 400, 401, 403 (`conEstados` con rol no admin).

#### PATCH /canchas/:id/estado

- **Roles**: admin.
- **RF**: RF-17 (asignar estado a cancha con motivo).
- **Descripción**: cambia el estado operativo: inserta en `estados_cancha` (con `motivo`) y actualiza `canchas.estado_actual` en la misma transacción.
- **Request**:

| Campo | Tipo | Oblig. | Validación |
|---|---|---|---|
| `estado` | enum `estado_cancha` | Si | `disponible|en_mantenimiento|inhabilitada`. |
| `motivo` | string | Cond. | Requerido si `estado != disponible`; 1–500. |

- **Response 200**: `Cancha`.
- **Errores**: 400, 401, 403, 404, 422 (estado igual al actual).
- **Nota**: no cancela turnos futuros automáticamente; ver §7.

### 5.6 Configuración (admin)

#### GET /config/rangos-horario

- **Roles**: autenticados (dato operativo que el frontend usa para mostrar horarios).
- **RF**: RF-34 (consulta).
- **Response 200**: `[ { "id": "...", "nombre": "apertura", "horaInicio": "08:00", "horaFin": "22:00" } ]`.
- **Errores**: 401.

#### PUT /config/rangos-horario

- **Roles**: admin.
- **RF**: RF-34 (registrar y modificar franja horaria).
- **Descripción**: reemplaza el conjunto de franjas en una transacción (upsert por `id` o `nombre`). La franja `apertura` define el horario de reserva (08:00–22:00 por defecto); la franja de iluminación se configura en `PUT /tarifas/luz`.
- **Request**: `{ "rangos": [ { "id": "uuid-opcional", "nombre": "apertura", "horaInicio": "08:00", "horaFin": "22:00" } ] }`.
- **Validaciones**: `nombre` único ≤50; `horaFin > horaInicio`.
- **Response 200**: array de rangos vigentes.
- **Errores**: 400, 401, 403, 409 (`nombre` duplicado).

#### GET /config/dias-funcionamiento

- **Roles**: autenticados.
- **RF**: RF-35 (consulta).
- **Response 200**: `[ { "diaSemana": 1, "habilitado": true } ]` (`diaSemana` ISO-8601: 1 = lunes, 7 = domingo).
- **Errores**: 401.

#### PUT /config/dias-funcionamiento

- **Roles**: admin.
- **RF**: RF-35 (registrar y modificar días de funcionamiento).
- **Descripción**: upsert de los 7 días en una transacción.
- **Request**: `{ "dias": [ { "diaSemana": 1, "habilitado": true } ] }`.
- **Validaciones**: `diaSemana` entre 1 y 7; no se admiten duplicados en el body.
- **Response 200**: array actualizado.
- **Errores**: 400, 401, 403.

### 5.7 Cuotas

#### GET /cuotas

- **Roles**: admin.
- **RF**: RF-22 (listado de socios con estado de cuotas), RF-23 (búsqueda), RF-24 (filtro por estado), RF-25 (filtro por fecha), RF-41 (filtro por fecha de generación), CU14.
- **Descripción**: listado de cuotas con su socio y el resumen de pagos.
- **Query**:
  - `busqueda` (string, opcional): `ILIKE` sobre `usuarios.apellido` y `usuarios.nombre`.
  - `estado` (enum `estado_cuota`, opcional): `pendiente|pagada|parcial|adeudada|cancelada`.
  - `fechaVencimientoDesde`, `fechaVencimientoHasta` (`YYYY-MM-DD`, opcionales).
  - `fechaGeneracionDesde`, `fechaGeneracionHasta` (`YYYY-MM-DD`, opcionales): rango sobre `cuotas.fecha_inicio`.
  - `socioId` (UUID, opcional).
- **Response 200**: array de `Cuota` con expansión `socio`.
- **Errores**: 400, 401, 403.

#### POST /cuotas/:id/pagos

- **Roles**: admin.
- **RF**: RF-21 (registrar pagos de cuotas), RF-42 (pago manual desde el panel), RN-3 (pagos parciales), CU14.2.
- **Descripción**: registra un pago (total o parcial) como línea de la cuota y recalcula el estado. Inserta en `lineas_cuota` (con `numero_linea` correlativo), recalcula `totalPagado`, actualiza `cuotas.estado_actual` e inserta en `estados_cuota`, todo en una transacción.
- **Request**:

| Campo | Tipo | Oblig. | Validación |
|---|---|---|---|
| `monto` | number | Si | > 0 y ≤ saldo pendiente. |
| `fechaPago` | timestamp | No | Default `now()`; no futura. |

- **Recálculo de estado**: `totalPagado = montoTotal` → `pagada`; `0 < totalPagado < montoTotal` → `parcial`; `totalPagado = 0` y vencida → `adeudada`; `totalPagado = 0` y no vencida → `pendiente`.
- **Response 201**:

```json
{
  "cuota": { "...Cuota..." },
  "linea": { "id": "...", "numeroLinea": 2, "monto": 5000.00, "fechaPago": "2026-09-15T10:00:00-03:00", "estado": "registrada" }
}
```

- **Errores**: 400, 401, 403, 404, 409 (cuota `cancelada`), 422 (monto mayor al saldo).

#### GET /cuotas/mias

- **Roles**: socio.
- **RF**: RF-26 (el socio consulta sus cuotas y pagos), CU14.
- **Descripción**: cuotas del socio autenticado, con sus pagos.
- **Response 200**: array de `Cuota` con `pagos: [{ id, numeroLinea, monto, fechaPago, estado }]`.
- **Errores**: 401, 403 (el usuario no es socio).

**Job: generación automática mensual de cuotas (RF-20)**

No es un endpoint. Proceso programado de la API que, el día configurado de cada mes, crea una cuota por cada socio vigente (`usuarios.estado_actual` en `activo` o `moroso`) con el `valores_cuota.precio` vigente, `fecha_inicio` = primer día del período y `fecha_vencimiento` según la configuración del club. El `unique (socio_id, fecha_inicio)` (`uq_cuotas_socio_periodo`) hace idempotente el reintento. El contrato expone el resultado vía `GET /cuotas` y `GET /cuotas/mias`.

### 5.8 Tarifas

#### GET /tarifas

- **Roles**: autenticados.
- **RF**: RF-43 (consultar valores actuales de turnos, luz y cuotas).
- **Response 200**:

```json
{
  "turno": { "id": "...", "costoXHora": 4000.00, "fechaCambio": "2026-09-01T00:00:00-03:00" },
  "luz": { "id": "...", "costoXHora": 4000.00, "franjaHorarioInicio": "18:30", "franjaHorarioFin": "22:00", "fechaCambio": "2026-09-01T00:00:00-03:00" },
  "cuota": { "id": "...", "precio": 15000.00, "fechaCambio": "2026-09-01T00:00:00-03:00" }
}
```

- **Errores**: 401.

#### PUT /tarifas/turno

- **Roles**: admin.
- **RF**: RF-27.
- **Descripción**: registra una nueva tarifa de turno por hora. Inserta fila en `valores_turno`; no modifica tarifas históricas.
- **Request**: `{ "costoXHora": 4500.00 }` (number ≥ 0).
- **Response 200**: tarifa de turno vigente (`{ id, costoXHora, fechaCambio }`).
- **Errores**: 400, 401, 403.

#### PUT /tarifas/luz

- **Roles**: admin.
- **RF**: RF-28 (tarifa de luz) y RF-16 (franja de iluminación; ver §7).
- **Descripción**: actualiza la fila única de `luz`. Si cambia `costoXHora`, inserta la fila de historial en `estados_luz`; la franja no se versiona.
- **Request**:

| Campo | Tipo | Oblig. | Validación |
|---|---|---|---|
| `costoXHora` | number | Si | ≥ 0. |
| `franjaHorarioInicio` | `HH:MM` | No | Si se envía, junto con `franjaHorarioFin`; `franjaHorarioFin > franjaHorarioInicio`. |
| `franjaHorarioFin` | `HH:MM` | No | idem. |

- **Response 200**: `{ id, costoXHora, franjaHorarioInicio, franjaHorarioFin, fechaCambio }`.
- **Errores**: 400, 401, 403.

#### PUT /tarifas/cuota

- **Roles**: admin.
- **RF**: RF-29.
- **Descripción**: registra una nueva tarifa de cuota mensual. Inserta fila en `valores_cuota`.
- **Request**: `{ "precio": 16000.00 }` (number ≥ 0).
- **Response 200**: tarifa de cuota vigente (`{ id, precio, fechaCambio }`).
- **Errores**: 400, 401, 403.

#### GET /tarifas/historial

- **Roles**: admin.
- **RF**: RF-30 (historial de cambios de tarifas de cuotas), RF-31 (filtrar por fecha y monto).
- **Descripción**: historial unificado de tarifas versionadas.
- **Query**:
  - `tipo` (`turno|luz|cuota`, opcional; default todos).
  - `desde`, `hasta` (timestamps o fechas, opcionales).
  - `montoMin`, `montoMax` (number, opcionales).
- **Response 200**: `[ { "tipo": "cuota", "monto": 15000.00, "fechaCambio": "2026-09-01T00:00:00-03:00" } ]` (para `luz` el monto es `costoXHora` y la fecha sale de `estados_luz.fecha`).
- **Errores**: 400, 401, 403.

### 5.9 Luz (pagos)

#### POST /pagos-luz

- **Roles**: admin.
- **RF**: RF-33 (registrar pago de luz).
- **Descripción**: registra el pago del cargo de luz de un turno nocturno ya verificado por el admin.
- **Request**:

| Campo | Tipo | Oblig. | Validación |
|---|---|---|---|
| `turnoId` | UUID | Si | Turno existente con `requiereLuz = true` y no cancelado. |
| `montoTotalLuz` | number | Si | > 0. |
| `fechaPago` | timestamp | No | Default `now()`; no futura. |

- **Response 201**: `PagoLuz`.
- **Errores**: 400, 401, 403, 404, 409 (ya existe un pago de luz para el turno — ver §7), 422 (el turno no requiere luz o está cancelado).

#### GET /pagos-luz

- **Roles**: admin.
- **RF**: RF-44 (historial de pagos de luz).
- **Query**: `turnoId` (UUID), `usuarioId` (UUID), `desde` y `hasta` (timestamps o fechas).
- **Response 200**: array de `PagoLuz` con expansión `turno: { id, fecha, horaInicio, canchaId }` y `usuario: { id, nombre, apellido, numeroSocio }`.
- **Errores**: 400, 401, 403.

### 5.10 Reportes

#### GET /reportes/estadisticas

- **Roles**: admin.
- **RF**: RF-32 (estadísticas generales).
- **Query**: `desde`, `hasta` (`YYYY-MM-DD`, opcionales; default mes actual).
- **Response 200** (forma):

```json
{
  "periodo": { "desde": "2026-09-01", "hasta": "2026-09-30" },
  "turnos": {
    "total": 120,
    "porEstado": { "confirmado": 10, "iniciado": 0, "finalizado": 95, "cancelado": 10, "no_asistio": 5 },
    "porCancha": [ { "canchaId": "...", "nroCancha": 1, "cantidad": 40 } ],
    "porFranja": [ { "horaInicio": "19:00", "cantidad": 25 } ]
  },
  "usuarios": { "sociosActivos": 40, "noSocios": 15, "morosos": 6 }
}
```

- **Errores**: 400, 401, 403.

#### GET /reportes/financiero

- **Roles**: admin.
- **RF**: RF-45 (estadísticas financieras de pagos, cuotas y uso de turnos).
- **Query**: `desde`, `hasta` (`YYYY-MM-DD`, opcionales; default mes actual).
- **Response 200** (forma):

```json
{
  "periodo": { "desde": "2026-09-01", "hasta": "2026-09-30" },
  "ingresos": { "pagosTurno": 120000.00, "pagosLuz": 48000.00, "cuotasCobradas": 300000.00, "total": 468000.00 },
  "cuotas": { "emitidas": 40, "montoEmitido": 600000.00, "pagadas": 20, "parciales": 10, "adeudadas": 10 },
  "usoCanchas": { "turnosTotal": 120, "horasOcupadas": 130.00, "ocupacionPromedio": 0.45 }
}
```

- **Errores**: 400, 401, 403.

## 6. Cobertura de requerimientos funcionales (RF-1 a RF-46)

Fuente de la lista: `docs/CONTEXTO.md` §6.

| RF | Requerimiento (resumen) | Resolución | Estado |
|---|---|---|---|
| RF-1 | Registro con datos personales | Clerk (sign-up) + `POST /usuarios/completar-perfil` | Cubierto |
| RF-2 | Login | Clerk (sign-in del frontend) | Cubierto |
| RF-3 | Admin modifica roles | `PATCH /usuarios/:id/rol` | Cubierto |
| RF-4 | Lista de usuarios | `GET /usuarios`, `GET /usuarios/:id` | Cubierto |
| RF-5 | Admin edita usuarios | `PATCH /usuarios/:id` | Cubierto |
| RF-6 | Usuario edita sus datos | `PATCH /usuarios/me` | Cubierto |
| RF-7 | Baja lógica | `DELETE /usuarios/:id` | Cubierto |
| RF-8 | Redirección a WhatsApp para pedir alta de socio | Comportamiento de frontend (link al WhatsApp de la administradora). Sin endpoint | Fuera de la API |
| RF-9 | Búsqueda por nombre/apellido | `GET /usuarios?busqueda=` | Cubierto |
| RF-10 | Filtro por estado | `GET /usuarios?estado=` | Cubierto |
| RF-11 | Filtro por rol | `GET /usuarios?rol=` | Cubierto |
| RF-12 | Reservar turno | `POST /turnos` | Cubierto |
| RF-13 | Informar si requiere luz y costo adicional | `POST /turnos` (`requiereLuz`, `cargoLuzCompartido`, `avisos`) | Cubierto |
| RF-14 | Cancelar hasta 1 hora antes | `POST /turnos/:id/cancelar` (RN-1) | Cubierto |
| RF-15 | Admin modifica duración de turno | Sin endpoint en v1; `tipos_turno` con seeds 60/90. Propuesta: `PATCH /config/tipos-turno/:id` (ver §7) | Pendiente (v1.1) |
| RF-16 | Admin modifica franja de iluminación | `PUT /tarifas/luz` (`franjaHorarioInicio`, `franjaHorarioFin`) | Cubierto |
| RF-17 | Admin asigna estado a cancha con motivo | `PATCH /canchas/:id/estado` | Cubierto |
| RF-18 | Socio ve su historial de turnos | `GET /turnos/mios/historial` | Cubierto |
| RF-19 | Admin registra pago de turno de no socio | `POST /pagos-turno` | Cubierto |
| RF-20 | Generación automática de cuotas mensuales | Job programado de la API (sin endpoint); §5.7 | Fuera de la API (job) |
| RF-21 | Registrar pagos de cuotas | `POST /cuotas/:id/pagos` | Cubierto |
| RF-22 | Listado de socios con estado de cuotas | `GET /cuotas` | Cubierto |
| RF-23 | Buscar socios por nombre/apellido | `GET /cuotas?busqueda=` | Cubierto |
| RF-24 | Filtro de cuotas por estado | `GET /cuotas?estado=` | Cubierto |
| RF-25 | Filtro de cuotas por fecha | `GET /cuotas?fechaVencimientoDesde=&fechaVencimientoHasta=` | Cubierto |
| RF-26 | Socio consulta sus cuotas y pagos | `GET /cuotas/mias` | Cubierto |
| RF-27 | Admin modifica tarifa de turnos | `PUT /tarifas/turno` | Cubierto |
| RF-28 | Admin modifica tarifa de luz | `PUT /tarifas/luz` | Cubierto |
| RF-29 | Admin modifica tarifa de cuotas | `PUT /tarifas/cuota` | Cubierto |
| RF-30 | Historial de cambios de tarifas de cuotas | `GET /tarifas/historial?tipo=cuota` | Cubierto |
| RF-31 | Filtrar historial por fecha y monto | `GET /tarifas/historial?desde=&hasta=&montoMin=&montoMax=` | Cubierto |
| RF-32 | Estadísticas generales | `GET /reportes/estadisticas` | Cubierto |
| RF-33 | Admin registra pago de luz | `POST /pagos-luz` | Cubierto |
| RF-34 | Admin registra y modifica franja horaria | `GET|PUT /config/rangos-horario` | Cubierto |
| RF-35 | Admin registra y modifica días de funcionamiento | `GET|PUT /config/dias-funcionamiento` | Cubierto |
| RF-36 | Ver todos los turnos vigentes | `GET /turnos/mios` (propios, CU24) y `GET /turnos` (todos, admin) | Cubierto |
| RF-37 | Buscar turnos por nombre/apellido | `GET /turnos?busqueda=` | Cubierto |
| RF-38 | Filtrar vigentes por fecha | `GET /turnos?fecha=|desde=&hasta=` y `GET /turnos/mios?fecha=` | Cubierto |
| RF-39 | Confirmar reserva con/sin luz | `POST /turnos` (respuesta con confirmación y avisos) | Cubierto |
| RF-40 | Cancelar turno (misma regla que RF-14) | `POST /turnos/:id/cancelar` | Cubierto |
| RF-41 | Filtro de cuotas por fecha de generación | `GET /cuotas?fechaGeneracionDesde=&fechaGeneracionHasta=` (sobre `fecha_inicio`) | Cubierto |
| RF-42 | Admin registra pago manual desde el panel | `POST /pagos-turno` y `POST /cuotas/:id/pagos` | Cubierto |
| RF-43 | Consultar valores actuales de turnos, luz y cuotas | `GET /tarifas` | Cubierto |
| RF-44 | Historial de pagos de luz | `GET /pagos-luz` | Cubierto |
| RF-45 | Estadísticas financieras | `GET /reportes/financiero` | Cubierto |
| RF-46 | Logout | `POST /auth/logout` | Cubierto |

**Resumen**: 46/46 requerimientos tratados. 43 cubiertos por endpoints, 1 resuelto por job (RF-20), 1 fuera de la API por ser comportamiento de frontend (RF-8) y 1 pendiente de endpoint para v1.1 (RF-15).

## 7. Supuestos y pendientes

1. **Rol por defecto**: el registro asigna `no_socio`. El alta de socio se pide por WhatsApp (RF-8) y la ejecuta el admin con `PATCH /usuarios/:id/rol`.
2. **Sesión**: la gestiona Clerk (session tokens renovados por su SDK). `POST /auth/logout` revoca la sesión en el servidor vía Backend API (RF-46, ADR-0008).
3. **Login**: lo define Clerk (identificador de ingreso configurable en el proveedor). La API no expone endpoints de credenciales.
4. **Reglas de negocio en el servicio**: RN-1, RN-2, RN-9, RN-10 y RN-11 se validan en la capa de aplicación (DB-SCHEMA §5); el contrato las expone como 422. La superposición de turnos se valida dentro de una transacción (la `unique` solo cubre inicios idénticos).
5. **`GET /turnos/disponibilidad`** no tiene RF propio: es una decisión de diseño para cumplir CU04 (elegir cancha, día y horario disponibles).
6. **Feriados**: no están modelados. La duración de 90 min en feriados depende de que el frontend/admin elija el `tipoTurnoId` correcto; pendiente una tabla/config de feriados.
7. **Vista admin de canchas**: `GET /canchas?conEstados=true` evita duplicar la ruta; `conEstados` es solo admin.
8. **Lectura de configuración**: `GET /config/*` se habilita a todos los roles autenticados porque la agenda del frontend necesita franjas y días; la escritura (`PUT`) es solo admin.
9. **RF-15 (duración configurable)**: pendiente de endpoint. La tabla `tipos_turno` ya tiene los seeds 60/90; se propone `PATCH /config/tipos-turno/:id` para v1.1.
10. **RF-16**: se resuelve en `PUT /tarifas/luz` porque costo y franja de iluminación viven en la fila única de `luz`; la franja no se versiona, solo el costo (`estados_luz`).
11. **Unicidad de pagos**: se decide a nivel de servicio un pago de turno por turno y un pago de luz por turno (409 si ya existe). La base no tiene constraints de unicidad para esos casos; si el club necesita pagos parciales también en turnos, se revisa.
12. **Sin paginación en v1**: los listados devuelven el conjunto completo. Pendiente si el volumen lo exige.
13. **Sin versionado en URL**: base `/api` para todos los endpoints de v1.
14. **Cancelación**: `PATCH /turnos/:id/estado` no permite el estado `cancelado`; siempre se pasa por `POST /turnos/:id/cancelar` para respetar RN-1 y guardar el motivo.
15. **Admin reserva**: el admin puede reservar y cancelar como cualquier usuario, sin tope diario (RN-10).
16. **Mensajes de error**: `message` es orientativo y está en español; el frontend centraliza el copy final que ve el usuario.
17. **Estados sin flujo definido**: `cancelada` en cuotas y el paso automático a `moroso` por deuda existen en el modelo (`estado_cuota`, `estado_usuario`) pero no tienen endpoint ni regla funcional definida en v1; pendiente de definición con la cátedra/club.
18. **`numeroSocio`**: si el admin promueve a socio sin enviarlo, la API genera el correlativo con formato `S-0001`; el formato es un supuesto ajustable.
19. **Cambio de estado de cancha**: pasar una cancha a `en_mantenimiento`/`inhabilitada` no cancela turnos futuros en v1; queda a criterio del admin (pendiente de política).
20. **Zona horaria**: los campos `fecha` y `hora*` se interpretan en hora local del club sin offset; los timestamps de auditoría y pagos sí llevan offset.
21. **Rol vigente en cada request**: los guards releen `usuarios_roles` (el session token de Clerk no lleva rol de negocio), por lo que un cambio de rol aplica de inmediato.
22. **Baja de tarifas**: el diagrama de diseño incluye `eliminarValorDeCuota/Luz/Turno`; no se implementa DELETE. Las tarifas son versionadas append-only (`valores_cuota`, `valores_turno`, `estados_luz`) y ningún RF pide borrar: dar de baja un valor es registrar el nuevo (el anterior queda como historial). Eliminar rompería el historial de tarifas (RF-30/31) y las estadísticas financieras (RF-45).
