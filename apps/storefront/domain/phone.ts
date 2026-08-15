export interface PhoneNumber {
  countryCode: string;
  phone: string;
}

/**
 * One row per country we can validate a phone number for. Only India has
 * smsOtpEnabled today - MSG91 is wired for SMS only in this phase. The table
 * exists so a future country (or MSG91's email channel for non-Indian
 * customers) is a data addition here, not a rewrite of the validation logic.
 */
export interface CountryDialCode {
  iso2: string;
  name: string;
  dialCode: string;
  digitLength: number;
  smsOtpEnabled: boolean;
}

export const supportedCountries: CountryDialCode[] = [
  { iso2: "IN", name: "India", dialCode: "+91", digitLength: 10, smsOtpEnabled: true },
];

export const defaultCountryCode = supportedCountries[0].dialCode;

export function findCountryByDialCode(dialCode: string): CountryDialCode | undefined {
  return supportedCountries.find((country) => country.dialCode === dialCode);
}

export function normalizePhoneInput(value: string, countryCode: string = defaultCountryCode) {
  const digitLength = findCountryByDialCode(countryCode)?.digitLength ?? 10;
  return value.replace(/\D/g, "").slice(0, digitLength);
}

export function isValidPhoneNumber(phone: PhoneNumber) {
  const country = findCountryByDialCode(phone.countryCode);
  if (!country) return false;
  return new RegExp(`^\\d{${country.digitLength}}$`).test(phone.phone);
}

export function formatPhoneForInput(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.length > 5 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits;
}

export function maskPhoneNumber({ countryCode, phone }: PhoneNumber) {
  const digits = phone.replace(/\D/g, "");

  if (digits.length < 5) {
    return `${countryCode} ${digits}`;
  }

  return `${countryCode} ${digits.slice(0, 2)}••• ••${digits.slice(-3)}`;
}

/** E.164, e.g. "+919025117533" - the format core.customers.phone_e164 requires. */
export function toE164(phone: PhoneNumber) {
  return `${phone.countryCode}${phone.phone}`;
}

/** MSG91 widget identifier: country code without "+", e.g. "919025117533". */
export function toMsg91Identifier(phone: PhoneNumber) {
  return `${phone.countryCode.replace("+", "")}${phone.phone}`;
}

/** Inverse of toE164() - splits a stored E.164 value back into countryCode/phone using the country table. Falls back to the default country if no dial code matches (only one is configured today, so this only matters once more are added). */
export function splitE164(e164: string): PhoneNumber {
  const match = supportedCountries.find((country) => e164.startsWith(country.dialCode) && e164.length === country.dialCode.length + country.digitLength);
  if (match) return { countryCode: match.dialCode, phone: e164.slice(match.dialCode.length) };
  return { countryCode: defaultCountryCode, phone: e164.replace(defaultCountryCode, "") };
}
