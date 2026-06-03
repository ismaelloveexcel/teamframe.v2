# AGENTS.md

## Cursor Cloud specific instructions

### Stack overview

pnpm workspace monorepo (Node.js **24**, pnpm via corepack). Primary runnable artifacts:

| Service | Package | Port | Required env |
|---------|---------|------|----------------|
| API server | `@workspace/api-server` | 8080 | `PORT=8080` |
| Mockup / component preview (Vite) | `@workspace/mockup-sandbox` | 8081 | `PORT=8081`, `BASE_PATH=/__mockup` |
| PostgreSQL (local dev) | — | 5432 | `DATABASE_URL` (see below) |

See `replit.md` for canonical run commands and `artifacts/*/.replit-artifact/artifact.toml` for per-service env defaults.

### Node and pnpm

Use Node 24 (`nvm use 24` after sourcing `~/.nvm/nvm.sh`). Enable pnpm with `corepack enable` and `corepack prepare pnpm@10.12.1 --activate`. The root `preinstall` script rejects npm/yarn.

### PostgreSQL

Schema push expects Postgres running and `DATABASE_URL` set. Local Cloud VM setup uses:

`postgresql://workspace:workspace@localhost:5432/workspace`

Start Postgres if needed: `sudo pg_ctlcluster 16 main start`

Push schema: `pnpm --filter @workspace/db run push` (not part of VM update script).

### Running dev servers

Use **tmux** for long-running processes (API rebuilds on each `dev` start).

```bash
# API
export PORT=8080 NODE_ENV=development
pnpm --filter @workspace/api-server run dev

# Mockup sandbox
export PORT=8081 BASE_PATH=/__mockup NODE_ENV=development
pnpm --filter @workspace/mockup-sandbox run dev
```

Mockup previews: `http://localhost:8081/__mockup/preview/<path>` (e.g. `teamframe/TeamFrame`). API health: `http://localhost:8080/api/healthz`.

### Verify / build

- Typecheck (all packages): `pnpm run typecheck`
- API build: `pnpm --filter @workspace/api-server run build`
- Mockup production build requires the same `PORT` and `BASE_PATH` as dev (see `artifact.toml`)

There is no root ESLint script; `pnpm run typecheck` is the main static check.

### Gotchas

- `pnpm run build` at the repo root fails for mockup-sandbox unless `PORT` and `BASE_PATH` are exported (vite.config reads them at config load time).
- API `dev` runs `build` then `start` on every launch (~1–2s esbuild).
- `@workspace/db` is only required when adding DB-backed routes; current API routes are health-only.
