create or replace function public.notifications_get_order_context (
  p_order_id uuid
)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
declare
  v_order ordering.orders%rowtype;
  v_business core.businesses%rowtype;
  v_location core.business_locations%rowtype;
  v_customer core.customers%rowtype;
  v_items jsonb;
  v_payment jsonb;
  v_refund_total numeric;
  v_refund_status text;
  v_staff_group notifications.telegram_destinations%rowtype;
  v_owners jsonb;
  v_notify_owner_on_cancellation boolean;
begin
  if not (select private.request_is_service_role()) then
    raise exception using errcode = '42501', message = 'service role required';
  end if;

  select o.* into v_order from ordering.orders o where o.id = p_order_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'order not found';
  end if;

  select b.* into v_business from core.businesses b where b.id = v_order.business_id;
  select l.* into v_location from core.business_locations l where l.id = v_order.location_id;

  if v_order.customer_id is not null then
    select c.* into v_customer from core.customers c where c.id = v_order.customer_id;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'productName', oi.product_name,
    'quantity', oi.quantity,
    'baseUnitPrice', oi.base_unit_price::text,
    'modifierUnitTotal', oi.modifier_unit_total::text,
    'finalUnitPrice', oi.final_unit_price::text,
    'lineTotal', oi.line_total::text,
    'customerNote', oi.customer_note,
    'options', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'optionGroupName', oio.option_group_name,
        'optionName', oio.option_name,
        'priceDelta', oio.price_delta::text,
        'quantity', oio.quantity
      ) order by oio.option_group_name, oio.option_name), '[]'::jsonb)
      from ordering.order_item_options oio
      where oio.order_item_id = oi.id
    )
  ) order by oi.created_at), '[]'::jsonb)
  into v_items
  from ordering.order_items oi
  where oi.order_id = v_order.id;

  select jsonb_build_object(
    'status', p.status,
    'method', p.method,
    'amount', p.amount::text,
    'paidAt', p.paid_at
  )
  into v_payment
  from ordering.payments p
  where p.order_id = v_order.id
  order by p.created_at desc
  limit 1;

  select coalesce(sum(r.amount) filter (where r.status = 'completed'), 0)
  into v_refund_total
  from ordering.refunds r
  where r.order_id = v_order.id;

  select r.status into v_refund_status
  from ordering.refunds r
  where r.order_id = v_order.id
  order by r.created_at desc
  limit 1;

  select * into v_staff_group
  from notifications.telegram_destinations d
  where d.business_id = v_order.business_id
    and d.location_id = v_order.location_id
    and d.destination_type = 'staff_group'
    and d.is_active
  limit 1;

  select coalesce(jsonb_agg(jsonb_build_object('chatId', d.telegram_chat_id)), '[]'::jsonb)
  into v_owners
  from notifications.telegram_destinations d
  join core.business_users bu on bu.id = d.business_user_id
  where d.destination_type = 'business_user'
    and d.is_active
    and bu.business_id = v_order.business_id
    and bu.is_active
    and bu.role in ('owner', 'admin');

  select bp.notify_owner_on_cancellation into v_notify_owner_on_cancellation
  from notifications.business_preferences bp where bp.business_id = v_order.business_id;

  return jsonb_build_object(
    'order', jsonb_build_object(
      'id', v_order.id,
      'orderNumber', v_order.order_number,
      'businessId', v_order.business_id,
      'locationId', v_order.location_id,
      'customerId', v_order.customer_id,
      'fulfillmentType', v_order.fulfillment_type,
      'status', v_order.status,
      'paymentStatus', v_order.payment_status,
      'paymentMethod', v_order.payment_method,
      'currency', v_order.currency,
      'foodSubtotal', v_order.food_subtotal::text,
      'discountTotal', v_order.discount_total::text,
      'taxTotal', v_order.tax_total::text,
      'deliveryFee', v_order.delivery_fee::text,
      'grandTotal', v_order.grand_total::text,
      'customerNameSnapshot', v_order.customer_name_snapshot,
      'customerPhoneSnapshot', v_order.customer_phone_snapshot,
      'deliveryAddressSnapshot', v_order.delivery_address_snapshot,
      'customerNote', v_order.customer_note,
      'placedAt', v_order.placed_at,
      'acceptedAt', v_order.accepted_at,
      'outForDeliveryAt', v_order.out_for_delivery_at,
      'deliveredAt', v_order.delivered_at,
      'cancelledAt', v_order.cancelled_at,
      'cancelReason', v_order.cancel_reason,
      'estimatedDeliveryMinutes', v_order.estimated_delivery_minutes,
      'couponCodeSnapshot', v_order.coupon_code_snapshot,
      'couponDiscountAmount', v_order.coupon_discount_amount::text
    ),
    'items', v_items,
    'business', jsonb_build_object(
      'id', v_business.id,
      'name', v_business.name,
      'logoUrl', v_business.logo_url,
      'timezone', v_business.timezone,
      'currency', v_business.currency
    ),
    'location', jsonb_build_object(
      'id', v_location.id,
      'name', v_location.name,
      'phone', v_location.phone,
      'addressLine', nullif(trim(both ', ' from
        coalesce(v_location.address_line_1, '') ||
        case when v_location.address_line_2 is not null and v_location.address_line_2 <> ''
          then ', ' || v_location.address_line_2 else '' end ||
        ', ' || coalesce(v_location.city, '')
      ), ''),
      'storefrontDomain', v_location.storefront_domain
    ),
    'customer', case when v_customer.id is null then null else jsonb_build_object(
      'id', v_customer.id,
      'email', v_customer.email,
      'displayName', v_customer.display_name
    ) end,
    'payment', v_payment,
    'refundFacts', jsonb_build_object(
      'paymentTaken', (v_payment is not null and (v_payment->>'status') = 'paid'),
      'refundedAmount', v_refund_total::text,
      'latestRefundStatus', v_refund_status
    ),
    'telegram', jsonb_build_object(
      'staffGroup', case when v_staff_group.id is null then null else jsonb_build_object(
        'chatId', v_staff_group.telegram_chat_id,
        'chatTitle', v_staff_group.telegram_chat_title
      ) end,
      'businessOwners', v_owners
    ),
    'preferences', jsonb_build_object(
      'notifyOwnerOnCancellation', coalesce(v_notify_owner_on_cancellation, false)
    )
  );
end;
$function$;

grant execute on function "public"."notifications_get_order_context"(uuid) to "postgres", "service_role";

revoke all on function "public"."notifications_get_order_context"(uuid) from public;
