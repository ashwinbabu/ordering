-- Reliability backbone for the notification dispatcher: a pg_cron sweep
-- every minute. The database (notifications.events / notifications.deliveries)
-- is the source of truth, not the cron invocation -- a missed run just means
-- the next run processes the backlog via notifications_claim_events /
-- notifications_claim_deliveries's own eligibility windows.
--
-- No pg_net "AFTER INSERT nudge" trigger is added here (deliberately deferred
-- -- see the project notes). pg_net is used only for this cron sweep's own
-- outbound HTTP call, which is the standard documented pattern for invoking
-- an Edge Function from Postgres.
--
-- The dispatcher-auth secret is read from Vault at call time, never
-- hardcoded here (see notifications.settings.dispatcher_auth_secret_id,
-- provisioned out-of-band in a non-migration statement).

create extension if not exists pg_cron;
create extension if not exists pg_net;

select
  cron.schedule(
    'notification-dispatcher-sweep',
    '* * * * *',
    $$
    select net.http_post(
      url := 'https://qzdpohytpvjkidxgvzkd.supabase.co/functions/v1/notification-dispatcher',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-notification-dispatcher-key', (
          select secret.decrypted_secret
          from vault.decrypted_secrets as secret
          join notifications.settings as settings
            on settings.dispatcher_auth_secret_id = secret.id
          where settings.id = true
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 25000
    );
    $$
  )
where not exists (
  select 1 from cron.job where jobname = 'notification-dispatcher-sweep'
);
