-- save_business_settings is a SECURITY INVOKER RPC that checks whether an
-- omitted delivery zone is referenced by an order. Give only authenticated
-- owner/admin members the row access required for that integrity check.

grant select on table ordering.orders to authenticated;

create policy orders_select_settings_managers
on ordering.orders
for select
to authenticated
using (
  (select private.can_manage_sensitive_location_configuration(location_id))
);
