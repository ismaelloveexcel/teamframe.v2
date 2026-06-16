import { AsyncLocalStorage } from "node:async_hooks";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

type DB = NodePgDatabase<typeof schema>;

const defaultDb: DB = drizzle(pool, { schema });

/**
 * Request-scoped tenant context. When a request runs inside runWithTenant(),
 * every query issued through the exported `db` is routed onto a dedicated
 * connection that has `app.company_id` set, so Postgres RLS scopes it to that
 * tenant. Outside a tenant scope (gates, identity resolution before login),
 * `db` falls back to the shared pool.
 *
 * NOTE: RLS only actually constrains the connection when DATABASE_URL points at
 * a NOBYPASSRLS role (app_user) in production. The app code also filters every
 * query by companyId, so RLS is defence-in-depth, not the only guard.
 */
const tenantStore = new AsyncLocalStorage<{ db: DB }>();

function activeDb(): DB {
  return tenantStore.getStore()?.db ?? defaultDb;
}

export const db: DB = new Proxy(defaultDb, {
  get(_target, prop) {
    const current = activeDb();
    const value = Reflect.get(current, prop, current);
    return typeof value === "function" ? value.bind(current) : value;
  },
}) as DB;

/**
 * Run `fn` with all `db` access scoped to the given company via a dedicated
 * connection carrying the `app.company_id` GUC. The connection is reset and
 * released when `fn` settles.
 */
export async function runWithTenant<T>(
  companyId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("SELECT set_config('app.company_id', $1, false)", [companyId]);
    const scoped = drizzle(client, { schema });
    return await tenantStore.run({ db: scoped }, fn);
  } finally {
    await client.query("RESET app.company_id").catch(() => {});
    client.release();
  }
}

export * from "./schema";
