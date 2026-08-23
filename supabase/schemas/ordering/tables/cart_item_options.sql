create table "ordering"."cart_item_options" (
  "cart_item_id" uuid    not null,
  "option_id"    uuid    not null,
  "quantity"     integer not null default 1,
  constraint "cart_item_options_pkey" primary key (cart_item_id, option_id),
  constraint "cart_item_options_quantity_check" check ((quantity > 0)),
  constraint "cart_item_options_cart_item_id_fkey" foreign key (cart_item_id) references ordering.cart_items(id) on delete cascade,
  constraint "cart_item_options_option_id_fkey" foreign key (option_id) references ordering.options(id) on delete restrict
);

alter table "ordering"."cart_item_options"
  enable row level security;

create index cart_item_options_option_item_idx on ordering.cart_item_options using btree (option_id, cart_item_id);

create trigger cart_item_options_20_enforce_identity
  before update on ordering.cart_item_options
  for each row
  execute function private.enforce_cart_identity();

create trigger cart_item_options_30_validate_attachment
  before insert or update on ordering.cart_item_options
  for each row
  execute function private.validate_cart_item_option_attachment();

grant delete, insert, maintain, references, select, trigger, truncate, update on table "ordering"."cart_item_options" to "postgres", "service_role";

comment on table "ordering"."cart_item_options" is 'Selected option quantities for a cart line.';
