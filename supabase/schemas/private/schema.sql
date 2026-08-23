create schema "private";

grant usage on schema "private" to "authenticated";

grant create, usage on schema "private" to "postgres";

comment on schema "private" is 'Non-exposed authorization and integrity helpers for A2 Ordering.';
