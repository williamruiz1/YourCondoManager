-- Maps onboarding (Phase 1): add latitude/longitude to associations
-- Both nullable — existing associations without a mapped address remain valid.
ALTER TABLE associations
  ADD COLUMN IF NOT EXISTS latitude_deg  DECIMAL(10, 7),
  ADD COLUMN IF NOT EXISTS longitude_deg DECIMAL(10, 7);
