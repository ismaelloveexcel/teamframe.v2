/**
 * Seed script for RLS gate testing.
 * Creates Company A, Company B, User A (admin of A), User B (employee of B).
 *
 * Usage:
 *   DATABASE_URL="..." pnpm --filter @workspace/db run seed-rls
 */

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import bcrypt from "bcrypt";
import {
  usersTable,
  companiesTable,
  membershipsTable,
  sessionsTable,
} from "./schema/index.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const seedPool = new Pool({ connectionString: process.env.DATABASE_URL });
const seedDb = drizzle(seedPool, {
  schema: { usersTable, companiesTable, membershipsTable, sessionsTable },
});

async function seed() {
  console.log("Seeding RLS test data...");

  const SALT_ROUNDS = 10;
  const hashA = await bcrypt.hash("passwordA123", SALT_ROUNDS);
  const hashB = await bcrypt.hash("passwordB123", SALT_ROUNDS);

  // Clean existing seed data
  await seedPool.query(
    "DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email IN ('admin-a@seed.internal','emp-b@seed.internal'))",
  );
  await seedPool.query(
    "DELETE FROM memberships WHERE user_id IN (SELECT id FROM users WHERE email IN ('admin-a@seed.internal','emp-b@seed.internal'))",
  );
  await seedPool.query(
    "DELETE FROM users WHERE email IN ('admin-a@seed.internal', 'emp-b@seed.internal')",
  );
  await seedPool.query(
    "DELETE FROM companies WHERE name IN ('Seed Company A', 'Seed Company B')",
  );

  const [compA] = await seedDb
    .insert(companiesTable)
    .values({ name: "Seed Company A", currency: "USD", jurisdiction: "US" })
    .returning();

  const [compB] = await seedDb
    .insert(companiesTable)
    .values({ name: "Seed Company B", currency: "AED", jurisdiction: "UAE" })
    .returning();

  const [userA] = await seedDb
    .insert(usersTable)
    .values({
      email: "admin-a@seed.internal",
      passwordHash: hashA,
      status: "active",
      updatedAt: new Date(),
    })
    .returning();

  const [userB] = await seedDb
    .insert(usersTable)
    .values({
      email: "emp-b@seed.internal",
      passwordHash: hashB,
      status: "active",
      updatedAt: new Date(),
    })
    .returning();

  await seedDb.insert(membershipsTable).values({
    userId: userA.id,
    companyId: compA.id,
    role: "admin",
  });

  await seedDb.insert(membershipsTable).values({
    userId: userB.id,
    companyId: compB.id,
    role: "employee",
  });

  const tokenA = "seed-token-a-" + Date.now();
  const tokenB = "seed-token-b-" + Date.now();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await seedDb.insert(sessionsTable).values({
    userId: userA.id,
    token: tokenA,
    companyId: compA.id,
    expiresAt,
  });

  await seedDb.insert(sessionsTable).values({
    userId: userB.id,
    token: tokenB,
    companyId: compB.id,
    expiresAt,
  });

  console.log("\nSeeded:");
  console.log(`  Company A: ${compA.id} (${compA.name})`);
  console.log(`  Company B: ${compB.id} (${compB.name})`);
  console.log(`  User A (admin of A): ${userA.id}`);
  console.log(`    email: admin-a@seed.internal / password: passwordA123`);
  console.log(`    token: ${tokenA}`);
  console.log(`  User B (employee of B): ${userB.id}`);
  console.log(`    email: emp-b@seed.internal / password: passwordB123`);
  console.log(`    token: ${tokenB}`);
  console.log("\nDone.");

  await seedPool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
