# ADR-0004: Historial append-only + caché de estado actual

- **Estado**: Aceptada
- **Fecha**: 2026-09-25

## Contexto

DOMINIO.md (notas 1 y 7) exige trazabilidad completa de cambios de estado para estadísticas (RF-32, RF-45) y, a la vez, lecturas rápidas del estado actual en paths calientes (agenda, tablero de morosidad, cancelación). El diagrama de cátedra ya repite el patrón `EstadoX` en cuatro entidades (usuario, cuota, cancha, turno).

## Decisión

Cada entidad con ciclo de vida tiene:

- Una tabla de historial **append-only** (`estados_usuario`, `estados_cuota`, `estados_cancha`, `estados_turno`) que nunca se actualiza ni se borra.
- Columnas de estado corriente en la entidad principal (`estado_actual`; en turnos además `estado_pago`) que actúan como caché del último registro.
- Un único método de transición en el servicio: inserta el historial y actualiza el caché **en la misma transacción**. Nunca hay asignación directa de `estado_actual`.
- En turnos, cada fila del historial guarda la foto combinada `(valor_estado, valor_estado_pago)`.

## Alternativas consideradas

- **Solo columna enum (sin historial)**: descartada. Sin historial no hay estadísticas históricas ni auditoría de cuándo y por qué cambió un estado.
- **Solo historial (leer siempre el último registro)**: descartada. Cada lectura de estado recorre y ordena el historial; en agenda y listados es un costo innecesario (DB-SCHEMA §7).
- **Triggers de base de datos**: descartada. La lógica de negocio vive en la API (NestJS) para mantenerla testeable; los triggers ocultos dificultan el debug y la cátedra evalúa el flujo de aplicación.

## Consecuencias

Positivas:

- Lecturas de estado actual O(1) sobre la entidad; historial completo para reportes.
- Transiciones auditables con motivo (`estados_turno.motivo`, `estados_cancha.motivo`).

Negativas:

- Doble escritura por transición.
- Si se actualiza `estado_actual` saltándose el método único, el caché y el historial divergen (mitigado con revisión y con los comentarios de la migración).
- Más tablas y joins en reportes.
