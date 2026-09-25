# AdmCanchasTenis — Domain Model (diagrama de análisis, pág. 18)

> Fuente: diagrama de clases de análisis del PDF de cátedra, transcripto por módulo.
> Este es el modelo de **análisis**, no el schema final de DB. El código, identifiers y UI copy se mantienen en inglés; este documento de equipo está en español neutro/profesional.

## 1. Users y Roles

| Clase | Atributos | Notas |
|---|---|---|
| **Usuario** | id (OID), username, password, email, nombre, apellido, telefono, dni | Clase base de todo actor del sistema |
| **Socio** | numeroSocio (OID), fechaAlta, estado | Asociado a Usuario (0..1) |
| **EstadoUsuario** | idEstado (OID), fechaHora, valor | Historial de estados del usuario |
| **EstadoUsuario.valor** *(enum)* | activo, moroso, suspendido, inactivo | — |
| **Rol** | idRol (OID), nombre | — |
| **Rol.nombre** *(enum)* | Admin, Socio, No socio | — |
| **UsuarioRol** | fechaInicio, fechaFin | Clase asociativa Usuario↔Rol (permite historial de roles) |

## 2. Cuotas

| Clase | Atributos | Notas |
|---|---|---|
| **Cuota** | idCuota (OID), fechaInicio, fechaVencimiento, montoTotal | Pertenece a un Socio |
| **LineaCuota** | numeroLinea (OID), fechaPago, monto, estado | Permite pagos parciales de una Cuota |
| **ValorCuota** | idCosto (OID), precio, fechaCambio | Historial de tarifas de cuota |
| **EstadoCuota** | idEstado (OID), fechaHora, valorEstado | Historial de estados de una Cuota |
| **EstadoCuota.valorEstado** *(enum)* | pendiente, pagada, pagada parcial, adeudada, cancelada | — |

## 3. Turnos

| Clase | Atributos | Notas |
|---|---|---|
| **Turno** | idTurno (OID), fecha, horaInicio, horaFin, costoTurnoNS, estadoActual | Entidad central del sistema |
| **TipoTurno** | id, duracionMax | duracionMax en minutos (60/90) |
| **ValorTurno** | idCostoTurno (OID), costoXHora, fechaCambio | Historial de tarifas de turno |
| **EstadoTurno** | idEstadoTurno (OID), valorEstado, fechaYHora | Historial de estados de un Turno |
| **EstadoTurno.valorEstado** *(enum)* | Confirmado, Cancelado, Iniciado, Finalizado, No Asistió, Impago, Pago | — |
| **PagoTurno** | idPagoTurno (OID), montoTotTurno, fechaPago | Pago de un turno (no socio) |
| **LineasTurnoPago** | idLineaTurnoPago (OID), montoTurnoPago | Detalle/líneas del PagoTurno |

## 4. Canchas y Luz

| Clase | Atributos | Notas |
|---|---|---|
| **Cancha** | idCancha (OID), nroCancha | — |
| **EstadoCancha** | idDato (OID), iluminacion, fechaCambio, Descripcion, valorState | Historial de estado de una Cancha |
| **EstadoCancha.suelo** *(enum)* | Dura, Polvo de Ladrillo, Césped | Tipo de superficie |
| **EstadoCancha.valorState** *(enum)* | Disponible, En Mantenimiento, Inhabilitada | Estado operativo |
| **Luz** | idLuz (OID), costoXHora, fecha, franjaHorarioInicio, franjaHorarioFin | Config. de franja e iluminación |
| **EstadoLuz** | idEstado (OID), costoXHora, fecha | Historial de tarifa de luz |
| **PagoLuz** | idLineaTurnoPago (OID), montoTotalLuz, fechaPago | Pago del cargo de luz de un turno |

## 5. Configuración general

| Clase | Atributos | Notas |
|---|---|---|
| **RangoHorario** | id (OID), horaInicio, horaFin | Franja horaria genérica (apertura, iluminación, etc.) |
| **DiaFuncionamientoClub** | id (OID), diaSemana, habilitado | Días y horarios de funcionamiento del club |

## 6. Relaciones clave

- **Usuario** ↔ **Socio**: opcional (un usuario puede o no ser socio).
- **Usuario** ↔ **Rol**: many-to-many vía **UsuarioRol** (historial de cambios de rol, no solo el rol actual).
- Patrón **historial de estados** repetido en todo el modelo (EstadoUsuario, EstadoCuota, EstadoCancha, EstadoTurno) en vez de un simple campo enum — útil para trazabilidad y estadísticas (RF-32, RF-45).
- **Cuota** se compone de varias **LineaCuota** (pagos parciales, RN-3).
- **Turno** se asocia a una **Cancha**, un **TipoTurno** (duración), un **ValorTurno** (tarifa vigente) y opcionalmente a **Luz/EstadoLuz** si es turno nocturno.
- **PagoTurno** y **PagoLuz** son entidades de pago separadas, cada una con sus líneas de detalle.

## 7. Notas de arquitectura para el agente (aclaraciones del equipo)

1. **`Turno.estadoActual` (varchar) vs `EstadoTurno` (historial)**: es una desnormalización a propósito — el diagrama de secuencia de `CancelarTurno()` con su función auxiliar `calcularDiferenciaTiempo()` lo confirma: el estado actual se lee directo sin iterar el historial. Invariante a respetar en el diseño: `estadoActual` es un caché del último `EstadoTurno`; ambos se escriben en la misma transacción y solo se mutan vía un único método de transición de estado del Turno, nunca por asignación directa.
2. **Validación de RN-2 (2 turnos por día) y RN-9 (tope por deuda)**: no hay clase explícita y está bien que no la haya — va en la capa de aplicación, en el caso de uso de reserva (un `TurnoController`/`booking service` que cuenta turnos del usuario por fecha y cuotas adeudadas antes de confirmar). No crear una entidad para esto.
3. **Posible typo del diagrama**: `PagoLuz` usa `idLineaTurnoPago` como OID — colisiona con `LineasTurnoPago`. Al pasar al diseño, darle OID propio (`idPagoLuz`).
4. **`EstadoTurno.valorEstado` mezcla ciclo de vida con pago** (Confirmado/Cancelado/Iniciado/Finalizado/No Asistió vs Impago/Pago). En el diseño conviene separar `lifecycle state` de `payment status` para evitar combinaciones inválidas.
5. **`EstadoCancha.suelo` (superficie) es un dato estático de la cancha**, no un estado histórico — en el diseño va como atributo de `Cancha`, no del historial.
6. **Verificación de pagos**: los comprobantes llegan por WhatsApp y el admin registra pagos ya verificados (RF-19, RF-21, RF-33). El modelo no tiene estado de verificación en los pagos — decisión consciente: el sistema registra lo que el admin carga; no hay pasarela de pago.
7. **Costo operativo del patrón historial**: cada lectura de "estado actual" resuelve el último registro — compensado en los paths calientes con el caché `estadoActual` (punto 1). En Postgres esto se implementa con history tables + columnas de estado corriente escritas en la misma transacción.
