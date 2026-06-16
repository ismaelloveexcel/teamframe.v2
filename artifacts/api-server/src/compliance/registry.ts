// Phase 1 (Jurisdiction Packs) — provider registry.
//
// resolveProvider is the ONLY place a jurisdiction string is mapped to a
// provider. The rule is deliberately strict: ONLY "AE"/"UAE" (case-insensitive,
// trimmed) resolve to the UAE provider. Everything else — "MU","UK","FR","ZA",
// null, "UNKNOWN", anything — resolves to the GenericComplianceProvider. No
// silent legal assumptions.

import type { ComplianceProvider } from "./provider.js";
import { GenericComplianceProvider } from "./providers/generic.js";
import { UaeComplianceProvider } from "./providers/uae.js";

const uae = new UaeComplianceProvider();
const generic = new GenericComplianceProvider();

const UAE_ALIASES = new Set(["AE", "UAE"]);

export function resolveProvider(jurisdiction: string | null | undefined): ComplianceProvider {
  const key = (jurisdiction ?? "").trim().toUpperCase();
  if (UAE_ALIASES.has(key)) return uae;
  return generic;
}
