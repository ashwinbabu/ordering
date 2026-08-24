create table "ordering"."cart_items" (
  "id"            uuid                     not null default gen_random_uuid(),
  "cart_id"       uuid                     not null,
  "product_id"    uuid                     not null,
  "quantity"      integer                  not null,
  "customer_note" text,
  "created_at"    timestamp with time zone not null default now(),
  "updated_at"    timestamp with time zone not null default now(),
  constraint "cart_items_customer_note_check"
    check (((customer_note IS NULL) OR ((customer_note = btrim(customer_note)) AND ((char_length(customer_note) >= 1) AND (char_length(customer_note) <= 1000))))),
  constraint "cart_items_pkey" primary key (id),
  constraint "cart_items_quantity_check" check ((quantity > 0)),
  constraint "cart_items_updated_at_check" check ((updated_at >= created_at)),
  constraint "cart_items_cart_id_fkey" foreign key (cart_id) references ordering.carts(id) on delete cascade,
  constraint "cart_items_product_id_fkey" foreign key (product_id) references ordering.products(id) on delete restrict
);

alter table "ordering"."cart_items"
  enable row level security;

create index cart_items_cart_created_idx on ordering.cart_items using btree (cart_id, created_at, id);

create index cart_items_product_idx on ordering.cart_items using btree (product_id, cart_id);

create trigger cart_items_20_enforce_identity
  before update on ordering.cart_items
  for each row
  execute function private.enforce_cart_identity();

create trigger cart_items_30_validate_tenant
  before insert or update on ordering.cart_items
  for each row
  execute function private.validate_cart_item_tenant();

create trigger cart_items_90_set_updated_at
  before update on ordering.cart_items
  for each row
  execute function private.set_updated_at();

grant delete, insert, maintain, references, select, trigger, truncate, update on table "ordering"."cart_items" to "postgres", "service_role";

comment on table "ordering"."cart_items" is 'Mutable cart lines; authoritative prices are resolved from current catalog data.';
