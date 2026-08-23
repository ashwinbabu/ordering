import { ChevronDown, ChevronRight } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import {
  countryFlag,
  formatPhoneForInput,
  normalizePhoneInput,
  supportedCountries,
  type CountryDialCode,
  type PhoneNumber,
} from "../../domain/phone";

interface InternationalPhoneFieldProps {
  error?: string;
  id: string;
  label?: string;
  onChange: (phone: PhoneNumber) => void;
  value: PhoneNumber;
}

const curatedCountryIso2 = [
  "IN",
  "GB",
  "RU",
  "DE",
  "FR",
  "US",
  "CA",
  "AU",
  "IL",
  "AE",
  "NL",
  "PT",
  "IE",
];

const curatedCountries = curatedCountryIso2
  .map((iso2) => supportedCountries.find((country) => country.iso2 === iso2))
  .filter((country): country is CountryDialCode => Boolean(country));

export function InternationalPhoneField({
  error,
  id,
  label = "Mobile number",
  onChange,
  value,
}: InternationalPhoneFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showAllCountries, setShowAllCountries] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxId = useId();
  const [menuPosition, setMenuPosition] = useState({
    left: 0,
    top: 0,
    maxHeight: 290,
  });
  const selectedCountry =
    supportedCountries.find((country) => country.iso2 === value.countryIso2) ??
    supportedCountries.find((country) => country.iso2 === "IN")!;
  const curatedIso2 = new Set(curatedCountryIso2);
  const visibleCountries = showAllCountries
    ? supportedCountries
    : curatedIso2.has(selectedCountry.iso2)
      ? curatedCountries
      : [selectedCountry, ...curatedCountries];

  useEffect(() => {
    function closeOnOutsideClick(event: PointerEvent) {
      if (
        !containerRef.current?.contains(event.target as Node) &&
        !menuRef.current?.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setShowAllCountries(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        setShowAllCountries(false);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current) return;

    const trigger = triggerRef.current.getBoundingClientRect();
    const menuHeight = showAllCountries
      ? Math.min(290, supportedCountries.length * 40 + 16)
      : Math.min(290, visibleCountries.length * 40 + 62);
    const spaceBelow = window.innerHeight - trigger.bottom - 12;
    const openBelow = spaceBelow >= Math.min(menuHeight, 290);
    const maxHeight = Math.min(
      290,
      openBelow ? Math.max(140, spaceBelow) : Math.max(140, trigger.top - 12),
    );

    setMenuPosition({
      left: Math.min(trigger.left, window.innerWidth - 270),
      top: openBelow
        ? trigger.bottom + 7
        : Math.max(8, trigger.top - Math.min(menuHeight, maxHeight) - 7),
      maxHeight,
    });
  }, [isOpen, showAllCountries, visibleCountries.length]);

  function chooseCountry(country: CountryDialCode) {
    onChange(normalizePhoneInput(value.phone, country.iso2));
    setIsOpen(false);
    setShowAllCountries(false);
  }

  return (
    <div className="form-field international-phone-field">
      <span>{label}</span>
      <div
        className="phone-input"
        data-error={error ? "true" : undefined}
        ref={containerRef}
      >
        <div className="phone-input__country">
          <button
            aria-controls={listboxId}
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            aria-label={`Country: ${selectedCountry.name}`}
            className="phone-input__country-trigger"
            onClick={() => setIsOpen((open) => !open)}
            ref={triggerRef}
            type="button"
          >
            <span aria-hidden="true">{countryFlag(value.countryIso2)}</span>
            <ChevronDown aria-hidden="true" size={14} />
          </button>
          {isOpen
            ? createPortal(
                <div
                  className="phone-input__country-menu"
                  id={listboxId}
                  ref={menuRef}
                  role="listbox"
                  aria-label="Phone country"
                  style={{
                    left: `${menuPosition.left}px`,
                    maxHeight: `${menuPosition.maxHeight}px`,
                    top: `${menuPosition.top}px`,
                  }}
                >
                  {visibleCountries.map((country) => (
                    <button
                      aria-selected={country.iso2 === value.countryIso2}
                      className="phone-input__country-option"
                      key={country.iso2}
                      onClick={() => chooseCountry(country)}
                      role="option"
                      type="button"
                    >
                      <span aria-hidden="true">{countryFlag(country.iso2)}</span>
                      <span>{country.name}</span>
                      <small>{country.dialCode}</small>
                    </button>
                  ))}
                  {!showAllCountries ? (
                    <button
                      className="phone-input__country-more"
                      onClick={() => setShowAllCountries(true)}
                      type="button"
                    >
                      Other countries
                      <ChevronRight aria-hidden="true" size={15} />
                    </button>
                  ) : null}
                </div>,
                document.body,
              )
            : null}
        </div>
        <div className="phone-input__number">
          <span className="phone-input__prefix" aria-hidden="true">
            {value.countryCode}
          </span>
          <input
            aria-describedby={error ? `${id}-error` : undefined}
            aria-invalid={Boolean(error)}
            autoComplete="tel"
            id={id}
            inputMode="tel"
            onChange={(event) =>
              onChange(
                normalizePhoneInput(event.target.value, value.countryIso2),
              )
            }
            placeholder="Mobile number"
            value={formatPhoneForInput(value.phone, value.countryIso2)}
          />
        </div>
      </div>
      {error ? (
        <small id={`${id}-error`} role="alert">
          {error}
        </small>
      ) : null}
    </div>
  );
}
