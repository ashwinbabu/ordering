alter default privileges for role "postgres" in schema "core" grant select, update, usage on sequences to "service_role";

alter default privileges for role "postgres" in schema "core" grant delete, insert, maintain, references, select, trigger, truncate, update on tables to "service_role";
