# Deploying TeamFrame to Vercel

You need two deployments:
1. **Frontend** — the TeamFrame HR web app (`hr-web`)
2. **Backend** — the API server that stores your data (`api-server`)

Plus one database: **Neon** (free PostgreSQL, works directly with Vercel).

---

## Step 1 — Create a Neon database (free)

1. Go to [neon.tech](https://neon.tech) and sign up (free tier is sufficient)
2. Create a new project — name it `teamframe`
3. Copy the connection string. It looks like:
   ```
   postgresql://app_user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
4. Keep this — you will need it when deploying the backend

> **Security note**: The connection string must use the `app_user` role (NOBYPASSRLS), not a superuser. TeamFrame's Row-Level Security policies depend on this.

---

## Step 2 — Apply the database schema

Apply the migrations to your Neon database in order. Each file in `lib/db/migrations/` must be run once, in sequence.

Using `psql` with your Neon connection string:

```bash
for f in lib/db/migrations/0000_hr_tables.sql \
          lib/db/migrations/0001_rls_setup.sql \
          lib/db/migrations/0002_hr_audit_rls.sql \
          lib/db/migrations/0003_hr_domain_core.sql \
          lib/db/migrations/0004_hr_modules.sql \
          lib/db/migrations/0005_hr_reports.sql \
          lib/db/migrations/0006_auth_default_company.sql \
          lib/db/migrations/0007_harden_rls_nullif.sql \
          lib/db/migrations/0008_account_activation.sql \
          lib/db/migrations/0009_leave_types.sql \
          lib/db/migrations/0010_leave_type_code.sql \
          lib/db/migrations/0011_offboarding_calculation_method.sql; do
  psql "$DATABASE_URL" -f "$f"
done
```

Run each migration exactly once. Re-running migrations is not safe.

---

## Step 3 — Deploy the Backend (API Server)

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **Add New Project**
3. Import this GitHub repository
4. **IMPORTANT — Configure these settings:**
   - Root Directory: `artifacts/api-server`
   - Framework Preset: Other
   - Build Command: (leave blank — `vercel.json` in `artifacts/api-server` handles routing)
   - Install Command: `cd ../.. && pnpm install --frozen-lockfile`

5. Add these environment variables:
   | Variable | Required | Description |
   |---|---|---|
   | `DATABASE_URL` | Yes | Your Neon connection string (must use `app_user` role) |
   | `NODE_ENV` | Yes | Set to `production` |
   | `LOG_LEVEL` | No | Set to `info` (default) |

6. Click **Deploy**
7. Once deployed, copy the URL — it will look like `https://teamframe-api-xxx.vercel.app`
8. Verify the API is running: open `https://teamframe-api-xxx.vercel.app/api/healthz` — it should return `{"status":"ok"}`

---

## Step 4 — Deploy the Frontend

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import the same GitHub repository (create a second project)
3. **IMPORTANT — Configure these settings:**
   - Root Directory: ` ` (leave blank — use repository root)
   - Framework Preset: Other
   - Build Command: (leave blank — uses `vercel.json` at repository root)
   - Output Directory: `artifacts/hr-web/dist`

4. Add these environment variables:
   | Variable | Required | Description |
   |---|---|---|
   | `VITE_API_BASE_URL` | Yes | Full URL of your deployed API server from Step 3 (e.g. `https://teamframe-api-xxx.vercel.app`) |

5. Click **Deploy**
6. Once deployed, you will have a URL like `https://teamframe-xxx.vercel.app`

---

## Step 5 — Access TeamFrame

Open your browser and go to your frontend deployment URL:

```
https://teamframe-xxx.vercel.app
```

On first load you will be prompted to sign in. Use the bootstrap endpoint to create your first admin account before inviting team members:

```
POST https://teamframe-api-xxx.vercel.app/api/auth/bootstrap
```

Then sign in through the app and complete setup from there.

---

## Troubleshooting

**API returns 500 or connection errors**
- Verify `DATABASE_URL` is set in the backend Vercel project and uses the `app_user` role
- Confirm all 12 migrations (0000–0011) were applied in order
- Check the Vercel function logs for the specific error

**API deployment fails at build**
- Check that Root Directory is set to `artifacts/api-server` in the Vercel project settings
- Check the Vercel build logs for the specific error

**Frontend shows blank page or network errors**
- Verify `VITE_API_BASE_URL` is set in the frontend Vercel project (no trailing slash)
- Confirm the API deployment succeeded (visit the API URL + `/api/healthz`)

**Schema error / table not found**
- A migration may have been skipped. Check which tables exist in Neon and re-run any missing migrations.

---

## Environment Variables Reference

### Backend (`artifacts/api-server`)
| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Neon PostgreSQL connection string — must use `app_user` role (NOBYPASSRLS) |
| `NODE_ENV` | Yes | Set to `production` |
| `LOG_LEVEL` | No | Logging verbosity — `info`, `debug`, `warn`, or `error` |

### Frontend (`artifacts/hr-web`)
| Variable | Required | Description |
|---|---|---|
| `VITE_API_BASE_URL` | Yes | Full URL of deployed API server (no trailing slash) |
