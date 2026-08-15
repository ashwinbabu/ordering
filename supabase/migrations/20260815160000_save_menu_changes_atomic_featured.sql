-- The Admin menu save previously ran as two separate RPC calls from the
-- client: ordering.save_menu_changes_with_baseline, then
-- ordering.save_featured_product_ids. If the second call failed after the
-- first committed, the menu was saved but the featured list was not, and
-- the client's cache rollback then showed the pre-save menu over a
-- database that actually held the post-save menu.
--
-- p_featured_product_ids folds the existing save_featured_product_ids call
-- into this function's own transaction, so a menu save and its featured
-- list either both commit or neither does. The parameter is optional and
-- defaults to null (skip), preserving the previous behaviour for any
-- caller that only wants to save the menu.
create or replace function ordering.save_menu_changes_with_baseline(
  p_business_id uuid,
  p_location_id uuid,
  p_baseline jsonb,
  p_menu jsonb,
  p_featured_product_ids uuid[] default null
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

  if p_featured_product_ids is not null then
    perform ordering.save_featured_product_ids(
      p_business_id,
      p_location_id,
      p_featured_product_ids
    );
  end if;

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

-- create or replace with an added parameter creates a new overload rather
-- than replacing in place; drop the old 4-arg signature so the function
-- resolves unambiguously again.
drop function if exists ordering.save_menu_changes_with_baseline(uuid, uuid, jsonb, jsonb);

revoke all on function ordering.save_menu_changes_with_baseline(uuid, uuid, jsonb, jsonb, uuid[]) from public;
grant execute on function ordering.save_menu_changes_with_baseline(uuid, uuid, jsonb, jsonb, uuid[]) to authenticated;
