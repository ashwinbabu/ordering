-- Recreate the source project's application-owned Storage foundation.
-- Storage object files are intentionally transferred separately; this migration
-- creates only buckets and access policies.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('admin-order-sounds', 'admin-order-sounds', true, null, null),
  ('alarm-sounds', 'alarm-sounds', true, null, null),
  ('business-logos', 'business-logos', true, 5242880, array['image/png', 'image/jpeg', 'image/webp']),
  ('catalog-product-images', 'catalog-product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('product-images', 'product-images', true, 5242880, array['image/png', 'image/jpeg'])
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "business_logos_owners_admins_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'business-logos'
  and (
    select private.can_manage_sensitive_business_configuration(
      (storage.foldername(objects.name))[1]::uuid
    )
  )
);

create policy "business_logos_owners_admins_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'business-logos'
  and (
    select private.can_manage_sensitive_business_configuration(
      (storage.foldername(objects.name))[1]::uuid
    )
  )
)
with check (
  bucket_id = 'business-logos'
  and (
    select private.can_manage_sensitive_business_configuration(
      (storage.foldername(objects.name))[1]::uuid
    )
  )
);

create policy "business_logos_owners_admins_write"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'business-logos'
  and (
    select private.can_manage_sensitive_business_configuration(
      (storage.foldername(objects.name))[1]::uuid
    )
  )
);

create policy "business_logos_public_read"
on storage.objects
for select
to public
using (bucket_id = 'business-logos');

create policy "catalog managers can delete product images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'catalog-product-images'
  and array_length(storage.foldername(name), 1) = 4
  and private.can_manage_catalog(
    case
      when (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
        then (storage.foldername(name))[1]::uuid
      else null
    end
  )
  and private.can_manage_catalog_at_location(
    case
      when (storage.foldername(name))[2] ~ '^[0-9a-fA-F-]{36}$'
        then (storage.foldername(name))[2]::uuid
      else null
    end
  )
  and exists (
    select 1
    from core.business_locations as location
    where location.id = case
      when (storage.foldername(location.name))[2] ~ '^[0-9a-fA-F-]{36}$'
        then (storage.foldername(location.name))[2]::uuid
      else null
    end
      and location.business_id = case
        when (storage.foldername(location.name))[1] ~ '^[0-9a-fA-F-]{36}$'
          then (storage.foldername(location.name))[1]::uuid
        else null
      end
      and location.is_active
  )
);

create policy "catalog managers can upload product images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'catalog-product-images'
  and array_length(storage.foldername(name), 1) = 4
  and private.can_manage_catalog(
    case
      when (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
        then (storage.foldername(name))[1]::uuid
      else null
    end
  )
  and private.can_manage_catalog_at_location(
    case
      when (storage.foldername(name))[2] ~ '^[0-9a-fA-F-]{36}$'
        then (storage.foldername(name))[2]::uuid
      else null
    end
  )
  and exists (
    select 1
    from core.business_locations as location
    where location.id = case
      when (storage.foldername(location.name))[2] ~ '^[0-9a-fA-F-]{36}$'
        then (storage.foldername(location.name))[2]::uuid
      else null
    end
      and location.business_id = case
        when (storage.foldername(location.name))[1] ~ '^[0-9a-fA-F-]{36}$'
          then (storage.foldername(location.name))[1]::uuid
        else null
      end
      and location.is_active
  )
);
