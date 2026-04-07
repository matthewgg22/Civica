-- Upsert civic example script cards from a JSON array payload.
-- Usage:
-- 1) Replace the JSON inside $JSON$...$JSON$ below with your full array.
-- 2) Run this script in Supabase SQL Editor.
-- 3) Review the verification queries at the end.

begin;

do $$
begin
  if to_regclass('public.civic_example_templates') is null then
    raise exception 'Missing table public.civic_example_templates. Run migration 20260329_add_civic_example_templates.sql first.';
  end if;
end
$$;

with payload as (
  select
    -- Replace [] with your script payload array.
    (
      $JSON$
      []
      $JSON$
    )::jsonb as data
),
rows as (
  select
    nullif(trim(t.issue_id), '') as issue_id,
    nullif(trim(t.slug), '') as slug,
    nullif(trim(t.title), '') as title,
    nullif(trim(t.category), '') as category,
    t.target_chambers,
    lower(nullif(trim(t.primary_ask), '')) as primary_ask,
    nullif(trim(t.summary), '') as summary,
    t.related_bills,
    t.template_asks,
    nullif(trim(t.live_script), '') as live_script,
    nullif(trim(t.voicemail_script), '') as voicemail_script,
    nullif(trim(t.supporter_variant), '') as supporter_variant,
    nullif(trim(t.undecided_variant), '') as undecided_variant,
    nullif(trim(t.staffer_variant), '') as staffer_variant,
    nullif(trim(t.voicemail_footer), '') as voicemail_footer,
    t.placeholders,
    t.tags,
    coalesce(t.is_active, true) as is_active,
    t.starts_at,
    t.ends_at,
    coalesce(t.display_order, 100) as display_order
  from payload p
  cross join jsonb_to_recordset(p.data) as t(
    issue_id text,
    slug text,
    title text,
    category text,
    target_chambers jsonb,
    primary_ask text,
    summary text,
    related_bills jsonb,
    template_asks jsonb,
    live_script text,
    voicemail_script text,
    supporter_variant text,
    undecided_variant text,
    staffer_variant text,
    voicemail_footer text,
    placeholders jsonb,
    tags jsonb,
    is_active boolean,
    starts_at timestamptz,
    ends_at timestamptz,
    display_order integer
  )
),
normalized as (
  select
    issue_id,
    coalesce(slug, issue_id) as slug,
    coalesce(title, issue_id) as title,
    coalesce(category, 'General') as category,
    case
      when jsonb_typeof(target_chambers) = 'array' and jsonb_array_length(target_chambers) > 0 then target_chambers
      else '["house","senate"]'::jsonb
    end as target_chambers,
    coalesce(
      primary_ask,
      'support'
    ) as primary_ask,
    coalesce(summary, 'No summary provided.') as summary,
    case
      when jsonb_typeof(related_bills) = 'array' then related_bills
      else '[]'::jsonb
    end as related_bills,
    case
      when jsonb_typeof(template_asks) = 'array' and jsonb_array_length(template_asks) > 0 then template_asks
      else jsonb_build_array(coalesce(primary_ask, 'support'))
    end as template_asks,
    coalesce(live_script, 'Hi, I am a constituent in [ZIP]. I am calling about [BILL_OR_RESOLUTION].') as live_script,
    coalesce(voicemail_script, 'Hi, constituent in [ZIP] calling about [BILL_OR_RESOLUTION]. Thank you.') as voicemail_script,
    supporter_variant,
    undecided_variant,
    staffer_variant,
    voicemail_footer,
    case
      when jsonb_typeof(placeholders) = 'array' and jsonb_array_length(placeholders) > 0 then placeholders
      else '["[YOUR_NAME]","[CITY]","[ZIP]","[FULL_ADDRESS]","[OFFICIAL_TITLE]","[OFFICIAL_LAST]","[BILL_OR_RESOLUTION]"]'::jsonb
    end as placeholders,
    case
      when jsonb_typeof(tags) = 'array' then tags
      else '[]'::jsonb
    end as tags,
    is_active,
    starts_at,
    ends_at,
    display_order
  from rows
  where issue_id is not null
)
insert into public.civic_example_templates (
  issue_id,
  slug,
  title,
  category,
  target_chambers,
  primary_ask,
  summary,
  related_bills,
  template_asks,
  live_script,
  voicemail_script,
  supporter_variant,
  undecided_variant,
  staffer_variant,
  voicemail_footer,
  placeholders,
  tags,
  is_active,
  starts_at,
  ends_at,
  display_order,
  updated_at,
  created_at
)
select
  issue_id,
  slug,
  title,
  category,
  target_chambers,
  primary_ask,
  summary,
  related_bills,
  template_asks,
  live_script,
  voicemail_script,
  supporter_variant,
  undecided_variant,
  staffer_variant,
  voicemail_footer,
  placeholders,
  tags,
  is_active,
  starts_at,
  ends_at,
  display_order,
  now(),
  now()
from normalized
on conflict (issue_id) do update set
  slug = excluded.slug,
  title = excluded.title,
  category = excluded.category,
  target_chambers = excluded.target_chambers,
  primary_ask = excluded.primary_ask,
  summary = excluded.summary,
  related_bills = excluded.related_bills,
  template_asks = excluded.template_asks,
  live_script = excluded.live_script,
  voicemail_script = excluded.voicemail_script,
  supporter_variant = excluded.supporter_variant,
  undecided_variant = excluded.undecided_variant,
  staffer_variant = excluded.staffer_variant,
  voicemail_footer = excluded.voicemail_footer,
  placeholders = excluded.placeholders,
  tags = excluded.tags,
  is_active = excluded.is_active,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  display_order = excluded.display_order,
  updated_at = now();

commit;

-- Verification #1: count + order
select
  count(*) as total_templates,
  count(*) filter (where is_active) as active_templates
from public.civic_example_templates;

select issue_id, display_order, title
from public.civic_example_templates
where is_active = true
order by display_order, updated_at desc
limit 50;

-- Verification #2: ZIP placeholder health
-- Good rows should usually include [ZIP] in one or both script fields.
select
  issue_id,
  (live_script ilike '%[ZIP]%') as live_has_zip,
  (voicemail_script ilike '%[ZIP]%') as voicemail_has_zip,
  (live_script ilike '%[ZIPCODE]%' or voicemail_script ilike '%[ZIPCODE]%') as has_bad_zip_token
from public.civic_example_templates
where is_active = true
order by display_order;

-- Optional cleanup if any rows still use [ZIPCODE]:
-- update public.civic_example_templates
-- set
--   live_script = replace(live_script, '[ZIPCODE]', '[ZIP]'),
--   voicemail_script = replace(voicemail_script, '[ZIPCODE]', '[ZIP]'),
--   updated_at = now()
-- where live_script ilike '%[ZIPCODE]%' or voicemail_script ilike '%[ZIPCODE]%';
