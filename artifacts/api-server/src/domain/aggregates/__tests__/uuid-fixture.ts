import { createHash } from "node:crypto";

/**
 * Deterministic RFC-4122 v4-shaped UUID derived from a stable label.
 * Same label -> same UUID, so cross-referenced fixtures stay linked while
 * satisfying the isUuid() guard in assignment.ts / compensation.ts.
 */
export function uid(label: string): string {
  const h = createHash("sha256").update(label).digest("hex");
  const variant = ((parseInt(h[16]!, 16) & 0x3) | 0x8).toString(16);
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    `4${h.slice(13, 16)}`,            // version 4
    `${variant}${h.slice(17, 20)}`,   // variant 8/9/a/b
    h.slice(20, 32),
  ].join("-");
}
