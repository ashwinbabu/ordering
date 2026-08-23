create schema "core";

grant usage on schema "core" to "authenticated";

grant create, usage on schema "core" to "postgres";

grant usage on schema "core" to "service_role";

comment on schema "core" is 'Cross-domain tenant, customer, and operator identity for A2 Ordering.';
