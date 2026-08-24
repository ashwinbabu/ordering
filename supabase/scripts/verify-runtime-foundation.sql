-- Read-only verification for a managed Supabase target after the Storage
-- foundation migration has been applied. Run this after enabling pg_net and
-- pg_cron in the target project; cron jobs themselves are verified after data
-- and Vault configuration are imported.

with expected_extensions(name) as (
  values
    ('pgcrypto'),
    ('pg_stat_statements'),
    ('pg_net'),
    ('supabase_vault'),
    ('uuid-ossp'),
    ('pg_cron')
),
expected_buckets(id) as (
  values
    ('admin-order-sounds'),
    ('alarm-sounds'),
    ('business-logos'),
    ('catalog-product-images'),
    ('product-images')
),
expected_policies(name) as (
  values
    ('business_logos_owners_admins_delete'),
    ('business_logos_owners_admins_update'),
    ('business_logos_owners_admins_write'),
    ('business_logos_public_read'),
    ('catalog managers can delete product images'),
    ('catalog managers can upload product images')
)
select
  'extension' as object_type,
  expected_extensions.name as object_name,
  case when extension.extname is null then 'missing' else 'present' end as status
from expected_extensions
left join pg_extension as extension on extension.extname = expected_extensions.name

union all

select
  'storage_bucket' as object_type,
  expected_buckets.id as object_name,
  case when bucket.id is null then 'missing' else 'present' end as status
from expected_buckets
left join storage.buckets as bucket on bucket.id = expected_buckets.id

union all

select
  'storage_policy' as object_type,
  expected_policies.name as object_name,
  case when policy.policyname is null then 'missing' else 'present' end as status
from expected_policies
left join pg_policies as policy
  on policy.schemaname = 'storage'
  and policy.tablename = 'objects'
  and policy.policyname = expected_policies.name

order by object_type, object_name;
