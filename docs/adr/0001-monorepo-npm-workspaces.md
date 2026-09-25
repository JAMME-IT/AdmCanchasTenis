# ADR-0001: Monorepo unico con npm workspaces

- **Estado**: Aceptada
- **Fecha**: 2026-09-25

## Contexto

El proyecto de catedra (Habilitación Profesional) lo desarrollan 5 integrantes y requiere un frontend React + Vite, una API NestJS y tipos compartidos entre ambos. El equipo necesita baja fricción de coordinación (un `npm install`, un pipeline de CI) y mantener el contrato API/web sincronizado. La organización ya tiene repositorios separados por aplicación, pero este es un entregable unico de cátedra.

## Decisión

Un unico repositorio `AdmCanchasTenis` con npm workspaces:

- `apps/api` (NestJS), `apps/web` (React + Vite) y `packages/shared` (tipos compartidos).
- Scripts en la raíz: `dev:api`, `dev:web`, `build` (corre en todos los workspaces).
- Un solo `package-lock.json` y una sola versión de Node (`.nvmrc`).

## Alternativas consideradas

- **Repos separados (como los de la organización)**: descartada. Obliga a publicar/consumir `shared` como paquete versionado, duplica CI y suma fricción de coordinación para un equipo de 5 en un proyecto acotado.
- **Nx o Turborepo**: descartada. Su valor (task graph, cache remoto, generadores) no se justifica con 3 workspaces; agrega curva de aprendizaje y una capa de configuración que la cátedra no pide.

## Consecuencias

Positivas:

- Tipos compartidos sin publicar paquetes; el contrato API/web cambia en un solo commit.
- Un unico `npm install` y un unico CI (build de todos los workspaces).
- Onboarding simple: `npm install`, `npm run dev:api`, `npm run dev:web`.

Negativas:

- `npm run build` compila todo aunque se toque un solo workspace (sin cache de tareas).
- Los workspaces comparten lockfile y versión de dependencias; un upgrade conflictivo afecta a todos.
