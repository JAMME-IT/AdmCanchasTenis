-- ============================================================================
-- Pago único por turno (ACT-54 fix double-pay race)
--
-- Dos POST /pagos-turno concurrentes pasaban el check 409 en la API y creaban
-- dos filas para el mismo turno. La base solo tenía un índice, no frenaba nada.
-- Con el unique la segunda inserción falla con 23505 y la API la traduce a 409.
-- Ejemplo: turno T-101 con pago P-55, si llegan dos POST juntos, uno gana y el
-- otro recibe 409 "Ya existe un pago registrado para este turno".
-- ============================================================================

alter table pagos_turno
  add constraint uq_pagos_turno_turno unique (turno_id);

drop index if exists idx_pagos_turno_turno;
