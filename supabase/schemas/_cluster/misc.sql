select cron.schedule_in_database('daily-sales-summary-sweep', '*/15 * * * *', 'select private.capture_daily_sales_summary_notification_events();', 'postgres', null, true);

select cron.schedule_in_database('notification-dispatcher-sweep', '* * * * *', '
    select net.http_post(
      url := ''https://qzdpohytpvjkidxgvzkd.supabase.co/functions/v1/notification-dispatcher'',
      headers := jsonb_build_object(
        ''Content-Type'', ''application/json'',
        ''x-notification-dispatcher-key'', (
          select secret.decrypted_secret
          from vault.decrypted_secrets as secret
          join notifications.settings as settings
            on settings.dispatcher_auth_secret_id = secret.id
          where settings.id = true
        )
      ),
      body := ''{}''::jsonb,
      timeout_milliseconds := 25000
    );
    ', 'postgres', null, true);

select cron.schedule_in_database('waiting-order-events-sweep', '* * * * *', 'select private.capture_waiting_order_notification_events();', 'postgres', null, true);
