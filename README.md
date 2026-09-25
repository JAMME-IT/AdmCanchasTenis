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
