-- Grant full table access to service_role on the snap_enrollment schema.
-- service_role bypasses RLS but still needs object-level privileges in
-- custom schemas (unlike public, these are not auto-granted).

grant all on all tables in schema snap_enrollment to service_role;
grant all on all sequences in schema snap_enrollment to service_role;
grant all on all routines in schema snap_enrollment to service_role;

-- Ensure future tables are also covered.
alter default privileges in schema snap_enrollment
  grant all on tables to service_role;
alter default privileges in schema snap_enrollment
  grant all on sequences to service_role;
