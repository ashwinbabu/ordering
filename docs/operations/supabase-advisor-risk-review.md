# Supabase advisor risk review

Read-only advisor results captured from `ordering dev` on 2026-08-23.
No advisor remediation was applied.

## Summary

- Security lints: 80 total
  - 19 informational RLS-enabled-without-policy findings
  - 13 anonymous-role SECURITY DEFINER execution warnings
  - 46 authenticated-role SECURITY DEFINER execution warnings
  - 1 `pg_net` extension-in-public warning
  - 1 leaked-password-protection warning
- Performance lints: 37 total
  - 17 unindexed foreign-key findings
  - 19 unused-index findings
  - 1 multiple-permissive-policy warning

## Highest-risk items to review

### SECURITY DEFINER execution

Supabase reports SECURITY DEFINER routines callable by `anon` or `authenticated`.
Some may be intentional for anonymous carts, public menu reads, tenant-scoped RPCs, or
customer address operations. The warning is not proof of an exploit, but each routine
must be checked for:

- explicit tenant/customer ownership checks;
- `search_path` hardening;
- safe argument validation;
- appropriate `EXECUTE` grants;
- no reliance on user-editable JWT metadata.

Representative remediation references:

- https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
- https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable

### RLS enabled without policy

19 tables have RLS enabled with no policies. Several are intentionally server-only tables
(notifications, audit/replay, or transactional internals). They should remain inaccessible
to `anon` and `authenticated` through grants/RPC boundaries. Confirm that this is deliberate
rather than assuming every finding requires a policy.

### pg_net in public

`pg_net` is installed in the public schema. Moving it is a Supabase-side schema/configuration
change and is outside this Git-only reconciliation. It requires separate compatibility review
because cron/database-webhook calls may depend on the current extension location.

Remediation reference: https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public

### Auth leaked-password protection

Supabase reports compromised-password protection as disabled. This is an Auth configuration
change, not a Git migration. It should be handled separately after confirming the product's
password/OTP authentication model.

Remediation reference: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

### Performance findings

The 17 unindexed foreign-key and one multiple-permissive-policy findings are candidates for
review, not automatic changes. The 19 unused-index findings may reflect a young development
environment and should not be dropped without query-usage and rollback analysis.

## Decision

These findings are recorded as risks only. No Supabase-side remediation is part of the Git-only
sync. The next Git review should prioritize SECURITY DEFINER grants and tenant predicates in
the committed declarative schema/functions before any future deployment.
