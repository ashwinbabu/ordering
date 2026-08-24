create function ordering.save_menu_changes_with_baseline(
  p_business_id uuid,
  p_location_id uuid,
  p_baseline jsonb,
  p_menu jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform ordering.save_menu_changes(
    p_business_id,
    p_location_id,
    p_baseline,
    p_menu
  );

  return jsonb_build_object(
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', category.id,
        'updated_at', category.updated_at
      ) order by category.sort_order, category.id)
      from ordering.menu_categories as category
      where category.business_id = p_business_id
        and category.location_id = p_location_id
    ), '[]'::jsonb),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', product.id,
        'updated_at', product.updated_at
      ) order by product.sort_order, product.id)
      from ordering.products as product
      join ordering.menu_categories as category
        on category.id = product.category_id
       and category.business_id = product.business_id
      where product.business_id = p_business_id
        and category.location_id = p_location_id
        and product.is_active
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function ordering.save_menu_changes_with_baseline(uuid, uuid, jsonb, jsonb) from public;
grant execute on function ordering.save_menu_changes_with_baseline(uuid, uuid, jsonb, jsonb) to authenticated;
