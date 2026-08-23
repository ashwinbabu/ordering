create schema "ordering";

grant usage on schema "ordering" to "anon", "authenticated";

grant create, usage on schema "ordering" to "postgres";

grant usage on schema "ordering" to "service_role";

comment on schema "ordering" is 'A2 Ordering domain. Browser-facing reads use curated RPCs; transactional, Telegram, and raw analytics base tables remain deny-by-default.';
