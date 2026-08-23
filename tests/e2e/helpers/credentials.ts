export interface QaCredentials {
  adminEmail: string;
  adminPassword: string;
  customerPhone: string;
  customerOtp: string;
}

function requireEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value)
    throw new Error(`Missing required QA environment variable: ${name}`);
  return value;
}

export function qaCredentials(): QaCredentials {
  return {
    adminEmail: requireEnvironment("TEST_ADMIN_EMAIL"),
    adminPassword: requireEnvironment("TEST_ADMIN_PASSWORD"),
    customerPhone: requireEnvironment("TEST_CUSTOMER_PHONE"),
    customerOtp: requireEnvironment("TEST_CUSTOMER_OTP"),
  };
}
