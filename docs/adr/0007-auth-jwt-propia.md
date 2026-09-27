# ADR-0007: Autenticación JWT propia en la API

- **Estado**: Reemplazada por [ADR-0008](0008-identidad-clerk.md)
- **Fecha**: 2026-09-25

## Contexto

RNF-2 exige autenticación y autorización por rol; RF-2 login y RF-46 logout. El esquema tiene una tabla `usuarios` propia con `password_hash` y `usuarios_roles` con historial de roles. `docs/DB-SCHEMA.md` ya descarta Supabase Auth. La cátedra pide implementar el flujo de autenticación como parte del aprendizaje.

## Decisión

Implementar la autenticación en la API:

- Hash de passwords con `bcryptjs` (`usuarios.password_hash`); el hash nunca se devuelve.
- Access token JWT firmado por la API (HS256), payload `{ sub, rol }`, vigencia de 8 h.
- Guard de autenticación + guard de roles que releen el rol vigente de `usuarios_roles` en cada request.
- `POST /auth/logout` (RF-46) existe y documenta el cierre de sesión: en v1 el token es stateless y el cliente lo descarta. Una denylist/rotación queda como mejora futura.
- Sin Supabase Auth.

## Alternativas consideradas

- **Supabase Auth**: descartada. Acopla el sistema al proveedor (los usuarios y sus métodos viven fuera de la base propia), no encaja con la tabla `usuarios` ni con `usuarios_roles` del modelo de cátedra, y la consigna pide implementar el flujo de login/logout.
- **Sesiones server-side (cookie + tabla o Redis)**: descartada en v1. Requiere almacenar y limpiar sesiones; para una app de club con un frontend único el costo no se justifica y complica el despliegue.
- **Refresh tokens desde el inicio**: descartada en v1. Agrega rotación, almacenamiento y revocación; con 8 h de vigencia el usuario vuelve a loguearse, suficiente para el uso real del club. Se puede agregar después sin romper el contrato.

## Consecuencias

Positivas:

- Control total del flujo y del modelo de roles; sin dependencia de un proveedor de identidad.
- Simple de testear y de explicar en la cátedra.

Negativas:

- La seguridad (hash, expiración, revocación) queda a cargo del equipo.
- El logout no invalida el token en el servidor en v1: un token comprometido es válido hasta su expiración (máximo 8 h), mitigable con una denylist futura.
