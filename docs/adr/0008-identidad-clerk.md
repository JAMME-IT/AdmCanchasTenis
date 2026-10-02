# ADR-0008: Identidad con Clerk y RBAC propio en la base

- **Estado**: Aceptada
- **Fecha**: 2026-09-26

## Contexto

RF-1 (registro), RF-2 (login), RF-46 (logout) y RNF-2 (autenticación y autorización por rol) tienen modelo de dominio propio: `usuarios` con historial de estados y `usuarios_roles` con un rol vigente por usuario (ADR-0004). La ADR-0007 había decidido implementar el flujo completo en la API (bcryptjs + JWT propia).

El equipo re-evaluó la decisión y la cátedra autorizó el uso de un proveedor externo de identidad: el objetivo es reducir la superficie de seguridad a cargo del equipo (hash, verificación de email, recuperación de contraseña, sesiones) sin resignar el modelo de roles propio.

## Decisión

- **Clerk** como proveedor de identidad: registro, login, verificación de email, recuperación de contraseña, sesiones y perfil del usuario viven en Clerk.
- **La base propia sigue siendo la fuente de verdad del dominio**: `usuarios` (con `clerk_user_id`), `usuarios_roles` y el RBAC del club (admin/socio/no_socio con historial). Clerk no gestiona roles de negocio.
- `usuarios.password_hash` se elimina: la API no recibe ni almacena credenciales.
- La API valida el **session token** de Clerk con `@clerk/backend` (`verifyToken` con `CLERK_JWT_KEY` y `authorizedParties`, sin llamadas de red por request) y mapea `sub` → `usuarios.clerk_user_id`.
- **Alta (RF-1)**: tras el sign-up en Clerk, el frontend llama a `POST /usuarios/completar-perfil` (autenticado); la API crea `usuarios` + estado inicial (`activo`) + rol vigente `no_socio` en una transacción y devuelve el Usuario.
- **Sincronización**: webhook firmado de Clerk (`user.updated`, `user.deleted`) mantiene `usuarios.email` y aplica la baja lógica (`inactivo` + historial de estados).
- **Logout (RF-46)**: `POST /auth/logout` revoca la sesión en Clerk (Backend API, `sid` del token); el cliente además cierra sesión.
- **Email y password** se gestionan en el perfil hospedado de Clerk; `PATCH /usuarios/me` solo edita datos de club (nombre, apellido, teléfono, username).

## Alternativas consideradas

- **JWT propia con bcryptjs (ADR-0007)**: reemplazada. El flujo propio obliga a mantener hash, expiración, recuperación y revocación; con el proveedor autorizado, ese esfuerzo rinde menos que el modelo de dominio y los reportes.
- **Supabase Auth**: descartada. Acopla la identidad al proveedor de base de datos y su modelo de sesión/UI no aporta nada sobre Clerk; se mantiene la separación identidad (Clerk) / datos (Postgres en Supabase).
- **Sesiones server-side propias (cookie + tabla o Redis)**: descartada. Necesita almacenamiento y limpieza de sesiones que Clerk ya resuelve.

## Consecuencias

Positivas:

- Registro, login, verificación de email y recuperación quedan mantenidos por Clerk; el equipo no custodia credenciales.
- `POST /auth/logout` pasa a revocar la sesión en el servidor (mejora sobre la v1 de la ADR-0007, donde el token stateless seguía vigente).
- El dominio (usuarios, roles, historial) y el RBAC quedan en la base propia: un cambio futuro de IdP no toca `usuarios_roles`.

Negativas:

- Dependencia de un servicio externo: disponibilidad, límites del plan gratuito y necesidad de internet para desarrollar (el equipo ya depende de Supabase, ADR-0002).
- El flujo de autenticación deja de ser código propio (implicancia académica aceptada explícitamente por la cátedra).
- La sincronización depende del webhook: si falla, `usuarios.email` o la baja lógica se desincronizan; queda documentado el reintento manual como mitigación.
- Los entornos de desarrollo y CI necesitan claves de Clerk (publishable/secret) para ejercitar el flujo completo.

## Referencias

- `docs/DB-SCHEMA.md` §2.1, §5 y §9; `docs/API-CONTRATO.md` §2 y §5.1–5.2.
- Migración: `supabase/migrations/20260926000000_identidad_clerk.sql`.
- Reemplaza a la ADR-0007 (autenticación JWT propia).
