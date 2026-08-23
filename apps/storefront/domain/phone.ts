import {
  getCountryCallingCode,
  getCountries,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";

export interface PhoneNumber {
  /** Country selected by the customer, retained for deterministic editing/prefill. */
  countryIso2: CountryCode;
  /** Calling code derived from countryIso2 or a parsed international value. */
  countryCode: string;
  /** National-number portion displayed and edited by the customer. */
  phone: string;
  /** Canonical E.164 value, or null while the input is incomplete/invalid. */
  e164: string | null;
}

export interface CountryDialCode {
  iso2: CountryCode;
  name: string;
  dialCode: string;
}

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

function isCountryCode(value: string): value is CountryCode {
  return getCountries().includes(value as CountryCode);
}

function countryName(iso2: CountryCode) {
  return regionNames.of(iso2) ?? iso2;
}

export function countryFlag(iso2: string) {
  return iso2
    .toUpperCase()
    .replace(/./g, (letter) =>
      String.fromCodePoint(letter.charCodeAt(0) + 127397),
    );
}

/**
 * This list contains every country understood by the parser. The phone
 * selector presents a curated Goa-relevant subset first and offers the rest
 * behind "Other countries".
 */
export const supportedCountries: CountryDialCode[] = getCountries()
  .map((iso2) => ({
    iso2,
    name: countryName(iso2),
    dialCode: `+${getCountryCallingCode(iso2)}`,
  }))
  .sort((left, right) => left.name.localeCompare(right.name));

export const defaultCountryIso2: CountryCode = "IN";
export const defaultCountryCode = `+${getCountryCallingCode(defaultCountryIso2)}`;

export function findCountryByIso2(iso2: string) {
  return supportedCountries.find((country) => country.iso2 === iso2);
}

export function findCountryByDialCode(dialCode: string) {
  return supportedCountries.find((country) => country.dialCode === dialCode);
}

function emptyPhone(countryIso2: CountryCode): PhoneNumber {
  const country =
    findCountryByIso2(countryIso2) ?? findCountryByIso2(defaultCountryIso2)!;
  return {
    countryIso2: country.iso2,
    countryCode: country.dialCode,
    phone: "",
    e164: null,
  };
}

/**
 * Normalize either a national-number edit or a pasted international value.
 * The selected country is used by libphonenumber-js to interpret national
 * prefixes; no calling code is prepended by string concatenation.
 */
export function normalizePhoneInput(
  value: string,
  countryIso2: string = defaultCountryIso2,
): PhoneNumber {
  const selectedCountry =
    findCountryByIso2(countryIso2) ?? findCountryByIso2(defaultCountryIso2)!;
  const trimmed = value.trim();

  if (!trimmed) return emptyPhone(selectedCountry.iso2);

  const isInternationalInput = trimmed.startsWith("+");
  const parsed = isInternationalInput
    ? parsePhoneNumberFromString(trimmed)
    : parsePhoneNumberFromString(
        trimmed.replace(/\D/g, ""),
        selectedCountry.iso2,
      );

  if (parsed) {
    const parsedCountry = parsed.country;
    const parsedIso2 =
      isInternationalInput && parsedCountry && isCountryCode(parsedCountry)
        ? parsedCountry
        : selectedCountry.iso2;
    return {
      countryIso2: parsedIso2,
      countryCode: `+${parsed.countryCallingCode}`,
      phone: parsed.nationalNumber,
      e164: parsed.number,
    };
  }

  return {
    countryIso2: selectedCountry.iso2,
    countryCode: selectedCountry.dialCode,
    phone: trimmed.replace(/\D/g, ""),
    e164: null,
  };
}

export function isValidPhoneNumber(phone: PhoneNumber) {
  if (!isCountryCode(phone.countryIso2)) return false;
  const parsed = parsePhoneNumberFromString(phone.phone, phone.countryIso2);
  return Boolean(
    parsed?.isValid() &&
      (parsed.country === phone.countryIso2 || !parsed.country),
  );
}

export function toE164(phone: PhoneNumber) {
  if (!isValidPhoneNumber(phone)) return null;
  const parsed = parsePhoneNumberFromString(phone.phone, phone.countryIso2);
  return parsed?.number ?? phone.e164;
}

export function formatPhoneForInput(
  phone: string,
  countryIso2: CountryCode = defaultCountryIso2,
) {
  const parsed = parsePhoneNumberFromString(phone, countryIso2);
  if (!parsed) return phone.replace(/\D/g, "");

  const international = parsed.formatInternational();
  return international
    .slice(`+${parsed.countryCallingCode}`.length)
    .trim();
}

export function maskPhoneNumber(phone: PhoneNumber) {
  const e164 =
    toE164(phone) ?? phone.e164 ?? `${phone.countryCode}${phone.phone}`;
  return e164.length < 7
    ? e164
    : `${e164.slice(0, Math.min(4, e164.length - 3))}•••${e164.slice(-3)}`;
}

/** Split a canonical E.164 value without reconstructing it from a default country. */
export function splitE164(e164: string, countryIso2?: CountryCode): PhoneNumber {
  const parsed = parsePhoneNumberFromString(e164);
  const parsedIso2 = parsed?.country;
  const iso2 =
    countryIso2 ??
    (parsedIso2 && isCountryCode(parsedIso2) ? parsedIso2 : defaultCountryIso2);
  const country =
    findCountryByIso2(iso2) ?? findCountryByIso2(defaultCountryIso2)!;

  if (!parsed) {
    return {
      countryIso2: country.iso2,
      countryCode: country.dialCode,
      phone: "",
      e164,
    };
  }

  return {
    countryIso2:
      parsedIso2 && isCountryCode(parsedIso2) ? parsedIso2 : country.iso2,
    countryCode: `+${parsed.countryCallingCode}`,
    phone: parsed.nationalNumber,
    e164: parsed.number,
  };
}

/** MSG91 widget identifier: canonical E.164 without the leading plus sign. */
export function toMsg91Identifier(phone: PhoneNumber) {
  const e164 = toE164(phone) ?? phone.e164;
  return (e164 ?? `${phone.countryCode}${phone.phone}`).replace(/^\+/, "");
}
