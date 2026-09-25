# AdmCanchasTenis

Tennis court administration monorepo: a minimal NestJS API and a React + Vite web app, with shared TypeScript types.

## Structure

- `apps/api` — NestJS (TypeScript) API. Serves `GET /health` returning `{ "status": "ok" }` on port 3000.
- `apps/web` — React 18 + Vite + TypeScript landing page. Shows the project name and links to the API health endpoint.
- `packages/shared` — Shared TypeScript types (e.g. `HealthResponse`).

npm workspaces are configured at the root (`apps/*`, `packages/*`).

## Prerequisites

- Node 24 (see `.nvmrc`)
- npm 12+

Install Node 24 per OS:

- **Linux / WSL / macOS**: use [nvm](https://github.com/nvm-sh/nvm) — `nvm install` followed by `nvm use` (both read `.nvmrc`).
- **Windows**: use [nvm-windows](https://github.com/coreybutler/nvm-windows) (`nvm install 24`, `nvm use 24`) or [Volta](https://volta.sh/) (`volta install node@24`).

`.gitattributes` enforces LF line endings so Windows and WSL checkouts produce the same diffs. On WSL, keep the repo inside the Linux filesystem (e.g. `~/projects`), not under `/mnt/c`.

## Install

```bash
npm install
```

## Run (dev)

API (port 3000):

```bash
npm run dev:api
```

Web (port 5173):

```bash
npm run dev:web
```

Check health: `curl http://localhost:3000/health` should return `{"status":"ok"}`.

## Build

```bash
npm run build
```

This runs the `build` script in every workspace (`shared` typechecks, `api` emits to `dist/`, `web` emits to `dist/`).

## Database (Prisma)

`apps/api` uses Prisma ORM v7 with the `@prisma/adapter-pg` driver adapter. Two connection strings are required in `apps/api/.env` (see `apps/api/.env.example`):

- `DATABASE_URL` — pooled connection (Supabase transaction-mode pooler, pgbouncer) used by the runtime client.
- `DIRECT_URL` — direct/session connection used by the Prisma CLI (migrations, introspection, Studio) through `apps/api/prisma.config.ts`.

Generate the typed client into `apps/api/src/generated/prisma` (gitignored, regenerated on demand):

```bash
npm run db:generate --workspace=api
```

Migration commands use `DIRECT_URL` via `prisma.config.ts`: `npm run db:pull --workspace=api`, `npm run db:status --workspace=api`, `npm run db:studio --workspace=api`. The build pipeline runs `db:generate` before compiling the API.
