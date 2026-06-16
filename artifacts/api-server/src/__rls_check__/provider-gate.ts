import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { companiesTable, db } from "@workspace/db";
import { resolveProvider, resolveProviderForCompany } from "../compliance/index.js";
import { computeEosg } from "../services/hr-offboarding-service.js";

async function main() {
  // ── resolveProvider mapping (the ONLY jurisdiction->provider map) ──────────
  const uaeKeys = ["AE", "UAE", "ae", "uae", " Uae "];
  const genericKeys = ["MU", "UK", "FR", "ZA", null, undefined, "UNKNOWN", "", "AED"];
  const passUaeMap = uaeKeys.every((k) => resolveProvider(k).jurisdiction === "UAE");
  const passGenericMap = genericKeys.every((k) => resolveProvider(k as string | null).jurisdiction === "GENERIC");

  // ── AE company: leave types include hajj; EOSG equals current impl ─────────
  const aeId = randomUUID();
  await db.insert(companiesTable).values({ id: aeId, name: "AE Co", jurisdiction: "AE", currency: "AED" });
  const aeProvider = await resolveProviderForCompany(aeId);
  const aeTypes = (await aeProvider.getLeaveTypes(aeId)).map((t) => t.code);
  const passAeHajj = aeTypes.includes("hajj") && aeTypes.includes("annual");

  // KNOWN INPUT: basic 1,000,000 (minor units), 3 years service.
  const inputs = { basicMonthlyPay: 1_000_000, joinDate: "2021-01-01", exitDate: "2024-01-01" };
  const expected = computeEosg(inputs); // canonical UAE formula
  const aeCalc = aeProvider.calculateOffboarding(inputs);
  const passAeEosg =
    aeCalc.calculationMethod === "uae_eosg" &&
    aeCalc.gratuityAmount === expected.gratuityAmount &&
    aeCalc.gratuityAmount === 2_071_233; // exact, asserted

  // ── MU company: no hajj; gratuity null + method manual ─────────────────────
  const muId = randomUUID();
  await db.insert(companiesTable).values({ id: muId, name: "MU Co", jurisdiction: "MU", currency: "MUR" });
  const muProvider = await resolveProviderForCompany(muId);
  const muTypes = (await muProvider.getLeaveTypes(muId)).map((t) => t.code);
  const passMuTypes = !muTypes.includes("hajj") && muTypes.includes("annual") && muTypes.includes("sick") && muTypes.includes("unpaid");
  const muCalc = muProvider.calculateOffboarding(inputs);
  const passMuCalc = muCalc.gratuityAmount === null && muCalc.calculationMethod === "manual";

  // ── null-jurisdiction company: also generic ────────────────────────────────
  const nullId = randomUUID();
  await db.insert(companiesTable).values({ id: nullId, name: "Null Co", jurisdiction: null, currency: "USD" });
  const nullProvider = await resolveProviderForCompany(nullId);
  const nullTypes = (await nullProvider.getLeaveTypes(nullId)).map((t) => t.code);
  const nullCalc = nullProvider.calculateOffboarding(inputs);
  const passNull = !nullTypes.includes("hajj") && nullCalc.gratuityAmount === null && nullCalc.calculationMethod === "manual";

  console.log("=== Provider Gate (Phase 1) ===");
  console.log(`resolveProvider AE/UAE/case -> uae -> ${passUaeMap ? "PASS" : "FAIL"}`);
  console.log(`resolveProvider MU/UK/FR/ZA/null/UNKNOWN -> generic -> ${passGenericMap ? "PASS" : "FAIL"}`);
  console.log(`AE getLeaveTypes includes hajj -> ${passAeHajj ? "PASS" : "FAIL"} (${aeTypes.join(",")})`);
  console.log(`AE EOSG == computeEosg, exact 2,071,233 -> ${passAeEosg ? "PASS" : "FAIL"} (${aeCalc.gratuityAmount})`);
  console.log(`MU no hajj; {annual,sick,unpaid} present -> ${passMuTypes ? "PASS" : "FAIL"} (${muTypes.join(",")})`);
  console.log(`MU calc gratuity null + manual -> ${passMuCalc ? "PASS" : "FAIL"} (${muCalc.gratuityAmount}/${muCalc.calculationMethod})`);
  console.log(`null-jurisdiction -> generic (no hajj, null/manual) -> ${passNull ? "PASS" : "FAIL"}`);

  // cleanup
  await db.delete(companiesTable).where(eq(companiesTable.id, aeId));
  await db.delete(companiesTable).where(eq(companiesTable.id, muId));
  await db.delete(companiesTable).where(eq(companiesTable.id, nullId));

  const ok = passUaeMap && passGenericMap && passAeHajj && passAeEosg && passMuTypes && passMuCalc && passNull;
  console.log(ok ? "=== Provider gate PASSED ===" : "=== Provider gate FAILED ===");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
