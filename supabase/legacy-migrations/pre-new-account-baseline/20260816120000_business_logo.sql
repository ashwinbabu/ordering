-- Restaurant logo: a public-read, owner/admin-writable image stored per
-- business. Objects are keyed by "<business_id>/<file>" so storage RLS can
-- scope writes to the same owner/admin membership check used elsewhere in
-- Business Settings, without a service-role edge function.

alter table core.businesses
  add column if not exists logo_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'business-logos',
  'business-logos',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists business_logos_public_read on storage.objects;
create policy business_logos_public_read
on storage.objects
for select
to public
using (bucket_id = 'business-logos');

drop policy if exists business_logos_owners_admins_write on storage.objects;
create policy business_logos_owners_admins_write
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'business-logos'
  and (select private.can_manage_sensitive_business_configuration(((storage.foldername(name))[1])::uuid))
);

drop policy if exists business_logos_owners_admins_update on storage.objects;
create policy business_logos_owners_admins_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'business-logos'
  and (select private.can_manage_sensitive_business_configuration(((storage.foldername(name))[1])::uuid))
)
with check (
  bucket_id = 'business-logos'
  and (select private.can_manage_sensitive_business_configuration(((storage.foldername(name))[1])::uuid))
);

drop policy if exists business_logos_owners_admins_delete on storage.objects;
create policy business_logos_owners_admins_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'business-logos'
  and (select private.can_manage_sensitive_business_configuration(((storage.foldername(name))[1])::uuid))
);
