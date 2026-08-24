create or replace function private.enforce_payment_identity()
  returns trigger
  language plpgsql
  set search_path to ''
  AS $function$
begin
  if new.id is distinct from old.id
     or new.order_id is distinct from old.order_id
     or new.business_id is distinct from old.business_id
     or new.provider is distinct from old.provider
     or new.amount is distinct from old.amount
     or new.currency is distinct from old.currency
     or new.created_at is distinct from old.created_at then
    raise exception using
      errcode = '23514',
      message = 'payment attempt identity, provider, and amount are immutable';
  end if;

  if old.status = 'paid' and new.status <> 'paid' then
    raise exception using errcode = '23514', message = 'paid payment cannot be downgraded';
  end if;

  return new;
end;
$function$;

grant execute on function "private"."enforce_payment_identity"() to "postgres";

revoke all on function "private"."enforce_payment_identity"() from public;
