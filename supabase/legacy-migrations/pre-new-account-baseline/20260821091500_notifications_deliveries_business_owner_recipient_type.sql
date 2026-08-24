-- Fix: business_owners recipient resolution produces recipient_type =
-- 'business_owner', but the CHECK constraint was never widened for it (only
-- 'staff_group' was added in the earlier Telegram migration). Every
-- business_owners-fanned event (order.waiting_8m, store.paused/resumed,
-- order.cancelled with the owner toggle on) was failing to plan until this.

alter table notifications.deliveries drop constraint deliveries_recipient_type_check;
alter table notifications.deliveries add constraint deliveries_recipient_type_check
  check (recipient_type in ('customer', 'business_user', 'location_admins', 'email', 'staff_group', 'business_owner'));
