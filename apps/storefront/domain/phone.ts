import {
  getCountryCallingCode,
  getCountries,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";

export interface PhoneNumber {
  countryIso2: string;
  countryCode: string;
  phone: string;
}

export interface CountryDialCode {
  iso2: string;
  name: string;
  dialCode: string;
}

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

function isCountryCode(value: string): value is CountryCode {
  return getCountries().includes(value as CountryCode);
}

function countryName(iso2: string) {
  return regionNames.of(iso2) ?? iso2;
}

function toFlag(iso2: string) {
  return iso2
    .toUpperCase()
    .replace(/./g, (letter) =>
      String.fromCodePoint(letter.charCodeAt(0) + 127397),
    );
}

export const supportedCountries: CountryDialCode[] = getCountries()
  .map((iso2) => ({
    iso2,
    name: countryName(iso2),
    dialCode: `+${getCountryCallingCode(iso2)}`,
  }))
  .sort((left, right) => left.name.localeCompare(right.name));

export const defaultCountryIso2 = "IN";
export const defaultCountryCode = `+${getCountryCallingCode(defaultCountryIso2)}`;

export function findCountryByIso2(iso2: string) {
  return supportedCountries.find((country) => country.iso2 === iso2);
}

export function findCountryByDialCode(dialCode: string) {
  return supportedCountries.find((country) => country.dialCode === dialCode);
}

export function normalizePhoneInput(
  value: string,
  countryIso2 = defaultCountryIso2,
): PhoneNumber {
  const trimmed = value.trim();
  if (trimmed.startsWith("+")) {
    const parsed = parsePhoneNumberFromString(trimmed);
    if (parsed) {
      return {
        countryIso2: parsed.country ?? countryIso2,
        countryCode: `+${parsed.countryCallingCode}`,
        phone: parsed.nationalNumber,
      };
    }
  }

  const country =
    findCountryByIso2(countryIso2) ?? findCountryByIso2(defaultCountryIso2)!;
  const digits = value.replace(/\D/g, "");
  const parsed = parsePhoneNumberFromString(digits, country.iso2 as CountryCode);
  return {
    countryIso2: country.iso2,
    countryCode: country.dialCode,
    phone: parsed?.country === country.iso2 ? parsed.nationalNumber : digits,
  };
}

export function isValidPhoneNumber(phone: PhoneNumber) {
  if (!isCountryCode(phone.countryIso2)) return false;
  const parsed = parsePhoneNumberFromString(
    phone.phone,
    phone.countryIso2 as CountryCode,
  );
  return Boolean(parsed?.isValid() && parsed.country === phone.countryIso2);
}

export function toE164(phone: PhoneNumber) {
  if (!isValidPhoneNumber(phone)) return null;
  const parsed = parsePhoneNumberFromString(
    phone.phone,
    phone.countryIso2 as CountryCode,
  );
  return parsed?.number ?? null;
}

export function formatPhoneForInput(
  phone: string,
  countryIso2 = defaultCountryIso2,
) {
  const parsed = parsePhoneNumberFromString(
    phone,
    countryIso2 as CountryCode,
  );
  if (!parsed) return phone.replace(/\D/g, "");

  const international = parsed.formatInternational();
  return international
    .slice(`+${parsed.countryCallingCode}`.length)
    .trim();
}

export function maskPhoneNumber(phone: PhoneNumber) {
  const e164 = toE164(phone) ?? `${phone.countryCode}${phone.phone}`;
  return e164.length < 7
    ? e164
    : `${e164.slice(0, Math.min(4, e164.length - 3))}•••${e164.slice(-3)}`;
}

export function splitE164(e164: string, countryIso2?: string): PhoneNumber {
  const parsed = parsePhoneNumberFromString(e164);
  const iso2 = countryIso2 ?? parsed?.country ?? defaultCountryIso2;
  const country =
    findCountryByIso2(iso2) ?? findCountryByIso2(defaultCountryIso2)!;
  return {
    countryIso2: iso2,
    countryCode: parsed ? `+${parsed.countryCallingCode}` : country.dialCode,
    phone: parsed?.nationalNumber ?? e164.replace(country.dialCode, ""),
  };
}

export function countryFlag(iso2: string) {
  return toFlag(iso2);
}
