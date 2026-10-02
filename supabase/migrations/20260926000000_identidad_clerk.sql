-- ============================================================================
-- Identidad con Clerk (ADR-0008)
--
-- - usuarios.clerk_user_id: id del usuario en Clerk (claim `sub` del session
--   token). Unico; lo completa el alta de dominio
--   (POST /usuarios/completar-perfil) y es la clave de mapeo para los guards.
-- - usuarios.password_hash: se elimina. Las credenciales las gestiona Clerk y
--   la API no recibe ni almacena passwords.
-- ============================================================================

alter table usuarios
  drop column password_hash,
  add column clerk_user_id text;

alter table usuarios
  add constraint uq_usuarios_clerk_user_id unique (clerk_user_id);

comment on column usuarios.clerk_user_id is 'ID del usuario en Clerk (sub del session token). Unico; lo escribe el alta desde la API (ADR-0008).';
