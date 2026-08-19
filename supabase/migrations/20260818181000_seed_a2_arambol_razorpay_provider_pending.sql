-- Task 7: A2 Arambol Razorpay test configuration, left pending until real
-- Key Secret + webhook secret are supplied (see deployment notes). Vault
-- secrets and public_config.checkoutKey are added in a follow-up statement
-- once those values are provided - this migration only reserves the row.
insert into ordering.location_payment_providers (
  location_id,
  provider,
  auth_mode,
  environment,
  configuration_status,
  is_active,
  public_config
) values (
  '23ca53d8-5e39-42af-acfb-b2e5c50b3c8b',
  'razorpay',
  'api_key',
  'test',
  'pending',
  true,
  '{}'::jsonb
)
on conflict (location_id, provider) do nothing;
