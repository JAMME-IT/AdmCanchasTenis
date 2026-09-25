# ADR-0005: Sin Docker por ahora

- **Estado**: Aceptada
- **Fecha**: 2026-09-25

## Contexto

El equipo son 5 integrantes: 1 trabaja en WSL y 4 en Windows. El stack es Node (`.nvmrc` con Node 24, `engines` en `package.json`) y la base de datos está hosteada (ADR-0002). No hay servicios locales que orquestar. Docker en Windows/WSL agrega instalación, licencias (Docker Desktop), problemas de I/O y permisos, sin un beneficio inmediato.

## Decisión

No dockerizar en v1. Armonizar el entorno con:

- `.nvmrc` (Node 24) y `engines` en `package.json`.
- `.gitattributes` con `* text=auto eol=lf` para evitar problemas de fin de línea entre Windows y Linux.
- CI en Ubuntu (`.github/workflows/ci.yml`) que corre `npm ci` y `npm run build` en cada push y PR.
- Base de datos hosteada, sin contenedor local.

Docker queda como opción si aparece dolor real (por ejemplo, una base local para tests de integración). La decisión es reversible.

## Alternativas consideradas

- **Docker Compose con Postgres + API + web**: descartada por ahora. Requiere Docker Desktop o motor en cada máquina, suma una capa de red y volúmenes, y no resuelve nada que la base hosteada no resuelva; la curva de aprendizaje no aporta a la cátedra.
- **Dev Containers**: descartada. Acopla el flujo al editor (VS Code) y repite el costo de Docker; 4 de 5 integrantes no lo usan.
- **Nada (sin armonización)**: descartada. Sin `.nvmrc`, `.gitattributes` y CI, los problemas de versión de Node y de fin de línea aparecen en el primer merge desde Windows.

## Consecuencias

Positivas:

- Cero instalación extra; onboarding con `npm install`.
- CI barato y rápido que detecta diferencias Windows/Linux antes de `main`.

Negativas:

- Las diferencias entre sistemas no quedan cubiertas del todo (case sensitivity de paths, scripts de shell, tests que necesiten base local).
- Si se necesita una base local o un entorno reproducible para tests de integración, habrá que introducir Docker después; la migración no es traumática porque el stack ya es Node + PostgreSQL portable.
