import { supabase } from "@/lib/supabase/client";
import type { AccessibleBusiness, AccessibleLocation, BusinessRole, OperatorOutletContext } from "@/features/outlet-context/outlet-context-model";

const businessRoles = new Set<BusinessRole>(["owner", "admin", "manager", "staff"]);

function asBusinessRole(role: string): BusinessRole {
  if (!businessRoles.has(role as BusinessRole)) {
    throw new Error("The operator has an unrecognized business role.");
  }
  return role as BusinessRole;
}

export async function getOperatorOutletContext(): Promise<OperatorOutletContext> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error("Your session has expired. Please sign in again.");

  const core = supabase.schema("core");
  const { data: operator, error: operatorError } = await core
    .from("users")
    .select("id, name")
    .eq("auth_user_id", authData.user.id)
    .maybeSingle();
  if (operatorError) throw operatorError;
  if (!operator) throw new Error("This account is not linked to an Admin operator.");

  const { data: memberships, error: membershipError } = await core
    .from("business_users")
    .select("business_id, role")
    .eq("user_id", operator.id)
    .eq("is_active", true);
  if (membershipError) throw membershipError;
  if (!memberships.length) {
    return { operatorName: operator.name, businesses: [], locations: [] };
  }

  const businessIds = memberships.map((membership) => membership.business_id);
  const { data: businesses, error: businessError } = await core
    .from("businesses")
    .select("id, name, currency, timezone, logo_url")
    .in("id", businessIds)
    .eq("status", "active")
    .order("name");
  if (businessError) throw businessError;

  const roleByBusinessId = new Map(memberships.map((membership) => [membership.business_id, asBusinessRole(membership.role)]));
  const accessibleBusinesses: AccessibleBusiness[] = businesses.map((business) => ({
    id: business.id,
    name: business.name,
    currency: business.currency,
    timezone: business.timezone,
    logoUrl: business.logo_url,
    role: roleByBusinessId.get(business.id) ?? "staff",
  }));

  if (!accessibleBusinesses.length) {
    return { operatorName: operator.name, businesses: [], locations: [] };
  }

  const { data: locations, error: locationError } = await core
    .from("business_locations")
    .select("id, business_id, name, city, state")
    .in("business_id", accessibleBusinesses.map((business) => business.id))
    .eq("is_active", true)
    .order("name");
  if (locationError) throw locationError;

  const businessNameById = new Map(accessibleBusinesses.map((business) => [business.id, business.name]));
  const accessibleLocations: AccessibleLocation[] = locations.map((location) => ({
    id: location.id,
    businessId: location.business_id,
    businessName: businessNameById.get(location.business_id) ?? "Business",
    name: location.name,
    city: location.city,
    state: location.state,
  }));

  return { operatorName: operator.name, businesses: accessibleBusinesses, locations: accessibleLocations };
}
