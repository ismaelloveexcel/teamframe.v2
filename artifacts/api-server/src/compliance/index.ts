// Phase 1 (Jurisdiction Packs) — compliance module barrel + company resolution.

import { eq } from "drizzle-orm";
import { companiesTable, db } from "@workspace/db";
import type { ComplianceProvider } from "./provider.js";
import { resolveProvider } from "./registry.js";

export * from "./provider.js";
export { resolveProvider } from "./registry.js";

/** Resolve the compliance provider for a company by looking up its jurisdiction. */
export async function resolveProviderForCompany(companyId: string): Promise<ComplianceProvider> {
  const [company] = await db
    .select({ jurisdiction: companiesTable.jurisdiction })
    .from(companiesTable)
    .where(eq(companiesTable.id, companyId));
  return resolveProvider(company?.jurisdiction ?? null);
}
