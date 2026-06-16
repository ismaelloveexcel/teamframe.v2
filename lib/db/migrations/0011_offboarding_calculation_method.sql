-- Phase 1 (Jurisdiction Packs) — Step 6: additive calculation_method column.
--
-- Records WHICH compliance provider produced an offboarding's gratuity:
--   'uae_eosg' — UAE end-of-service gratuity (the existing 21/30-day formula);
--   'manual'   — generic provider, no statutory calc (gratuity_amount stays NULL).
--
-- Purely additive + nullable: existing rows are untouched (NULL = legacy /
-- pre-provider record). No historical value changes.

ALTER TABLE hr_offboarding ADD COLUMN IF NOT EXISTS calculation_method text;
