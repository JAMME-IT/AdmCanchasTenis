-- ============================================================================
-- AdmCanchasTenis - Esquema inicial de base de datos
-- Migracion: 20260925000000_initial_schema.sql
-- Motor: PostgreSQL 15+ (compatible con Supabase). No se usa Supabase Auth:
-- la tabla usuarios es propia de la aplicacion y la autenticacion se resuelve
-- en la API (JWT) en una etapa posterior.
--
-- Orden de ejecucion (archivo ejecutable de arriba hacia abajo):
--   1. Tipos enumerados
--   2. Tablas (orden de dependencias FK)
--   3. Indices
--   4. Seeds
--   5. Comentarios y notas de diseno
--
-- Documento de diseno: docs/DB-SCHEMA.md
-- ============================================================================


-- ============================================================================
-- 1. Tipos enumerados
-- ============================================================================

create type rol_nombre as enum ('admin', 'socio', 'no_socio');

create type estado_usuario as enum ('activo', 'moroso', 'suspendido', 'inactivo');

create type estado_cuota as enum ('pendiente', 'pagada', 'parcial', 'adeudada', 'cancelada');

create type estado_linea_cuota as enum ('registrada', 'anulada');

create type estado_cancha as enum ('disponible', 'en_mantenimiento', 'inhabilitada');

create type superficie_cancha as enum ('dura', 'polvo_de_ladrillo', 'cesped');

create type estado_turno as enum ('confirmado', 'cancelado', 'iniciado', 'finalizado', 'no_asistio');

create type estado_pago as enum ('impago', 'pago');


-- ============================================================================
-- 2. Tablas
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 2.1 Usuarios y roles
-- ----------------------------------------------------------------------------

-- Tipos de turno: duracion en minutos (60 en dias de semana, 90 en fines de
-- semana y feriados; configurable por el administrador).
create table tipos_turno (
  id           uuid primary key default gen_random_uuid(),
  duracion_max smallint not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint uq_tipos_turno_duracion_max unique (duracion_max),
  constraint ck_tipos_turno_duracion_positiva check (duracion_max > 0)
);

create table roles (
  id         uuid primary key default gen_random_uuid(),
  nombre     rol_nombre not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_roles_nombre unique (nombre)
);

create table usuarios (
  id            uuid primary key default gen_random_uuid(),
  username      varchar(50) not null,
  password_hash text not null,
  email         varchar(254) not null,
  nombre        varchar(100) not null,
  apellido      varchar(100) not null,
  telefono      varchar(30),
  dni           varchar(15) not null,
  estado_actual estado_usuario not null default 'activo',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint uq_usuarios_username unique (username),
  constraint uq_usuarios_email unique (email),
  constraint uq_usuarios_dni unique (dni)
);

-- Socio: asociacion 0..1 con Usuario. numero_socio es la clave de negocio que
-- en el diagrama de catedra era el OID.
create table socios (
  id           uuid primary key default gen_random_uuid(),
  numero_socio varchar(20) not null,
  fecha_alta   date not null default current_date,
  usuario_id   uuid not null references usuarios (id) on delete restrict,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint uq_socios_numero_socio unique (numero_socio),
  constraint uq_socios_usuario unique (usuario_id)
);

-- Historial de asignaciones de rol. fecha_fin null = rol vigente.
create table usuarios_roles (
  id           uuid primary key default gen_random_uuid(),
  usuario_id   uuid not null references usuarios (id) on delete cascade,
  rol_id       uuid not null references roles (id) on delete restrict,
  fecha_inicio timestamptz not null default now(),
  fecha_fin    timestamptz,
  created_at   timestamptz not null default now(),
  constraint ck_usuarios_roles_rango check (fecha_fin is null or fecha_fin > fecha_inicio)
);

-- Historial append-only de estados del usuario (RF-10, RF-11, tablero de
-- morosidad). El estado corriente vive en usuarios.estado_actual.
create table estados_usuario (
  id         uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios (id) on delete cascade,
  valor      estado_usuario not null,
  fecha_hora timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 2.2 Canchas y estados
-- ----------------------------------------------------------------------------

-- superficie e iluminacion son datos estaticos de la cancha (no historicos).
create table canchas (
  id            uuid primary key default gen_random_uuid(),
  nro_cancha    smallint not null,
  superficie    superficie_cancha not null,
  iluminacion   boolean not null default true,
  estado_actual estado_cancha not null default 'disponible',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint uq_canchas_nro unique (nro_cancha),
  constraint ck_canchas_nro_positivo check (nro_cancha > 0)
);

-- Historial de estados operativos de la cancha (RF-17: cambio con motivo).
create table estados_cancha (
  id           uuid primary key default gen_random_uuid(),
  cancha_id    uuid not null references canchas (id) on delete cascade,
  valor_state  estado_cancha not null,
  fecha_cambio timestamptz not null default now(),
  motivo       text
);

-- ----------------------------------------------------------------------------
-- 2.3 Configuracion general
-- ----------------------------------------------------------------------------

-- Franjas horarias genericas (apertura del club, franja de iluminacion, etc.).
create table rangos_horario (
  id          uuid primary key default gen_random_uuid(),
  nombre      varchar(50) not null,
  hora_inicio time not null,
  hora_fin    time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_rangos_horario_nombre unique (nombre),
  constraint ck_rangos_horario_rango check (hora_fin > hora_inicio)
);

-- Dias de funcionamiento del club. dia_semana en ISO-8601 (1 = lunes,
-- 7 = domingo).
create table dias_funcionamiento (
  id         uuid primary key default gen_random_uuid(),
  dia_semana smallint not null,
  habilitado boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_dias_funcionamiento_dia unique (dia_semana),
  constraint ck_dias_funcionamiento_dia check (dia_semana between 1 and 7)
);

-- Tarifas historicas de turno. La tarifa vigente es la fila con mayor
-- fecha_cambio menor o igual a now() (ver comentario final).
create table valores_turno (
  id           uuid primary key default gen_random_uuid(),
  costo_x_hora numeric(12, 2) not null,
  fecha_cambio timestamptz not null default now(),
  constraint ck_valores_turno_costo check (costo_x_hora >= 0)
);

-- ----------------------------------------------------------------------------
-- 2.4 Turnos
-- ----------------------------------------------------------------------------

-- Turno: entidad central. estado_actual es el cache del ultimo estado del
-- ciclo de vida y estado_pago el cache del ultimo estado de pago; ambos se
-- escriben en la misma transaccion que estados_turno.
create table turnos (
  id                 uuid primary key default gen_random_uuid(),
  usuario_id         uuid not null references usuarios (id) on delete restrict,
  cancha_id          uuid not null references canchas (id) on delete restrict,
  tipo_turno_id      uuid not null references tipos_turno (id) on delete restrict,
  valor_turno_id     uuid not null references valores_turno (id) on delete restrict,
  fecha              date not null,
  hora_inicio        time not null,
  hora_fin           time not null,
  cantidad_personas  smallint not null default 1,
  cantidad_no_socios smallint not null default 0,
  costo_turno_ns     numeric(12, 2) not null default 0,
  requiere_luz       boolean not null default false,
  estado_actual      estado_turno not null default 'confirmado',
  estado_pago        estado_pago not null default 'impago',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint uq_turnos_cancha_fecha_hora unique (cancha_id, fecha, hora_inicio),
  constraint ck_turnos_rango check (hora_fin > hora_inicio),
  constraint ck_turnos_personas check (cantidad_personas > 0),
  constraint ck_turnos_no_socios check (cantidad_no_socios >= 0 and cantidad_no_socios <= cantidad_personas),
  constraint ck_turnos_costo_ns check (costo_turno_ns >= 0)
);

-- Historial combinado de transiciones del turno: cada fila es la foto del par
-- (ciclo de vida, estado de pago) despues de una transicion. Toda transicion
-- inserta una fila y actualiza los caches de turnos en la misma transaccion.
create table estados_turno (
  id                uuid primary key default gen_random_uuid(),
  turno_id          uuid not null references turnos (id) on delete cascade,
  valor_estado      estado_turno not null,
  valor_estado_pago estado_pago not null,
  motivo            text,
  fecha_y_hora      timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 2.5 Cuotas
-- ----------------------------------------------------------------------------

-- Tarifas historicas de cuota.
create table valores_cuota (
  id           uuid primary key default gen_random_uuid(),
  precio       numeric(12, 2) not null,
  fecha_cambio timestamptz not null default now(),
  constraint ck_valores_cuota_precio check (precio >= 0)
);

-- Cuota mensual de un socio. estado_actual es cache del ultimo estado; el
-- historial vive en estados_cuota. monto_total admite pagos parciales (RN-3).
create table cuotas (
  id                uuid primary key default gen_random_uuid(),
  socio_id          uuid not null references socios (id) on delete restrict,
  fecha_inicio      date not null,
  fecha_vencimiento date not null,
  monto_total       numeric(12, 2) not null,
  estado_actual     estado_cuota not null default 'pendiente',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint uq_cuotas_socio_periodo unique (socio_id, fecha_inicio),
  constraint ck_cuotas_rango check (fecha_vencimiento > fecha_inicio),
  constraint ck_cuotas_monto check (monto_total >= 0)
);

-- Lineas de pago de una cuota (pagos parciales). numero_linea es la clave de
-- negocio que en el diagrama era el OID; el PK real es id.
create table lineas_cuota (
  id           uuid primary key default gen_random_uuid(),
  cuota_id     uuid not null references cuotas (id) on delete cascade,
  numero_linea smallint not null,
  fecha_pago   timestamptz,
  monto        numeric(12, 2) not null,
  estado       estado_linea_cuota not null default 'registrada',
  created_at   timestamptz not null default now(),
  constraint uq_lineas_cuota_numero unique (cuota_id, numero_linea),
  constraint ck_lineas_cuota_numero check (numero_linea > 0),
  constraint ck_lineas_cuota_monto check (monto >= 0)
);

-- Historial append-only de estados de la cuota.
create table estados_cuota (
  id           uuid primary key default gen_random_uuid(),
  cuota_id     uuid not null references cuotas (id) on delete cascade,
  valor_estado estado_cuota not null,
  fecha_hora   timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 2.6 Pagos
-- ----------------------------------------------------------------------------

-- Pago de un turno (caso no socio; RF-19).
create table pagos_turno (
  id                uuid primary key default gen_random_uuid(),
  turno_id          uuid not null references turnos (id) on delete restrict,
  monto_total_turno numeric(12, 2) not null,
  fecha_pago        timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  constraint ck_pagos_turno_monto check (monto_total_turno >= 0)
);

-- Detalle del pago de turno.
create table lineas_pago_turno (
  id               uuid primary key default gen_random_uuid(),
  pago_turno_id    uuid not null references pagos_turno (id) on delete cascade,
  monto_turno_pago numeric(12, 2) not null,
  created_at       timestamptz not null default now(),
  constraint ck_lineas_pago_turno_monto check (monto_turno_pago >= 0)
);

-- Pago del cargo de luz de un turno nocturno (RF-33, RF-44). PK propia
-- id_pago_luz: corrige la colision del diagrama, que reutilizaba
-- idLineaTurnoPago como OID de esta clase.
create table pagos_luz (
  id_pago_luz     uuid primary key default gen_random_uuid(),
  turno_id        uuid not null references turnos (id) on delete restrict,
  monto_total_luz numeric(12, 2) not null,
  fecha_pago      timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  constraint ck_pagos_luz_monto check (monto_total_luz >= 0)
);

-- ----------------------------------------------------------------------------
-- 2.7 Luz
-- ----------------------------------------------------------------------------

-- Configuracion vigente de iluminacion (tabla de una sola fila operativa).
-- Su costo se versiona en estados_luz.
create table luz (
  id                    uuid primary key default gen_random_uuid(),
  costo_x_hora          numeric(12, 2) not null,
  franja_horario_inicio time not null,
  franja_horario_fin    time not null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint ck_luz_costo check (costo_x_hora >= 0),
  constraint ck_luz_franja check (franja_horario_fin > franja_horario_inicio)
);

-- Historial de tarifas de luz. La tarifa vigente es la fila con mayor fecha
-- menor o igual a now().
create table estados_luz (
  id           uuid primary key default gen_random_uuid(),
  luz_id       uuid not null references luz (id) on delete cascade,
  costo_x_hora numeric(12, 2) not null,
  fecha        timestamptz not null default now(),
  constraint ck_estados_luz_costo check (costo_x_hora >= 0)
);


-- ============================================================================
-- 3. Indices
-- ============================================================================

-- Un solo rol vigente por usuario (fecha_fin null = vigente).
create unique index uq_usuarios_roles_vigente on usuarios_roles (usuario_id) where fecha_fin is null;

create index idx_usuarios_apellido_nombre on usuarios (apellido, nombre);
create index idx_usuarios_roles_usuario on usuarios_roles (usuario_id);
create index idx_usuarios_roles_rol on usuarios_roles (rol_id);
create index idx_estados_usuario_usuario_fecha on estados_usuario (usuario_id, fecha_hora desc);

create index idx_estados_cancha_cancha_fecha on estados_cancha (cancha_id, fecha_cambio desc);

-- Read paths de turnos: agenda por fecha y cancha; RN-2 (conteo diario por
-- usuario); turnos vigentes.
create index idx_turnos_fecha_cancha on turnos (fecha, cancha_id);
create index idx_turnos_usuario_fecha on turnos (usuario_id, fecha);
create index idx_turnos_cancha on turnos (cancha_id);
create index idx_estados_turno_turno_fecha on estados_turno (turno_id, fecha_y_hora desc);

-- Cuotas: listado y filtro por socio y estado; RN-9 (deuda) y vencimientos.
create index idx_cuotas_socio_estado on cuotas (socio_id, estado_actual);
create index idx_cuotas_fecha_vencimiento on cuotas (fecha_vencimiento);
create index idx_lineas_cuota_cuota_fecha on lineas_cuota (cuota_id, fecha_pago desc);
create index idx_estados_cuota_cuota_fecha on estados_cuota (cuota_id, fecha_hora desc);

-- Pagos: por entidad y por fecha (RF-45, RF-44).
create index idx_pagos_turno_turno on pagos_turno (turno_id);
create index idx_pagos_turno_fecha on pagos_turno (fecha_pago);
create index idx_lineas_pago_turno_pago on lineas_pago_turno (pago_turno_id);
create index idx_pagos_luz_turno on pagos_luz (turno_id);
create index idx_pagos_luz_fecha on pagos_luz (fecha_pago);

-- Tarifas historicas: consulta de tarifa vigente.
create index idx_valores_turno_fecha on valores_turno (fecha_cambio desc);
create index idx_valores_cuota_fecha on valores_cuota (fecha_cambio desc);
create index idx_estados_luz_luz_fecha on estados_luz (luz_id, fecha desc);


-- ============================================================================
-- 4. Seeds
-- ============================================================================

-- Roles fijos del sistema (RF-3, RN-5).
insert into roles (nombre) values ('admin'), ('socio'), ('no_socio')
on conflict (nombre) do nothing;

-- Duraciones de turno iniciales: 60 min (dias de semana) y 90 min (fines de
-- semana y feriados).
insert into tipos_turno (duracion_max) values (60), (90)
on conflict (duracion_max) do nothing;


-- ============================================================================
-- 5. Comentarios
-- ============================================================================

comment on type rol_nombre is 'Roles del sistema. Etiquetas de negocio: Admin, Socio, No socio.';
comment on type estado_usuario is 'Estado del usuario: activo, moroso, suspendido, inactivo.';
comment on type estado_cuota is 'Estado de la cuota: pendiente, pagada, parcial, adeudada, cancelada.';
comment on type estado_linea_cuota is 'Estado de la linea de pago: registrada o anulada.';
comment on type estado_cancha is 'Estado operativo de la cancha: disponible, en_mantenimiento, inhabilitada.';
comment on type superficie_cancha is 'Superficie de la cancha (dato estatico, no historico).';
comment on type estado_turno is 'Ciclo de vida del turno, separado del estado de pago.';
comment on type estado_pago is 'Estado de pago del turno, separado del ciclo de vida.';

comment on table tipos_turno is 'Duracion de turno en minutos (RF-15).';
comment on table roles is 'Roles del sistema, administrados por el administrador (RN-5).';
comment on table usuarios is 'Actores del sistema. Autenticacion propia de la API (JWT), sin Supabase Auth.';
comment on table socios is 'Datos de socio de un usuario (asociacion 0..1).';
comment on table usuarios_roles is 'Historial de asignaciones de rol por usuario.';
comment on table estados_usuario is 'Historial append-only de estados del usuario (RF-32).';
comment on table canchas is 'Canchas del club. Superficie e iluminacion son datos estaticos.';
comment on table estados_cancha is 'Historial de estados operativos de la cancha (RF-17).';
comment on table rangos_horario is 'Franjas horarias configurables (RF-34, RF-35).';
comment on table dias_funcionamiento is 'Dias de funcionamiento del club (RF-34, RF-35).';
comment on table valores_turno is 'Historial de tarifas de turno (RF-27, RF-28, RF-30, RF-31).';
comment on table turnos is 'Turnos de cancha. Entidad central del sistema.';
comment on table estados_turno is 'Historial combinado de transiciones del turno: foto de (ciclo de vida, pago).';
comment on table valores_cuota is 'Historial de tarifas de cuota (RF-29, RF-30, RF-31).';
comment on table cuotas is 'Cuotas mensuales de socios (RF-20, RF-26).';
comment on table lineas_cuota is 'Pagos parciales de una cuota (RN-3).';
comment on table estados_cuota is 'Historial append-only de estados de la cuota (RF-32, RF-45).';
comment on table pagos_turno is 'Pagos de turnos (RF-19, RF-42).';
comment on table lineas_pago_turno is 'Detalle de un pago de turno.';
comment on table pagos_luz is 'Pagos del cargo de luz de un turno (RF-33, RF-44).';
comment on table luz is 'Configuracion vigente de iluminacion (costo y franja horaria).';
comment on table estados_luz is 'Historial de tarifas de luz (RF-30, RF-31).';

comment on column usuarios.password_hash is 'Hash de password (bcrypt/argon2). Mapea a Usuario.password del modelo de analisis.';
comment on column usuarios.estado_actual is 'Cache del ultimo estado. Fuente unica de estado del usuario, incluido el socio.';
comment on column socios.numero_socio is 'Clave de negocio del socio; en el diagrama de catedra era el OID.';
comment on column socios.usuario_id is 'Usuario asociado (0..1): unique garantiza un socio por usuario.';
comment on column usuarios_roles.fecha_fin is 'Null = rol vigente. Indice unico parcial: un solo rol vigente por usuario.';
comment on column canchas.superficie is 'Superficie estatica de la cancha (EstadoCancha.suelo en el diagrama).';
comment on column canchas.iluminacion is 'Indica si la cancha tiene iluminacion (dato estatico).';
comment on column canchas.estado_actual is 'Cache del ultimo estado operativo. Se escribe junto con estados_cancha.';
comment on column turnos.costo_turno_ns is 'Costo del turno para no socios, congelado al momento de la reserva.';
comment on column turnos.requiere_luz is 'Indica si el turno requiere luz y, por lo tanto, cargo adicional.';
comment on column turnos.valor_turno_id is 'Tarifa de turno aplicada a la reserva (snapshot via FK).';
comment on column turnos.estado_actual is 'Cache del ultimo estado del ciclo de vida. Invariante: se actualiza en la misma transaccion que estados_turno y solo a traves del metodo unico de transicion de estado.';
comment on column turnos.estado_pago is 'Cache del ultimo estado de pago. Misma invariante que estado_actual.';
comment on column cuotas.estado_actual is 'Cache del ultimo estado de la cuota. Se escribe junto con estados_cuota.';
comment on column lineas_cuota.numero_linea is 'Clave de negocio de la linea; el PK real es id (UUID).';
comment on column valores_turno.fecha_cambio is 'Fecha de vigencia de la tarifa; vigente = mayor fecha_cambio <= now().';
comment on column valores_cuota.fecha_cambio is 'Fecha de vigencia de la tarifa; vigente = mayor fecha_cambio <= now().';
comment on column luz.costo_x_hora is 'Costo por hora de luz vigente (configuracion actual).';
comment on column estados_luz.fecha is 'Fecha de vigencia de la tarifa de luz; vigente = mayor fecha <= now().';
comment on column pagos_luz.id_pago_luz is 'PK propia. Corrige la colision del diagrama, que usaba idLineaTurnoPago como OID.';

-- ----------------------------------------------------------------------------
-- Notas de diseno (ver docs/DB-SCHEMA.md)
--
-- 1. Patron historial + cache (EstadoUsuario, EstadoCuota, EstadoCancha,
--    EstadoTurno): la tabla de historial es append-only y la entidad principal
--    tiene una columna de estado corriente (estado_actual / estado_pago).
--    Invariante: historia y cache se escriben en la misma transaccion y el
--    estado solo se muta a traves de un unico metodo de transicion de estado
--    del caso de uso. Nunca por asignacion directa.
--
-- 2. Turno: el enum de catedra EstadoTurno mezclaba ciclo de vida y pago. Se
--    separo en estado_turno (confirmado, cancelado, iniciado, finalizado,
--    no_asistio) y estado_pago (impago, pago). estados_turno guarda la foto
--    combinada de ambos despues de cada transicion; una transicion puede
--    cambiar uno o ambos ejes.
--
-- 3. Tarifa vigente: select * from valores_turno where fecha_cambio <= now()
--    order by fecha_cambio desc limit 1; analogo para valores_cuota y
--    estados_luz.
--
-- 4. RN-1 (cancelacion hasta 1 hora antes), RN-2 (maximo 2 turnos por dia),
--    RN-9 (tope por deuda), RN-10 (admin sin limite) y RN-11 (anticipacion
--    maxima) viven en la capa de aplicacion. El esquema solo aporta los
--    indices necesarios; no se crean entidades para estas reglas.
--
-- 5. La validacion de superposicion entre turnos de 90 y 60 minutos no se
--    expresa como constraint (requeriria EXCLUDE con btree_gist); se resuelve
--    en el servicio de reservas dentro de una transaccion. La unique
--    (cancha_id, fecha, hora_inicio) solo evita choques exactos de inicio.
--
-- 6. RLS: no se habilita en esta migracion. La API accede con service role.
--    Cuando se habilite RLS, definir policies por rol de aplicacion; como no
--    hay Supabase Auth, auth.uid() no aplica y el contexto de usuario debe
--    viajar por claims propios del JWT o SET LOCAL.
-- ----------------------------------------------------------------------------
