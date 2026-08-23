create table "ordering"."restaurant_settings" (
  "location_id"                      uuid                     not null,
  "ordering_enabled"                 boolean                  not null default false,
  "ordering_mode"                    text                     not null,
  "minimum_order_value"              numeric(14,2)            not null default 0,
  "accept_orders_when_closed"        boolean                  not null default false,
  "tax_mode"                         text                     not null,
  "tax_rate"                         numeric(7,4)             not null,
  "default_prep_minutes"             smallint                 not null,
  "currency"                         text                     not null,
  "aggregator_benchmark_rate"        numeric(7,4),
  "skrowia_commission_rate"          numeric(7,4)             not null,
  "created_at"                       timestamp with time zone not null default now(),
  "updated_at"                       timestamp with time zone not null default now(),
  "cash_on_delivery_enabled"         boolean                  not null default true,
  "online_payments_enabled"          boolean                  not null default false,
  "default_payment_method"           text                     not null default 'cash'::text,
  "new_order_alert_duration_seconds" smallint                 not null default 7,
  constraint "restaurant_settings_aggregator_benchmark_rate_check"
    check (((aggregator_benchmark_rate IS NULL) OR ((aggregator_benchmark_rate >= (0)::numeric) AND (aggregator_benchmark_rate <= (100)::numeric)))),
  constraint "restaurant_settings_currency_check" check ((currency ~ '^[A-Z]{3}$'::text)),
  constraint "restaurant_settings_default_payment_enabled_check"
    check ((((default_payment_method = 'cash'::text) AND cash_on_delivery_enabled) OR ((default_payment_method = 'online'::text) AND online_payments_enabled))),
  constraint "restaurant_settings_default_payment_method_check" check ((default_payment_method = ANY (ARRAY['cash'::text, 'online'::text]))),
  constraint "restaurant_settings_default_prep_minutes_check" check (((default_prep_minutes >= 1) AND (default_prep_minutes <= 1440))),
  constraint "restaurant_settings_location_id_fkey" foreign key (location_id) references core.business_locations(id) on delete cascade,
  constraint "restaurant_settings_minimum_order_value_check" check ((minimum_order_value >= (0)::numeric)),
  constraint "restaurant_settings_new_order_alert_duration_seconds_check" check (((new_order_alert_duration_seconds >= 1) AND (new_order_alert_duration_seconds <= 60))),
  constraint "restaurant_settings_ordering_mode_check" check ((ordering_mode = ANY (ARRAY['delivery'::text, 'pickup'::text, 'both'::text]))),
  constraint "restaurant_settings_payment_methods_check" check ((cash_on_delivery_enabled OR online_payments_enabled)),
  constraint "restaurant_settings_pkey" primary key (location_id),
  constraint "restaurant_settings_skrowia_commission_rate_check" check (((skrowia_commission_rate >= (0)::numeric) AND (skrowia_commission_rate <= (100)::numeric))),
  constraint "restaurant_settings_tax_configuration_check"
    check
    ((((tax_mode = 'none'::text) AND (tax_rate = (0)::numeric)) OR ((tax_mode = ANY (ARRAY['inclusive'::text, 'exclusive'::text])) AND (tax_rate > (0)::numeric) AND (tax_rate <=
    (100)::numeric)))),
  constraint "restaurant_settings_tax_mode_check" check ((tax_mode = ANY (ARRAY['none'::text, 'inclusive'::text, 'exclusive'::text]))),
  constraint "restaurant_settings_updated_at_check" check ((updated_at >= created_at))
);

alter table "ordering"."restaurant_settings"
  enable row level security;

create trigger restaurant_settings_10_enforce_identity
  before update on ordering.restaurant_settings
  for each row
  execute function private.enforce_phase_c_identity();

create trigger restaurant_settings_90_set_updated_at
  before update on ordering.restaurant_settings
  for each row
  execute function private.set_updated_at();

create trigger restaurant_settings_capture_notification
  after update of ordering_enabled on ordering.restaurant_settings
  for each row
  when ((old.ordering_enabled IS DISTINCT FROM new.ordering_enabled))
  execute function private.capture_notification_event_from_ordering_status_change();

create trigger restaurant_settings_ordering_status_broadcast
  after update of ordering_enabled on ordering.restaurant_settings
  for each row
  when ((old.ordering_enabled IS DISTINCT FROM new.ordering_enabled))
  execute function ordering.broadcast_ordering_status();

create policy "restaurant_settings_insert_owners_admins" on "ordering"."restaurant_settings"
  for insert
  to "authenticated"
  with check (( SELECT private.can_manage_sensitive_location_configuration(restaurant_settings.location_id) AS can_manage_sensitive_location_configuration));

create policy "restaurant_settings_select_owners_admins" on "ordering"."restaurant_settings"
  for select
  to "authenticated"
  using (( select private.can_manage_sensitive_location_configuration(restaurant_settings.location_id) as can_manage_sensitive_location_configuration));

create policy "restaurant_settings_update_owners_admins" on "ordering"."restaurant_settings"
  for update
  to "authenticated"
  using (( select private.can_manage_sensitive_location_configuration(restaurant_settings.location_id) as can_manage_sensitive_location_configuration))
  with check (( SELECT private.can_manage_sensitive_location_configuration(restaurant_settings.location_id) AS can_manage_sensitive_location_configuration));

grant insert, select, update on table "ordering"."restaurant_settings" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "ordering"."restaurant_settings" to "postgres", "service_role";

comment on table "ordering"."restaurant_settings" is 'Location ordering configuration; benchmark and commission fields are private.';
