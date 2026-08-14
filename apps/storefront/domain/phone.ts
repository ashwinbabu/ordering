export interface PhoneNumber {
  countryCode: string;
  phone: string;
}

export const defaultCountryCode = "+91";

export function normalizePhoneInput(value: string) {
  return value.replace(/\D/g, "").slice(0, 10);
}

export function isValidPhoneNumber(phone: PhoneNumber) {
  return phone.countryCode === defaultCountryCode && /^\d{10}$/.test(phone.phone);
}

export function formatPhoneForInput(phone: string) {
  const digits = normalizePhoneInput(phone);
  return digits.length > 5 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits;
}

export function maskPhoneNumber({ countryCode, phone }: PhoneNumber) {
  const digits = normalizePhoneInput(phone);

  if (digits.length < 5) {
    return `${countryCode} ${digits}`;
  }

  return `${countryCode} ${digits.slice(0, 2)}••• ••${digits.slice(-3)}`;
}
