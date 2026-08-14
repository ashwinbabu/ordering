import { Check } from "lucide-react";
import { useEffect, useRef } from "react";
import type { CustomerDetails } from "../../domain/storefront";

interface CustomerDetailsSectionProps {
  details: CustomerDetails;
  error?: "name" | "phone";
  focusInvalid: boolean;
  onChange: (details: CustomerDetails) => void;
  state?: "guest" | "resolved";
}

export function CustomerDetailsSection({ details, error, focusInvalid, onChange, state = "guest" }: CustomerDetailsSectionProps) {
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (focusInvalid) (error === "phone" ? phoneRef : nameRef).current?.focus(); }, [error, focusInvalid]);
  if (state === "resolved") return <section className="cart-section customer-details" id="customer-details" aria-labelledby="customer-details-title"><div className="cart-section__heading"><div><p className="section-kicker">Your details</p><h2 id="customer-details-title">Customer details</h2></div><button className="text-button" type="button">Change</button></div><div className="resolved-details"><strong>{details.name}</strong><span>{details.countryCode} {details.phone.replace(/(\d{2})\d{5}(\d{3})/, "$1•••••$2")} <Check aria-label="Verified customer" size={16} /></span></div></section>;
  return <section className="cart-section customer-details" id="customer-details" aria-labelledby="customer-details-title"><div className="cart-section__heading"><div><p className="section-kicker">Your details</p><h2 id="customer-details-title">Customer details</h2></div></div><p className="cart-section__description">We’ll use this to keep you updated about your order.</p><div className="customer-details__fields"><label className="form-field"><span>Name</span><input ref={nameRef} aria-invalid={error === "name"} value={details.name} onChange={(event) => onChange({ ...details, name: event.target.value })} autoComplete="name" placeholder="Your name" />{error === "name" ? <small role="alert">Enter your name</small> : null}</label><label className="form-field"><span>Phone number</span><div className="phone-input"><select aria-label="Country code" value={details.countryCode} onChange={(event) => onChange({ ...details, countryCode: event.target.value })}><option value="+91">+91</option></select><input id="customer-phone" ref={phoneRef} aria-invalid={error === "phone"} value={details.phone} onChange={(event) => onChange({ ...details, phone: event.target.value.replace(/\D/g, "").slice(0, 10) })} inputMode="numeric" autoComplete="tel" placeholder="98765 43210" /></div>{error === "phone" ? <small role="alert">Enter a valid 10-digit mobile number</small> : null}</label></div></section>;
}
