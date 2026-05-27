-- public — Migration: feature_flags table (Session A — LPIE rule kill switch)
--
-- Lightweight server-side feature-flag store. Both the iOS app and the
-- TypeScript snap-rules engine read these flags via
-- GET /v1/enrollment/feature-flags before applying state-specific
-- overrides. Flipping `lpie_auto_exempt_enabled` to false instantly
-- reverts the LPIE half-time-degree exemption override on both surfaces
-- without redeploying code.
--
-- Schema lives in `public` (not snap_enrollment) so it can be read
-- without role escalation — the values themselves are non-sensitive
-- product config.

CREATE TABLE IF NOT EXISTS public.feature_flags (
  key         text        PRIMARY KEY,
  enabled     boolean     NOT NULL DEFAULT true,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Seed the LPIE override flag in the on position. Operators can flip it
-- off via the dashboard or `psql` if the override must be disabled.
INSERT INTO public.feature_flags (key, enabled)
VALUES ('lpie_auto_exempt_enabled', true)
ON CONFLICT (key) DO NOTHING;
