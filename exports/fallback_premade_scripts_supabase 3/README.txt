Supabase-Compatible Fallback Script Export

Target table: public.civic_example_templates

Files:
1) civic_example_templates.clean.json
2) civic_example_templates.clean.csv
3) upsert_civic_example_templates.sql

Compatibility cleanup applied:
- template_asks normalized to snake_case enum values
- primary_ask normalized to allowed check-constraint values
- jsonb fields serialized correctly
- display_order populated
- total rows: 23
