create table "ordering"."order_items" (
  "id"                   uuid                     not null default gen_random_uuid(),
  "order_id"             uuid                     not null,
  "product_id"           uuid                     not null,
  "product_name"         text                     not null,
  "quantity"             integer                  not null,
  "base_unit_price"      numeric(14,2)            not null,
  "modifier_unit_total"  numeric(14,2)            not null,
  "final_unit_price"     numeric(14,2)            not null,
  "line_total"           numeric(14,2)            not null,
  "customer_note"        text,
  "category_id_snapshot" uuid                     not null,
  "created_at"           timestamp with time zone not null default now(),
  constraint "order_items_amounts_check"
    check
    (((base_unit_price >= (0)::numeric) AND (modifier_unit_total >= (0)::numeric) AND (final_unit_price = (base_unit_price + modifier_unit_total)) AND (line_total =
    round((final_unit_price * (quantity)::numeric), 2)))),
  constraint "order_items_category_id_snapshot_fkey" foreign key (category_id_snapshot) references ordering.menu_categories(id) on delete restrict,
  constraint "order_items_customer_note_check"
    check (((customer_note IS NULL) OR ((customer_note = btrim(customer_note)) AND ((char_length(customer_note) >= 1) AND (char_length(customer_note) <= 1000))))),
  constraint "order_items_pkey" primary key (id),
  constraint "order_items_product_name_check" check (((product_name = btrim(product_name)) AND ((char_length(product_name) >= 1) AND (char_length(product_name) <= 200)))),
  constraint "order_items_quantity_check" check ((quantity > 0)),
  constraint "order_items_order_id_fkey" foreign key (order_id) references ordering.orders(id) on delete restrict,
  constraint "order_items_product_id_fkey" foreign key (product_id) references ordering.products(id) on delete restrict
);

alter table "ordering"."order_items"
  enable row level security;

create index order_items_category_order_idx on ordering.order_items using btree (category_id_snapshot, order_id);

create index order_items_order_created_idx on ordering.order_items using btree (order_id, created_at, id);

create index order_items_product_order_idx on ordering.order_items using btree (product_id, order_id);

create trigger order_items_reject_update
  before delete or update on ordering.order_items
  for each row
  execute function private.reject_order_snapshot_mutation();

grant delete, insert, maintain, references, select, trigger, truncate, update on table "ordering"."order_items" to "postgres", "service_role";
