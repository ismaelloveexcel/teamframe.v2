# Deploying TeamFrame to Vercel

You need two deployments:
1. **Frontend** — the TeamFrame UI you interact with (mockup-sandbox)
2. **Backend** — the API server that stores your data (api-server)

Plus one database: **Neon** (free PostgreSQL, works directly with Vercel).

---

## Step 1 — Create a Neon database (free)

1. Go to [neon.tech](https://neon.tech) and sign up (free tier is sufficient)
2. Create a new project — name it `teamframe`
3. Copy the connection string. It looks like:
   ```
   postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
4. Keep this — you will need it in both deployments

---

## Step 2 — Apply the database schema

Before deploying, apply the schema to your Neon database.

On your local machine (requires Node.js):

```bash
cd /workspace
DATABASE_URL="your-neon-connection-string" pnpm --filter @workspace/db push
```

This creates all the tables TeamFrame needs. Run it once.

---

## Step 3 — Deploy the Backend (API Server)

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **Add New Project**
3. Import this GitHub repository
4. **IMPORTANT — Configure these settings:**
   - Root Directory: `artifacts/api-server`
   - Framework Preset: Other
   - Build Command: `node ./build.mjs`
   - Output Directory: `dist`
   - Install Command: `cd ../.. && pnpm install --frozen-lockfile`

5. Add these environment variables:
   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Your Neon connection string from Step 1 |
   | `NODE_ENV` | `production` |

6. Click **Deploy**
7. Once deployed, copy the URL — it will look like `https://teamframe-api-xxx.vercel.app`

---

## Step 4 — Deploy the Frontend

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import the same GitHub repository (create a second project)
3. **IMPORTANT — Configure these settings:**
   - Root Directory: ` ` (leave blank — use repository root)
   - Framework Preset: Other
   - Build Command: (leave blank — uses `vercel.json` at root)
   - Output Directory: `artifacts/mockup-sandbox/dist`

4. Add these environment variables:
   | Variable | Value |
   |---|---|
   | `VITE_API_BASE_URL` | Your API URL from Step 3 (e.g. `https://teamframe-api-xxx.vercel.app`) |
   | `BASE_PATH` | `/` |

5. Click **Deploy**
6. Once deployed, you will have a URL like `https://teamframe-xxx.vercel.app`

---

## Step 5 — Access TeamFrame

Open your browser and go to:

```
https://teamframe-xxx.vercel.app/preview/teamframe/TeamFrame
```

This is the TeamFrame application. If the API URL is configured correctly, you will see the live system connected to your Neon database.

If the API is not reachable, TeamFrame falls back to **demo mode** — a read-only local simulation. You will see a yellow "Demo mode" badge in the sidebar.

---

## Running the Simulation

Once deployed and connected:

1. Open TeamFrame at `/preview/teamframe/TeamFrame`
2. The org chart will be empty on first load
3. Expand "Structure controls" to create your first position
4. Follow the production readiness checklist in `docs/go-to-market/production-readiness-checklist.md`

All changes made through the UI will be stored in your Neon database and will persist across sessions.

---

## Troubleshooting

**"Demo mode" badge appears (amber, in sidebar)**
The frontend cannot reach the API. Check:
- `VITE_API_BASE_URL` is set correctly in the frontend Vercel project
- The API deployment succeeded (visit the API URL + `/api/healthz` — should return `{"status":"ok"}`)

**API deployment fails**
- Check that `DATABASE_URL` is set in the backend Vercel project
- Check the Vercel build logs for the specific error

**Changes don't save**
TeamFrame is in demo mode. See "Demo mode badge appears" above.

**Schema error / table not found**
Run Step 2 (schema push) again against your Neon database.

---

## Environment Variables Reference

### Backend (api-server)
| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Neon PostgreSQL connection string |
| `NODE_ENV` | Yes | Set to `production` |

### Frontend (mockup-sandbox)
| Variable | Required | Description |
|---|---|---|
| `VITE_API_BASE_URL` | Yes | Full URL of your deployed API server |
| `BASE_PATH` | Yes | Set to `/` |
