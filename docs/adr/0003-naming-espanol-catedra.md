# ADR-0003: Nombres de dominio en español de cátedra (DB y API)

- **Estado**: Aceptada
- **Fecha**: 2026-09-25

## Contexto

`docs/DOMINIO.md` y `docs/DB-SCHEMA.md` derivan del diagrama de clases de la cátedra, con nombres de dominio en español (Usuario, Turno, Cuota, Cancha). La trazabilidad entre documento de cátedra, esquema y contrato HTTP es un objetivo de evaluación. La convención general del equipo mantiene código, identifiers técnicos y UI copy en inglés.

## Decisión

El **dominio** se nombra en español de cátedra de punta a punta:

- Tablas y columnas en `snake_case` español en la base.
- Campos JSON en `camelCase` español en la API (`canchaId`, `horaInicio`, `numeroSocio`).
- Entidades del modelo TS del backend con el mismo vocabulario.
- Sin acentos en identificadores (convención de DB-SCHEMA §1).

El código de infraestructura (clases de NestJS, servicios, componentes) y la UI copy se mantienen en inglés.

## Alternativas consideradas

- **Dominio en inglés** (`Court`, `Booking`, `MonthlyFee`): descartada por decisión del equipo. Duplica el vocabulario de la cátedra y agrega un mapeo mental en cada revisión del PDF.
- **Español solo en documentos, inglés en DB/API**: descartada. Genera deriva entre lo documentado y lo implementado; mantener dos glosarios cuesta más de lo que aporta.

## Consecuencias

Positivas:

- Trazabilidad 1:1 entre DOMINIO.md, DB-SCHEMA.md y API-CONTRATO.md.
- La cátedra lee el modelo en su idioma; menos ambigüedad al revisar RF y RN.

Negativas:

- Mezcla de idiomas en el repo (código en inglés / dominio en español).
- Fricción futura si el proyecto se internacionaliza o se abre a colaboradores externos: renombrar tablas, columnas y API es costoso.
