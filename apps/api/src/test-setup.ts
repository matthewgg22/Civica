// Stub Supabase env vars so the singleton in lib/supabase.ts doesn't throw
// "supabaseUrl is required" when imported during tests.
process.env['SUPABASE_URL'] ??= 'https://test.supabase.co';
process.env['SUPABASE_SERVICE_ROLE_KEY'] ??= 'test-service-role-key';
process.env['SUPABASE_ANON_KEY'] ??= 'test-anon-key';
