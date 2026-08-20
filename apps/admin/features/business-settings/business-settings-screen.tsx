"use client";

import { CircleAlert, MapPin, Plus, Store, Truck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Toggle } from "@/components/ui/toggle";
import {
  cloneBusinessSettingsDraft,
  type BusinessSettingsDraft,
  type DeliveryZoneDraft,
  type SettingsSection,
} from "@/features/business-settings/business-settings-model";
import {
  useBusinessSettingsQuery,
  useSaveBusinessSettingsMutation,
} from "@/features/business-settings/business-settings-query";
import type { BusinessSettingsData } from "@/features/business-settings/api/business-settings-api";
import { LogoUploader } from "@/features/business-settings/logo-uploader";
import type { BusinessRole } from "@/features/outlet-context/outlet-context-model";

interface BusinessSettingsProps {
  businessId: string;
  locationId: string;
  businessRole: BusinessRole;
  orderingOpen: boolean;
  onOrderingToggle: () => void;
  resetToken: number;
  onDirtyChange: (dirty: boolean) => void;
  onSaved: (section: string) => void;
}

const sections: Array<[SettingsSection | "commercials", string]> = [
  ["general", "General"],
  ["ordering", "Ordering"],
  ["hours", "Opening Hours"],
  ["tax", "Tax"],
  ["delivery", "Delivery"],
  ["commercials", "Commercials"],
];

function composeSaveDraft(
  saved: BusinessSettingsDraft,
  draft: BusinessSettingsDraft,
  targetSections: Set<SettingsSection>,
): BusinessSettingsDraft {
  const next = cloneBusinessSettingsDraft(saved);
  if (targetSections.has("general"))
    next.general = cloneBusinessSettingsDraft(draft).general;
  if (targetSections.has("ordering")) {
    next.restaurant = {
      ...next.restaurant,
      orderingMode: draft.restaurant.orderingMode,
      minimumOrderValue: draft.restaurant.minimumOrderValue,
      defaultPrepMinutes: draft.restaurant.defaultPrepMinutes,
      acceptOrdersWhenClosed: draft.restaurant.acceptOrdersWhenClosed,
    };
  }
  if (targetSections.has("tax")) {
    next.restaurant = {
      ...next.restaurant,
      taxMode: draft.restaurant.taxMode,
      taxRate: draft.restaurant.taxRate,
    };
  }
  if (targetSections.has("hours"))
    next.openingHours = cloneBusinessSettingsDraft(draft).openingHours;
  if (targetSections.has("delivery"))
    next.deliveryZones = cloneBusinessSettingsDraft(draft).deliveryZones;
  return next;
}

function mergeSavedSections(
  draft: BusinessSettingsDraft,
  saved: BusinessSettingsDraft,
  targetSections: Set<SettingsSection>,
): BusinessSettingsDraft {
  const next = cloneBusinessSettingsDraft(draft);
  if (targetSections.has("general")) next.general = saved.general;
  if (targetSections.has("ordering")) {
    next.restaurant = {
      ...next.restaurant,
      orderingMode: saved.restaurant.orderingMode,
      minimumOrderValue: saved.restaurant.minimumOrderValue,
      defaultPrepMinutes: saved.restaurant.defaultPrepMinutes,
      acceptOrdersWhenClosed: saved.restaurant.acceptOrdersWhenClosed,
    };
  }
  if (targetSections.has("tax")) {
    next.restaurant = {
      ...next.restaurant,
      taxMode: saved.restaurant.taxMode,
      taxRate: saved.restaurant.taxRate,
    };
  }
  if (targetSections.has("hours")) next.openingHours = saved.openingHours;
  if (targetSections.has("delivery")) next.deliveryZones = saved.deliveryZones;
  next.commercials = saved.commercials;
  return next;
}

function validateDeliveryZones(zones: DeliveryZoneDraft[]) {
  const activeZones = zones.filter((zone) => zone.isActive);
  if (
    zones.some(
      (zone) =>
        !zone.name.trim() ||
        zone.minDistanceKm < 0 ||
        zone.minDistanceKm >= zone.maxDistanceKm,
    )
  ) {
    return "Each zone needs a name and a valid distance range.";
  }
  if (
    activeZones.some((zone, index) =>
      activeZones.some(
        (other, otherIndex) =>
          index !== otherIndex &&
          zone.minDistanceKm < other.maxDistanceKm &&
          other.minDistanceKm < zone.maxDistanceKm,
      ),
    )
  ) {
    return "Active delivery-zone distance ranges cannot overlap.";
  }
  return "";
}

export function BusinessSettings({
  businessId,
  locationId,
  businessRole,
  resetToken,
  ...props
}: BusinessSettingsProps) {
  const canManage = businessRole === "owner" || businessRole === "admin";
  const settingsQuery = useBusinessSettingsQuery(
    businessId,
    locationId,
    canManage,
  );

  if (!canManage) {
    return (
      <div className="settings-page page">
        <div className="empty-state compact-empty">
          <CircleAlert size={26} />
          <h3>Settings are restricted</h3>
          <p>
            Only a business owner or admin can view and change outlet settings.
          </p>
        </div>
      </div>
    );
  }

  if (settingsQuery.error) {
    return (
      <div className="settings-page page">
        <div className="empty-state compact-empty">
          <CircleAlert size={26} />
          <h3>Couldn’t load settings</h3>
          <p>{settingsQuery.error.message}</p>
          <button
            className="primary-button"
            onClick={() => {
              void settingsQuery.refetch();
            }}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (settingsQuery.isPending || !settingsQuery.data) {
    return (
      <div className="settings-page page">
        <div className="settings-loading">
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>
    );
  }

  return (
    <BusinessSettingsEditor
      key={`${businessId}:${locationId}:${resetToken}`}
      businessId={businessId}
      locationId={locationId}
      initialData={settingsQuery.data}
      settingsQuery={settingsQuery}
      {...props}
    />
  );
}

function BusinessSettingsEditor({
  businessId,
  locationId,
  initialData,
  settingsQuery,
  orderingOpen,
  onOrderingToggle,
  onDirtyChange,
  onSaved,
}: Omit<BusinessSettingsProps, "businessRole" | "resetToken"> & {
  initialData: BusinessSettingsData;
  settingsQuery: ReturnType<typeof useBusinessSettingsQuery>;
}) {
  const saveMutation = useSaveBusinessSettingsMutation();
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState("general");
  const [draft, setDraft] = useState<BusinessSettingsDraft>(() =>
    cloneBusinessSettingsDraft(initialData.draft),
  );
  const [dirtySections, setDirtySections] = useState<Set<SettingsSection>>(
    () => new Set(),
  );
  const [zoneError, setZoneError] = useState("");
  const hasDirtySections = dirtySections.size > 0;

  useEffect(() => {
    onDirtyChange(hasDirtySections);
  }, [hasDirtySections, onDirtyChange]);

  const mapLocation = useMemo(
    () =>
      `${draft.general.latitude.toFixed(5)}, ${draft.general.longitude.toFixed(5)}`,
    [draft],
  );

  function updateDraft(
    section: SettingsSection,
    update: (current: BusinessSettingsDraft) => BusinessSettingsDraft,
  ) {
    setDraft((current) => update(current));
    setDirtySections((current) => new Set(current).add(section));
  }

  function updateZone(
    id: string,
    key: keyof DeliveryZoneDraft,
    value: string | number | boolean | null,
  ) {
    updateDraft("delivery", (current) => ({
      ...current,
      deliveryZones: current.deliveryZones.map((zone) =>
        zone.id === id
          ? ({ ...zone, [key]: value } as DeliveryZoneDraft)
          : zone,
      ),
    }));
    setZoneError("");
  }

  async function save(targetSections: SettingsSection[], label: string) {
    if (!settingsQuery.data) return;
    const target = new Set(targetSections);
    if (target.has("delivery")) {
      const error = validateDeliveryZones(draft.deliveryZones);
      if (error) {
        setZoneError(error);
        return;
      }
    }

    try {
      const payload = composeSaveDraft(settingsQuery.data.draft, draft, target);
      await saveMutation.mutateAsync({
        businessId,
        locationId,
        baseline: settingsQuery.data.baseline,
        draft: payload,
      });
      const refreshed = await settingsQuery.refetch();
      if (refreshed.error) throw refreshed.error;
      if (!refreshed.data)
        throw new Error("The saved settings could not be reloaded.");
      setDraft((current) =>
        mergeSavedSections(current, refreshed.data.draft, target),
      );
      setDirtySections((current) => {
        const next = new Set(current);
        target.forEach((section) => next.delete(section));
        return next;
      });
      setZoneError("");
      if (target.has("hours")) {
        await queryClient.invalidateQueries({
          queryKey: ["ordering-status-today-hours", locationId],
        });
      }
      onSaved(label);
    } catch (error) {
      setZoneError(
        error instanceof Error
          ? error.message
          : "Could not save these settings.",
      );
    }
  }

  const saving = saveMutation.isPending;
  return (
    <div className="settings-page page">
      <div className="settings-context">
        <span>
          <Store size={16} />
          Settings for <strong>{draft.general.locationName}</strong>
        </span>
      </div>
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Business settings sections">
          {sections.map(([id, label]) => (
            <button
              key={id}
              className={activeSection === id ? "active" : ""}
              onClick={() => {
                setActiveSection(id);
                document
                  .getElementById(`settings-${id}`)
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              {label}
            </button>
          ))}
        </nav>
        <main className="settings-content">
          <section id="settings-general" className="settings-section">
            <div className="settings-section-head">
              <div>
                <h2>General</h2>
                <p>
                  Business information shown to customers and staff for this
                  outlet.
                </p>
              </div>
            </div>
            <LogoUploader
              businessId={businessId}
              logoUrl={draft.general.logoUrl}
              fallback={<span className="brand-mark">A2</span>}
              onChange={(logoUrl) =>
                setDraft((current) => ({
                  ...current,
                  general: { ...current.general, logoUrl },
                }))
              }
              onSaved={() => {
                void queryClient.invalidateQueries({
                  queryKey: ["outlet-context"],
                });
                onSaved("Logo");
              }}
            />
            <div className="settings-grid">
              <label className="field-label">
                Business name
                <input
                  value={draft.general.businessName}
                  onChange={(event) =>
                    updateDraft("general", (current) => ({
                      ...current,
                      general: {
                        ...current.general,
                        businessName: event.target.value,
                      },
                    }))
                  }
                />
              </label>
              <label className="field-label">
                Location / outlet name
                <input
                  value={draft.general.locationName}
                  onChange={(event) =>
                    updateDraft("general", (current) => ({
                      ...current,
                      general: {
                        ...current.general,
                        locationName: event.target.value,
                      },
                    }))
                  }
                />
              </label>
              <label className="field-label">
                Contact phone
                <input
                  type="tel"
                  value={draft.general.phone}
                  onChange={(event) =>
                    updateDraft("general", (current) => ({
                      ...current,
                      general: {
                        ...current.general,
                        phone: event.target.value,
                      },
                    }))
                  }
                />
              </label>
              <label className="field-label settings-full">
                Address
                <textarea
                  value={draft.general.addressLine1}
                  onChange={(event) =>
                    updateDraft("general", (current) => ({
                      ...current,
                      general: {
                        ...current.general,
                        addressLine1: event.target.value,
                      },
                    }))
                  }
                  rows={2}
                />
              </label>
              <label className="field-label">
                Locality
                <input
                  value={draft.general.locality}
                  onChange={(event) =>
                    updateDraft("general", (current) => ({
                      ...current,
                      general: {
                        ...current.general,
                        locality: event.target.value,
                      },
                    }))
                  }
                />
              </label>
              <label className="field-label">
                City
                <input
                  value={draft.general.city}
                  onChange={(event) =>
                    updateDraft("general", (current) => ({
                      ...current,
                      general: { ...current.general, city: event.target.value },
                    }))
                  }
                />
              </label>
              <label className="field-label">
                State
                <input
                  value={draft.general.state}
                  onChange={(event) =>
                    updateDraft("general", (current) => ({
                      ...current,
                      general: {
                        ...current.general,
                        state: event.target.value,
                      },
                    }))
                  }
                />
              </label>
              <label className="field-label">
                PIN code
                <input
                  value={draft.general.postalCode}
                  onChange={(event) =>
                    updateDraft("general", (current) => ({
                      ...current,
                      general: {
                        ...current.general,
                        postalCode: event.target.value,
                      },
                    }))
                  }
                />
              </label>
            </div>
            <div className="map-location">
              <MapPin size={18} />
              <span>
                <strong>Restaurant map location</strong>
                <small>{mapLocation}</small>
              </span>
              <small>Map lookup will be added with a geocoding provider.</small>
            </div>
            <div className="section-save">
              <button
                className="primary-button"
                disabled={saving}
                onClick={() => {
                  void save(["general"], "General");
                }}
              >
                Save changes
              </button>
            </div>
          </section>

          <section id="settings-ordering" className="settings-section">
            <div className="settings-section-head">
              <div>
                <h2>Ordering</h2>
                <p>
                  Choose how customers can place online orders from this outlet.
                </p>
              </div>
            </div>
            <div className="operational-setting">
              <span>
                <strong>Accepting orders</strong>
                <small>
                  Temporarily stop customers from placing new online orders.
                </small>
              </span>
              <div>
                <span
                  className={
                    orderingOpen ? "available-text" : "unavailable-text"
                  }
                >
                  {orderingOpen ? "On" : "Off"}
                </span>
                <Toggle
                  checked={orderingOpen}
                  onChange={onOrderingToggle}
                  label="Toggle accepting orders"
                />
              </div>
            </div>
            <div className="settings-grid">
              <label className="field-label settings-full">
                Order types
                <div className="choice-row">
                  {[
                    ["delivery", "Delivery"],
                    ["pickup", "Pickup"],
                    ["both", "Delivery & Pickup"],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      className={
                        draft.restaurant.orderingMode === id ? "selected" : ""
                      }
                      onClick={() =>
                        updateDraft("ordering", (current) => ({
                          ...current,
                          restaurant: {
                            ...current.restaurant,
                            orderingMode:
                              id as BusinessSettingsDraft["restaurant"]["orderingMode"],
                          },
                        }))
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </label>
              <label className="field-label currency-field">
                Minimum order value
                <span>
                  <b>₹</b>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={draft.restaurant.minimumOrderValue}
                    onChange={(event) =>
                      updateDraft("ordering", (current) => ({
                        ...current,
                        restaurant: {
                          ...current.restaurant,
                          minimumOrderValue: Number(event.target.value),
                        },
                      }))
                    }
                  />
                </span>
                <small>Applied at checkout.</small>
              </label>
              <label className="field-label">
                Default preparation time
                <input
                  type="number"
                  min="1"
                  max="1440"
                  value={draft.restaurant.defaultPrepMinutes}
                  onChange={(event) =>
                    updateDraft("ordering", (current) => ({
                      ...current,
                      restaurant: {
                        ...current.restaurant,
                        defaultPrepMinutes: Number(event.target.value),
                      },
                    }))
                  }
                />
                <small>
                  Minutes. Product-level timing takes priority when set.
                </small>
              </label>
            </div>
            <label className="settings-toggle-line">
              <input
                type="checkbox"
                checked={draft.restaurant.acceptOrdersWhenClosed}
                onChange={(event) =>
                  updateDraft("ordering", (current) => ({
                    ...current,
                    restaurant: {
                      ...current.restaurant,
                      acceptOrdersWhenClosed: event.target.checked,
                    },
                  }))
                }
              />
              <span>
                <strong>Allow orders when closed</strong>
                <small>
                  Customers can order for a later fulfilment window.
                </small>
              </span>
            </label>
            <div className="section-save">
              <button
                className="primary-button"
                disabled={saving}
                onClick={() => {
                  void save(["ordering"], "Ordering");
                }}
              >
                Save changes
              </button>
            </div>
          </section>

          <section id="settings-hours" className="settings-section">
            <div className="settings-section-head">
              <div>
                <h2>Opening Hours</h2>
                <p>Weekly outlet hours in {draft.commercials.timezone}.</p>
              </div>
            </div>
            <div className="hours-editor">
              {draft.openingHours.map((row, index) => (
                <div className="hours-row" key={row.dayOfWeek}>
                  <strong>{row.label}</strong>
                  <Toggle
                    checked={!row.isClosed}
                    onChange={() =>
                      updateDraft("hours", (current) => ({
                        ...current,
                        openingHours: current.openingHours.map(
                          (item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, isClosed: !item.isClosed }
                              : item,
                        ),
                      }))
                    }
                    label={`${row.label} open`}
                  />
                  {!row.isClosed ? (
                    <>
                      <input
                        type="time"
                        value={row.opensAt}
                        onChange={(event) =>
                          updateDraft("hours", (current) => ({
                            ...current,
                            openingHours: current.openingHours.map(
                              (item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, opensAt: event.target.value }
                                  : item,
                            ),
                          }))
                        }
                      />
                      <span>to</span>
                      <input
                        type="time"
                        value={row.closesAt}
                        onChange={(event) =>
                          updateDraft("hours", (current) => ({
                            ...current,
                            openingHours: current.openingHours.map(
                              (item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, closesAt: event.target.value }
                                  : item,
                            ),
                          }))
                        }
                      />
                    </>
                  ) : (
                    <span className="closed-label">Closed</span>
                  )}
                </div>
              ))}
            </div>
            <div className="section-save">
              <button
                className="primary-button"
                disabled={saving}
                onClick={() => {
                  void save(["hours"], "Opening hours");
                }}
              >
                Save changes
              </button>
            </div>
          </section>

          <section id="settings-tax" className="settings-section">
            <div className="settings-section-head">
              <div>
                <h2>Tax</h2>
                <p>Applied automatically to eligible orders.</p>
              </div>
            </div>
            <div className="settings-grid">
              <label className="field-label">
                Tax treatment
                <select
                  value={draft.restaurant.taxMode}
                  onChange={(event) =>
                    updateDraft("tax", (current) => ({
                      ...current,
                      restaurant: {
                        ...current.restaurant,
                        taxMode: event.target
                          .value as BusinessSettingsDraft["restaurant"]["taxMode"],
                        taxRate:
                          event.target.value === "none"
                            ? 0
                            : current.restaurant.taxRate || 5,
                      },
                    }))
                  }
                >
                  <option value="exclusive">Added at checkout</option>
                  <option value="inclusive">Included in menu prices</option>
                  <option value="none">No tax</option>
                </select>
              </label>
            </div>
            {draft.restaurant.taxMode !== "none" && (
              <div className="tax-options">
                {[5, 12, 18, 28].map((rate) => (
                  <button
                    key={rate}
                    className={
                      draft.restaurant.taxRate === rate ? "selected" : ""
                    }
                    onClick={() =>
                      updateDraft("tax", (current) => ({
                        ...current,
                        restaurant: { ...current.restaurant, taxRate: rate },
                      }))
                    }
                  >
                    {rate}%
                  </button>
                ))}
              </div>
            )}
            <div className="section-save">
              <button
                className="primary-button"
                disabled={saving}
                onClick={() => {
                  void save(["tax"], "Tax");
                }}
              >
                Save changes
              </button>
            </div>
          </section>

          <section id="settings-delivery" className="settings-section">
            <div className="settings-section-head">
              <div>
                <h2>Delivery</h2>
                <p>
                  Set customer charges and coverage by distance from this
                  outlet.
                </p>
              </div>
              <button
                className="secondary-button compact-button"
                onClick={() =>
                  updateDraft("delivery", (current) => ({
                    ...current,
                    deliveryZones: [
                      ...current.deliveryZones,
                      {
                        id: crypto.randomUUID(),
                        name: "New zone",
                        minDistanceKm: current.deliveryZones.reduce(
                          (maximum, zone) =>
                            Math.max(maximum, zone.maxDistanceKm),
                          0,
                        ),
                        maxDistanceKm:
                          current.deliveryZones.reduce(
                            (maximum, zone) =>
                              Math.max(maximum, zone.maxDistanceKm),
                            0,
                          ) + 5,
                        deliveryFee: 0,
                        freeDeliveryThreshold: null,
                        minimumOrderValue: current.restaurant.minimumOrderValue,
                        estimatedDeliveryCost: 0,
                        isActive: true,
                      },
                    ],
                  }))
                }
              >
                <Plus size={15} />
                Add zone
              </button>
            </div>
            {draft.deliveryZones.length ? (
              <div className="delivery-zones">
                {draft.deliveryZones.map((zone, index) => (
                  <div className="delivery-zone" key={zone.id}>
                    <div className="zone-number">{index + 1}</div>
                    <div className="zone-fields">
                      <label className="field-label">
                        Zone name
                        <input
                          value={zone.name}
                          onChange={(event) =>
                            updateZone(zone.id, "name", event.target.value)
                          }
                        />
                      </label>
                      <label className="field-label">
                        Distance range
                        <div className="range-fields">
                          <input
                            type="number"
                            min="0"
                            value={zone.minDistanceKm}
                            onChange={(event) =>
                              updateZone(
                                zone.id,
                                "minDistanceKm",
                                Number(event.target.value),
                              )
                            }
                          />
                          <span>to</span>
                          <input
                            type="number"
                            min="0"
                            value={zone.maxDistanceKm}
                            onChange={(event) =>
                              updateZone(
                                zone.id,
                                "maxDistanceKm",
                                Number(event.target.value),
                              )
                            }
                          />
                          <small>km</small>
                        </div>
                      </label>
                      <label className="field-label">
                        Delivery fee
                        <div className="currency-field">
                          <span>
                            <b>₹</b>
                            <input
                              type="number"
                              min="0"
                              value={zone.deliveryFee}
                              onChange={(event) =>
                                updateZone(
                                  zone.id,
                                  "deliveryFee",
                                  Number(event.target.value),
                                )
                              }
                            />
                          </span>
                        </div>
                      </label>
                      <label className="field-label">
                        Free delivery at
                        <div className="currency-field">
                          <span>
                            <b>₹</b>
                            <input
                              type="number"
                              min="0"
                              value={zone.freeDeliveryThreshold ?? ""}
                              onChange={(event) =>
                                updateZone(
                                  zone.id,
                                  "freeDeliveryThreshold",
                                  event.target.value === ""
                                    ? null
                                    : Number(event.target.value),
                                )
                              }
                            />
                          </span>
                        </div>
                      </label>
                      <label className="field-label">
                        Zone minimum{" "}
                        <div className="currency-field">
                          <span>
                            <b>₹</b>
                            <input
                              type="number"
                              min="0"
                              value={zone.minimumOrderValue}
                              onChange={(event) =>
                                updateZone(
                                  zone.id,
                                  "minimumOrderValue",
                                  Number(event.target.value),
                                )
                              }
                            />
                          </span>
                        </div>
                      </label>
                      <label className="field-label">
                        Estimated delivery cost
                        <div className="currency-field">
                          <span>
                            <b>₹</b>
                            <input
                              type="number"
                              min="0"
                              value={zone.estimatedDeliveryCost}
                              onChange={(event) =>
                                updateZone(
                                  zone.id,
                                  "estimatedDeliveryCost",
                                  Number(event.target.value),
                                )
                              }
                            />
                          </span>
                        </div>
                        <small>Used to estimate delivery margin.</small>
                      </label>
                    </div>
                    <div className="zone-actions">
                      <Toggle
                        checked={zone.isActive}
                        onChange={() =>
                          updateZone(zone.id, "isActive", !zone.isActive)
                        }
                        label={`${zone.name} active`}
                      />
                      <button
                        className="destructive-link"
                        onClick={() =>
                          updateDraft("delivery", (current) => ({
                            ...current,
                            deliveryZones: current.deliveryZones.filter(
                              (item) => item.id !== zone.id,
                            ),
                          }))
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state compact-empty">
                <Truck size={26} />
                <h3>No delivery zones</h3>
                <p>Add a distance range to start offering delivery.</p>
              </div>
            )}
            {zoneError && <p className="field-error">{zoneError}</p>}
            <div className="section-save">
              <button
                className="primary-button"
                disabled={saving}
                onClick={() => {
                  void save(["delivery"], "Delivery");
                }}
              >
                Save changes
              </button>
            </div>
          </section>

          <section id="settings-commercials" className="settings-section">
            <div className="settings-section-head">
              <div>
                <h2>Commercials</h2>
                <p>Read-only agreement details for this business.</p>
              </div>
            </div>
            <div className="commercials-grid">
              <div>
                <span>Platform commission</span>
                <strong>{draft.commercials.skrowiaCommissionRate}%</strong>
                <small>
                  Applied to eligible direct-order revenue according to your
                  agreement.
                </small>
              </div>
              <div>
                <span>Aggregator benchmark</span>
                <strong>
                  {draft.commercials.aggregatorBenchmarkRate ?? "—"}
                  {draft.commercials.aggregatorBenchmarkRate === null
                    ? ""
                    : "%"}
                </strong>
                <small>
                  Used only to estimate aggregator fees avoided in analytics.
                </small>
              </div>
            </div>
            <div className="managed-note">
              <CircleAlert size={16} />
              <span>
                <strong>Managed by your account team</strong>Contact them to
                review these commercial terms.
              </span>
            </div>
            <div className="read-only-meta">
              <span>
                Currency <strong>{draft.commercials.currency}</strong>
              </span>
              <span>
                Timezone <strong>{draft.commercials.timezone}</strong>
              </span>
            </div>
          </section>
        </main>
      </div>
      {hasDirtySections && (
        <div className="settings-unsaved-bar">
          <span>
            <span />
            Unsaved changes
          </span>
          <button
            className="primary-button compact-button"
            disabled={saving}
            onClick={() => {
              void save([...dirtySections], "Business");
            }}
          >
            Save changes
          </button>
        </div>
      )}
    </div>
  );
}
