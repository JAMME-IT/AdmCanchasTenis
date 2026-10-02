# AdmCanchasTenis — Documento de contexto del proyecto

> Fuente: `Documentacion - S.I. (1).pdf` (UTN FR Concepción del Uruguay, Ingeniería en Sistemas, Habilitación Profesional 2025).
> Docentes: Ing. Miriam Kloster, Ing. Adrián Callejas.
> Equipo: Cruz Juan, Del Real Edgardo, Lima Martín Sebastián, Ponce Perez Agustin, Udrizard Martin.
> Este archivo es el contexto de referencia para todo el equipo cuando trabaja en el repo. El código, identifiers y UI copy se mantienen en inglés; este documento de equipo está en español neutro/profesional.

## 1. Problema y organización

Club de tenis que hoy gestiona turnos por un grupo de WhatsApp (reservas desde las 00:00 de cada día) y finanzas en planillas de Excel. Referente funcional: Adriana (administradora), quien gestiona turnos y recibe pagos en su cuenta de Mercado Pago.

Dolores actuales:
- Sin control centralizado: errores humanos, conflictos de horarios, sin registro histórico ni reportes/estadísticas.
- Finanzas manuales en Excel: riesgo de pérdida de información, seguimiento costoso de pagos y cuotas, mucho tiempo operativo de Adriana.
- Tarifas diferenciadas socio / no socio, costo de luz adicional y profesores particulares que avisan disponibilidad por WhatsApp.

Datos operativos del club:
- 3 canchas habilitadas. Horario 8:00–22:00.
- Duración del turno: 60 min en días de semana, 90 min en fines de semana y feriados (configurable por Adriana).
- Luz artificial: se enciende entre 18:30 y 19:00. Costo $4000 por turno (entre todos los participantes), lo pagan socios y no socios.
- No socios: $4000 por persona por hora, solo pagan el turno.
- Acceso con candado con clave (solo socios conocen el código).
- Cobrador externo recauda cuotas de socios a cambio de comisión.
- Sin grupo familiar, sin multas por no asistir (por ahora).
- WhatsApp sigue existiendo: por ahí se envían comprobantes de pago y el no socio pide el alta como socio. El sistema no reemplaza esa comunicación.

## 2. Función a sistematizar

- Administración centralizada de turnos (solicitar, modificar, cancelar) para socios y no socios.
- Gestión de pagos y cuotas (turnos, luz, cuotas mensuales de socios).
- Control de recursos (disponibilidad de canchas, histórico de turnos y pagos).
- Reemplaza WhatsApp + Excel como registro único, confiable y accesible. No corta WhatsApp: comprobantes y alta de socio siguen por ese canal.

## 3. Objetivos del sistema

1. Optimizar gestión de turnos y cobros, evitando errores humanos y conflictos de horarios.
2. Centralizar información de usuarios, turnos y pagos para consultas y reportes.
3. Dar flexibilidad a la administración (duración de turnos, tarifas ágiles).
4. Generar estadísticas para la toma de decisiones.
5. Mejorar la experiencia de usuarios con trazabilidad y seguimiento.

## 4. Alcance y límites

Alcance:
- Gestión de usuarios con roles (socio, no socio, administrador).
- Reserva de turnos de cancha.
- Registro y consulta de usuarios, pagos, turnos, cuotas, valores de cuota, valores de luz y canchas.
- Listados y visualización de socios, usuarios, cuotas, pagos, turnos y valores vigentes.
- Historial de cuotas, pagos, turnos y valores.

Límites (lo que el sistema NO hace):
- Sin gestión de inventario ni mantenimiento de canchas.
- Sin facturación oficial ni integración contable externa (ARCA). Solo registros internos.
- No reemplaza la comunicación directa socio/no socio ↔ administradora ni socios ↔ profesores.
- No controla asistencia física (acceso autónomo). Se trabaja sobre turno registrado y buena fe de asistir/cancelar.

## 5. Roles

- **Administrador (Adriana)**: gestiona usuarios, roles, turnos, tarifas, horarios, cuotas y pagos. Sin límite de turnos propios.
- **Socio**: reserva turnos, ve su historial de turnos, consulta sus cuotas y pagos.
- **No socio**: reserva turnos (paga por turno), ve sus turnos vigentes. Para ser socio, pide el alta por WhatsApp (redirección desde el sistema).

## 6. Requerimientos funcionales (resumen)

Usuarios y auth: RF-1 registro con datos personales, RF-2 login, RF-46 logout, RF-3 admin modifica roles, RF-4 lista de usuarios, RF-5 admin edita usuarios, RF-6 usuario edita sus datos, RF-7 baja lógica, RF-8 redirección a WhatsApp para pedir alta de socio, RF-9 búsqueda por nombre/apellido, RF-10/11 filtros por estado y rol.

Turnos: RF-12 reservar, RF-13 informar si requiere luz y costo adicional, RF-14/RF-40 cancelar (hasta 1 hora antes), RF-15 admin modifica duración, RF-16 admin modifica franja de iluminación, RF-17 admin asigna estado a cancha con motivo, RF-18 socio ve su historial, RF-34/RF-35 admin registra y modifica franja horaria y días de funcionamiento, RF-36 ver todos los turnos vigentes, RF-37 buscar turnos por nombre/apellido, RF-38 filtrar vigentes por fecha, RF-39 confirmar reserva con/sin luz.

Pagos y cuotas: RF-19 admin registra pago de turno de no socio, RF-20 generación automática de cuotas mensuales para socios, RF-21 registrar pagos de cuotas, RF-22 listado de socios con estado de cuotas, RF-23 buscar socios por nombre/apellido, RF-24/RF-25/RF-41 filtros de cuotas por estado, fecha y fecha de generación, RF-26 socio consulta sus cuotas y pagos, RF-42 admin registra pago manual desde el panel, RF-33 admin registra pago de luz, RF-44 historial de pagos de luz.

Tarifas: RF-27/28/29 admin modifica tarifa de turnos, luz y cuotas; RF-30 historial de cambios de tarifas de cuotas; RF-31 filtrar historial por fecha y monto; RF-43 consultar valores actuales de turnos, luz y cuotas.

Reportes: RF-32 estadísticas generales, RF-45 estadísticas financieras de pagos, cuotas y uso de turnos.

## 7. Requerimientos no funcionales

- RNF-1: base de datos relacional.
- RNF-2: autenticación y autorización por rol.
- RNF-3: responsive (celular, tablet, computadora).

## 8. Reglas de negocio

- RN-1: un turno solo se cancela hasta 1 hora antes del inicio.
- RN-2: máximo 2 turnos por día por usuario.
- RN-3: las cuotas mensuales aceptan pagos parciales.
- RN-4: solo el administrador cambia el estado de un usuario.
- RN-5: los roles solo los gestiona el administrador.
- RN-6: solo usuarios registrados reservan turnos.
- RN-7: las reservas se hacen exclusivamente desde la app web.
- RN-8: los recibos se envían al administrador por WhatsApp.
- RN-9: con 2 meses de cuotas adeudadas, el socio solo puede pedir 1 turno más hasta regularizar.
- RN-10: el administrador no tiene límite de turnos.
- RN-11: los turnos se reservan con 1 día de anticipación como máximo.

## 9. Flujos principales (casos de uso)

- **Reservar turno (CU04)**: el usuario elige cancha, día y horario disponibles. Si es horario diurno confirma reserva de día (cancha, fecha, horario, cantidad de personas, cantidad de no socios, duración 60/90 min, recordatorio de $4000 por no socio a pagar a Adriana). Si es nocturno confirma reserva de noche (mismo formulario + aviso de cargo adicional de luz $4000 entre todos). Validaciones: tope de 2 turnos diarios, control de deuda (RN-9), sin superposición de horarios (un turno de 90 min no puede solaparse con otro existente).
- **Ver turnos vigentes (CU24 socio/no socio)**: lista propia con fecha, rango horario, n.º de cancha y botón cancelar por fila, con confirmación y motivo.
- **Ver turnos vigentes admin (CU22)**: lista general con búsqueda por apellido/nombre y cancelación (misma regla de 1 hora).
- **Historial de turnos (CU5)**: lista cronológica de turnos finalizados del usuario.
- **Cuotas de socios (CU14)**: admin ve socios con fecha, monto y estado (pendiente, pagada, parcial, adeudada, cancelada), busca por apellido/nombre, filtra por estado y registra pagos (CU14.2) con deudor, acreedor, resumen (total a pagar, total pagado, estado) e historial de pagos; validación de monto total obligatorio.

## 10. Arquitectura decidida

Tres capas (según documentación de cátedra):
- **Presentación (frontend)**: React + Vite + TypeScript en `apps/web` (puerto 5173). No accede directo a la DB; consume la API.
- **Aplicación (API REST)**: NestJS + TypeScript en `apps/api` (puerto 3000). Lógica de negocio, validaciones, reglas (RN-1..RN-11), permisos por rol.
- **Datos (DB)**: relacional (pendiente de elección final: Postgres recomendado). Solo accedida vía API.

Monorepo actual (`AdmCanchasTenis`):
- `apps/api`: NestJS 10, `GET /health` → `{status:"ok"}`.
- `apps/web`: React 18 + Vite 5, landing + prueba de health.
- `packages/shared`: tipos compartidos (`HealthResponse`).
- Root con npm workspaces y scripts `dev:api`, `dev:web`, `build`.

## 11. Cómo correr (dev)

1. `npm install`
2. Terminal 1: `npm run dev:api` (API en :3000)
3. Terminal 2: `npm run dev:web` (web en :5173)
4. Referencia interactiva de la API (Scalar): `http://localhost:3000/api/docs` (spec OpenAPI en `/api/docs.json`).
2. `npm run db:seed` (deja la base lista para demo: admin inicial, canchas, días, franja horaria y tarifas vigentes; es idempotente, se puede repetir). El admin de demo es `admin+clerk_test@admcanchastenis.dev`; si Clerk pide un código OTP en dev, es `424242`
3. Terminal 1: `npm run dev:api` (API en :3000)
4. Terminal 2: `npm run dev:web` (web en :5173)

## 12. Convenciones del equipo

- Commits SIEMPRE en español con jerga técnica en inglés (regla estricta vigente). Ej: `chore: scaffold inicial del monorepo (NestJS api + React web + shared)`. Sin `Co-Authored-By`. Conventional commits.
- Código, nombres de identifiers, comentarios de código y UI copy en inglés.
- Cambios de reglas del club (tarifas, horarios, luz) deben ser configurables por admin, no hardcodeados.
