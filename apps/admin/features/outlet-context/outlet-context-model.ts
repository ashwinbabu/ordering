export type BusinessRole = "owner" | "admin" | "manager" | "staff";

export interface AccessibleBusiness {
  id: string;
  name: string;
  currency: string;
  timezone: string;
  role: BusinessRole;
}

export interface AccessibleLocation {
  id: string;
  businessId: string;
  businessName: string;
  name: string;
  city: string;
  state: string;
}

export interface OperatorOutletContext {
  operatorName: string;
  businesses: AccessibleBusiness[];
  locations: AccessibleLocation[];
}
