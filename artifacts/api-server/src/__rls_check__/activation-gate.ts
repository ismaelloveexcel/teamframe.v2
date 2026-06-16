import { randomUUID, createHash } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import bcrypt from "bcrypt";
import {
  accountActivationTokensTable,
  companiesTable,
  db,
  hrAuditLogTable,
  hrEmployeesTable,
  membershipsTable,
  pool,
  usersTable,
} from "@workspace/db";
import { invite } from "../services/hr-employee-service.js";

/**
 * Activation gate (Prompt: HR backend prereqs).
 *
 * Proves the full employee credential-activation flow:
 *   1. invite() returns a plaintext activation token (only the hash is stored).
 *   2. activate sets password + status='active' and consumes the token.
 *   3. re-activating the same token fails (single-use).
 *   4. login then succeeds with the chosen password.
 *   5. a second invite to the SAME email returns a 409 (EmailConflictError).
 *
 * Activation + lookup go through the SECURITY DEFINER get_activation_by_token_hash
 * exactly like the route, with NO tenant context.
 */

const PASSWORD = "Activate-Me-123!";

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/** Replicates the POST /auth/activate transaction so the gate exercises the
 *  same SECURITY DEFINER path + single-use consume logic without HTTP. */
async function activate(token: string, password: string): Promise<"ok" | "consumed" | "expired" | "invalid"> {
  const tokenHash = sha256(token);
  const lookup = await pool.query<{
    token_id: string;
    user_id: string;
    expires_at: string;
    consumed_at: string | null;
    user_status: string;
  }>("SELECT * FROM get_activation_by_token_hash($1)", [tokenHash]);

  if (lookup.rows.length === 0) return "invalid";
  const row = lookup.rows[0];
  if (row.consumed_at !== null) return "consumed";
  if (new Date(row.expires_at).getTime() <= Date.now()) return "expired";

  const passwordHash = await bcrypt.hash(password, 12);
  let consumedOk = true;
  await db.transaction(async (tx) => {
    const consumed = await tx
      .update(accountActivationTokensTable)
      .set({ consumedAt: new Date() })
      .where(
        and(
          eq(accountActivationTokensTable.id, row.token_id),
          isNull(accountActivationTokensTable.consumedAt),
        ),
      )
      .returning();
    if (consumed.length === 0) {
      consumedOk = false;
      return;
    }
    await tx
      .update(usersTable)
      .set({ passwordHash, status: "active", updatedAt: new Date() })
      .where(eq(usersTable.id, row.user_id));
  });
  return consumedOk ? "ok" : "consumed";
}

/** Replicates POST /auth/login's credential check via SECURITY DEFINER. */
async function login(email: string, password: string): Promise<boolean> {
  const result = await pool.query<{ password_hash: string | null; status: string }>(
    "SELECT * FROM get_user_by_email($1)",
    [email.toLowerCase()],
  );
  if (result.rows.length === 0) return false;
  const row = result.rows[0];
  if (row.status === "inactive" || !row.password_hash) return false;
  return bcrypt.compare(password, row.password_hash);
}

async function main() {
  const companyId = randomUUID();
  await db
    .insert(companiesTable)
    .values({ id: companyId, name: "Activation Gate Co", jurisdiction: "UAE", currency: "AED" });

  let [actor] = await db.select().from(usersTable).limit(1);
  if (!actor) {
    [actor] = await db
      .insert(usersTable)
      .values({ email: `actgate-${companyId}@test.internal`, status: "active" })
      .returning();
  }
  const actorId = actor.id;

  const empEmail = `activate-${companyId}@co.test`;
  const emp = await db
    .insert(hrEmployeesTable)
    .values({
      companyId,
      employeeNo: "EACT1",
      firstName: "Act",
      lastName: "User",
      companyEmail: empEmail,
      createdBy: actorId,
      updatedBy: actorId,
    })
    .returning()
    .then((r) => r[0]);

  // 1. invite -> plaintext token returned, only hash stored
  const inviteRes = await invite(companyId, actorId, emp.id);
  const tokenReturned = !!inviteRes?.activationToken;
  const invitedUserId = inviteRes!.userId;

  const [storedTok] = await db
    .select()
    .from(accountActivationTokensTable)
    .where(eq(accountActivationTokensTable.userId, invitedUserId));
  const hashOnlyStored =
    !!storedTok &&
    storedTok.tokenHash === sha256(inviteRes!.activationToken) &&
    storedTok.tokenHash !== inviteRes!.activationToken &&
    storedTok.consumedAt === null;

  // 2. activate -> sets password + active + consumes token
  const activateResult = await activate(inviteRes!.activationToken, PASSWORD);
  const [userAfter] = await db.select().from(usersTable).where(eq(usersTable.id, invitedUserId));
  const [tokAfter] = await db
    .select()
    .from(accountActivationTokensTable)
    .where(eq(accountActivationTokensTable.id, storedTok.id));
  const activated =
    activateResult === "ok" &&
    userAfter.status === "active" &&
    !!userAfter.passwordHash &&
    tokAfter.consumedAt !== null;

  // 3. re-activate same token -> fails (single use)
  const reactivate = await activate(inviteRes!.activationToken, "different-pw-999");
  const singleUse = reactivate === "consumed";

  // 4. login now succeeds with chosen password
  const loginOk = await login(empEmail, PASSWORD);

  // 5. duplicate-email invite -> 409 (EmailConflictError)
  const emp2 = await db
    .insert(hrEmployeesTable)
    .values({
      companyId,
      employeeNo: "EACT2",
      firstName: "Dup",
      lastName: "Email",
      companyEmail: empEmail, // same email as emp1's invited user
      createdBy: actorId,
      updatedBy: actorId,
    })
    .returning()
    .then((r) => r[0]);

  let duplicate409 = false;
  try {
    await invite(companyId, actorId, emp2.id);
  } catch (err) {
    duplicate409 = err instanceof Error && err.name === "EmailConflictError";
  }

  console.log("=== Activation Gate ===");
  console.log(`invite returns plaintext token -> ${tokenReturned ? "PASS" : "FAIL"}`);
  console.log(`only sha256 hash stored (not plaintext), unconsumed -> ${hashOnlyStored ? "PASS" : "FAIL"}`);
  console.log(`activate sets password+active+consumes token -> ${activated ? "PASS" : "FAIL"}`);
  console.log(`re-activate same token fails (single-use) -> ${singleUse ? "PASS" : "FAIL"}`);
  console.log(`login succeeds after activation -> ${loginOk ? "PASS" : "FAIL"}`);
  console.log(`duplicate-email invite returns 409 (EmailConflictError) -> ${duplicate409 ? "PASS" : "FAIL"}`);

  // cleanup
  await db.delete(accountActivationTokensTable).where(eq(accountActivationTokensTable.userId, invitedUserId));
  await db.delete(hrAuditLogTable).where(eq(hrAuditLogTable.companyId, companyId));
  await db.delete(hrEmployeesTable).where(eq(hrEmployeesTable.companyId, companyId));
  await db.delete(membershipsTable).where(eq(membershipsTable.userId, invitedUserId));
  await db.delete(usersTable).where(eq(usersTable.id, invitedUserId));
  await db.delete(companiesTable).where(eq(companiesTable.id, companyId));

  const ok = tokenReturned && hashOnlyStored && activated && singleUse && loginOk && duplicate409;
  console.log(ok ? "=== Activation gate PASSED ===" : "=== Activation gate FAILED ===");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
