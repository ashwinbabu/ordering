"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Clock3,
  Copy,
  Edit3,
  GripVertical,
  ImagePlus,
  LoaderCircle,
  MoreVertical,
  Plus,
  Search,
  Trash2,
  Utensils,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Toggle } from "@/components/ui/toggle";
import { formatMoney as money } from "@/features/orders/order-model";
import {
  DAYS,
  createMenuId,
  scheduleWindowsFor,
  effectiveProductState,
  isScheduleActive,
  priceFromInput,
  type Category,
  type CategoryDialog,
  type FoodType,
  type Product,
  type VariantGroup,
  type VariantOption,
} from "./menu-model";

function FoodMarker({ type }: { type: FoodType }) {
  return (
    <span
      className={`food-marker food-${type.toLowerCase().replace("-", "")}`}
      aria-label={type}
    >
      <span />
    </span>
  );
}

export function MenuAvailability({
  categories,
  timezone,
  busyAvailability,
  onToggleCategory,
  onToggleProduct,
  onEditMenu,
}: {
  categories: Category[];
  timezone: string;
  busyAvailability: string;
  onToggleCategory: (category: Category) => void;
  onToggleProduct: (category: Category, product: Product) => void;
  onEditMenu: () => void;
}) {
  const [expanded, setExpanded] = useState<string[]>(["burgers", "beverages"]);
  const [search, setSearch] = useState("");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, []);
  const filtered = categories.filter(
    (category) =>
      category.name.toLowerCase().includes(search.toLowerCase()) ||
      category.products.some((product) =>
        product.name.toLowerCase().includes(search.toLowerCase()),
      ),
  );

  return (
    <div className="page menu-page">
      <div className="menu-status-row">
        <span>
          <span className="service-dot" />
          Menu live
        </span>
        <button
          className="secondary-button compact-button edit-menu-button"
          onClick={onEditMenu}
        >
          <Edit3 size={16} />
          Edit menu
        </button>
      </div>

      <label className="search-field menu-search">
        <Search size={18} />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search categories or products"
        />
      </label>

      <section className="availability-list" aria-label="Menu categories">
        {filtered.map((category) => {
          const isExpanded = expanded.includes(category.id);
          const categoryScheduledUnavailable = !isScheduleActive(
            category,
            timezone,
            now,
          );
          return (
            <article className="availability-category" key={category.id}>
              <div className="category-availability-row">
                <button
                  className="category-expand"
                  onClick={() =>
                    setExpanded((ids) =>
                      ids.includes(category.id)
                        ? ids.filter((id) => id !== category.id)
                        : [...ids, category.id],
                    )
                  }
                  aria-expanded={isExpanded}
                >
                  <ChevronRight
                    size={18}
                    className={isExpanded ? "rotate-right" : ""}
                  />
                  <span>
                    <strong>{category.name}</strong>
                    <small>
                      {category.products.length}{" "}
                      {category.products.length === 1 ? "product" : "products"}{" "}
                      · {category.scheduleSummary}
                    </small>
                  </span>
                </button>
                <div className="availability-control">
                  <span
                    className={
                      category.available ? "available-text" : "unavailable-text"
                    }
                  >
                    {busyAvailability === category.id
                      ? "Saving…"
                      : category.available
                        ? "Available"
                        : "Unavailable"}
                  </span>
                  {busyAvailability === category.id ? (
                    <LoaderCircle className="spin" size={20} />
                  ) : (
                    <Toggle
                      checked={category.available}
                      onChange={() => onToggleCategory(category)}
                      label={`Toggle ${category.name}`}
                      disabled={
                        category.available && categoryScheduledUnavailable
                      }
                    />
                  )}
                </div>
              </div>
              {isExpanded && (
                <div className="product-availability-list">
                  {category.products.length ? (
                    category.products.map((product) => {
                      const scheduledUnavailable =
                        categoryScheduledUnavailable ||
                        !isScheduleActive(product, timezone, now);
                      const state = effectiveProductState(category, product);
                      return (
                        <div
                          className="product-availability-row"
                          key={product.id}
                        >
                          <div
                            className={`food-thumb thumb-${product.foodType.toLowerCase().replace("-", "")}`}
                          >
                            {product.image ? (
                              <img src={product.image} alt="" />
                            ) : (
                              <Utensils size={18} />
                            )}
                          </div>
                          <div className="product-primary">
                            <div className="product-title-line">
                              <FoodMarker type={product.foodType} />
                              <strong>{product.name}</strong>
                              {product.tag && (
                                <span className="quiet-tag">{product.tag}</span>
                              )}
                            </div>
                            <span>{money(product.price)}</span>
                            {product.scheduleMode !== "restaurant" && (
                              <small>
                                <Clock3 size={13} />
                                {product.scheduleSummary}
                              </small>
                            )}
                          </div>
                          <div className="availability-control product-toggle-control">
                            <span
                              className={
                                state === "Available"
                                  ? "available-text"
                                  : "unavailable-text"
                              }
                            >
                              {busyAvailability === product.id
                                ? "Saving…"
                                : state}
                            </span>
                            {busyAvailability === product.id ? (
                              <LoaderCircle className="spin" size={20} />
                            ) : (
                              <Toggle
                                checked={product.available}
                                onChange={() =>
                                  onToggleProduct(category, product)
                                }
                                label={`Toggle ${product.name}`}
                                disabled={
                                  !category.available ||
                                  (product.available && scheduledUnavailable)
                                }
                              />
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="empty-product-row">
                      <span>No products in this category.</span>
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })}
        {!filtered.length && (
          <div className="empty-state compact-empty">
            <Search size={26} />
            <h3>No menu matches</h3>
            <p>Try a different search.</p>
          </div>
        )}
      </section>
    </div>
  );
}

export function MenuEditor({
  categories,
  selectedCategoryId,
  onSelectCategory,
  unsaved,
  saving,
  onSave,
  onBack,
  categoryMenuId,
  setCategoryMenuId,
  onCategoryAction,
  onDuplicateCategory,
  canDeleteCategory,
  onReorderCategory,
  onReorderProduct,
  onToggleProduct,
  onAddProduct,
  onEditProduct,
  productMenuId,
  setProductMenuId,
  onDuplicateProduct,
  onDeleteProduct,
}: {
  categories: Category[];
  selectedCategoryId: string;
  onSelectCategory: (id: string) => void;
  unsaved: boolean;
  saving: boolean;
  onSave: () => void;
  onBack: () => void;
  categoryMenuId: string;
  setCategoryMenuId: (id: string) => void;
  onCategoryAction: (dialog: CategoryDialog) => void;
  onDuplicateCategory: (category: Category) => void;
  canDeleteCategory: (category: Category) => boolean;
  onReorderCategory: (id: string, direction: -1 | 1) => void;
  onReorderProduct: (
    categoryId: string,
    productId: string,
    direction: -1 | 1,
  ) => void;
  onToggleProduct: (category: Category, product: Product) => void;
  onAddProduct: () => void;
  onEditProduct: (product: Product) => void;
  productMenuId: string;
  setProductMenuId: (id: string) => void;
  onDuplicateProduct: (product: Product) => void;
  onDeleteProduct: (product: Product) => void;
}) {
  const selected =
    categories.find((category) => category.id === selectedCategoryId) ||
    categories[0];

  return (
    <div className="page menu-editor-page">
      <div className="editor-top-row">
        <button className="back-button" onClick={onBack}>
          <ArrowLeft size={18} />
          Back
        </button>
        <div className="editor-save-group">
          {unsaved && (
            <span className="unsaved-label">
              <span />
              Unsaved changes
            </span>
          )}
          <button
            className="primary-button"
            onClick={onSave}
            disabled={!unsaved || saving}
          >
            {saving && <LoaderCircle className="spin" size={17} />}
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      <div className="menu-editor-workspace">
        <aside className="category-pane">
          <div className="pane-heading">
            <span>
              <strong>Categories</strong>
              <small>{categories.length}</small>
            </span>
            <button
              className="icon-text-button"
              onClick={() => onCategoryAction({ type: "add" })}
            >
              <Plus size={16} />
              Add
            </button>
          </div>
          <div className="category-editor-list">
            {categories.map((category, index) => (
              <div
                key={category.id}
                className={`editor-category-row ${selected?.id === category.id ? "selected" : ""}`}
              >
                <button
                  className="category-select-button"
                  onClick={() => onSelectCategory(category.id)}
                >
                  <GripVertical size={16} className="drag-handle" />
                  <span>
                    <strong>{category.name}</strong>
                    <small>
                      {category.products.length}{" "}
                      {category.products.length === 1 ? "product" : "products"}{" "}
                      · {category.available ? "Available" : "Unavailable"}
                    </small>
                  </span>
                </button>
                <div className="row-controls">
                  <button
                    onClick={() => onReorderCategory(category.id, -1)}
                    disabled={index === 0}
                    aria-label={`Move ${category.name} up`}
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    onClick={() => onReorderCategory(category.id, 1)}
                    disabled={index === categories.length - 1}
                    aria-label={`Move ${category.name} down`}
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    onClick={() =>
                      setCategoryMenuId(
                        categoryMenuId === category.id ? "" : category.id,
                      )
                    }
                    aria-label={`Actions for ${category.name}`}
                  >
                    <MoreVertical size={17} />
                  </button>
                </div>
                {categoryMenuId === category.id && (
                  <div className="row-popover" role="menu">
                    <button
                      onClick={() =>
                        onCategoryAction({
                          type: "rename",
                          categoryId: category.id,
                        })
                      }
                    >
                      <Edit3 size={15} />
                      Rename
                    </button>
                    <button onClick={() => onDuplicateCategory(category)}>
                      <Copy size={15} />
                      Duplicate
                    </button>
                    <button
                      onClick={() =>
                        onCategoryAction({
                          type: "schedule",
                          categoryId: category.id,
                        })
                      }
                    >
                      <Clock3 size={15} />
                      Edit availability times
                    </button>
                    <button
                      className="danger"
                      disabled={!canDeleteCategory(category)}
                      title={
                        canDeleteCategory(category)
                          ? undefined
                          : "Saved categories cannot be deleted yet."
                      }
                      onClick={() =>
                        onCategoryAction({
                          type: "delete",
                          categoryId: category.id,
                        })
                      }
                    >
                      <Trash2 size={15} />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </aside>

        <section className="product-pane">
          {selected ? (
            <>
              <div className="pane-heading product-pane-heading">
                <span>
                  <strong>{selected.name}</strong>
                  <small>
                    {selected.products.length} products ·{" "}
                    {selected.available ? "Available" : "Unavailable"} ·{" "}
                    {selected.scheduleSummary}
                  </small>
                </span>
                <button
                  className="primary-button compact-button"
                  onClick={onAddProduct}
                >
                  <Plus size={16} />
                  Add product
                </button>
              </div>
              {selected.products.length ? (
                <div className="product-editor-list">
                  {selected.products.map((product, index) => (
                    <div
                      className="product-editor-row"
                      key={product.id}
                      onClick={() => onEditProduct(product)}
                    >
                      <GripVertical size={17} className="drag-handle" />
                      <div
                        className={`food-thumb thumb-${product.foodType.toLowerCase().replace("-", "")}`}
                      >
                        {product.image ? (
                          <img src={product.image} alt="" />
                        ) : (
                          <Utensils size={17} />
                        )}
                      </div>
                      <div className="editor-product-info">
                        <div>
                          <FoodMarker type={product.foodType} />
                          <strong>{product.name}</strong>
                          {product.tag && (
                            <span className="quiet-tag">{product.tag}</span>
                          )}
                        </div>
                        <span>
                          {money(product.price)} ·{" "}
                          {product.available ? "Available" : "Unavailable"}
                        </span>
                      </div>
                      <div className="editor-row-availability">
                        <span>{product.available ? "On" : "Off"}</span>
                        <Toggle
                          checked={product.available}
                          onChange={() => onToggleProduct(selected, product)}
                          label={`Toggle ${product.name}`}
                        />
                      </div>
                      <div className="row-controls product-move-controls">
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            onReorderProduct(selected.id, product.id, -1);
                          }}
                          disabled={index === 0}
                          aria-label={`Move ${product.name} up`}
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            onReorderProduct(selected.id, product.id, 1);
                          }}
                          disabled={index === selected.products.length - 1}
                          aria-label={`Move ${product.name} down`}
                        >
                          <ArrowDown size={14} />
                        </button>
                      </div>
                      <button
                        className="row-product-actions"
                        onClick={(event) => {
                          event.stopPropagation();
                          setProductMenuId(
                            productMenuId === product.id ? "" : product.id,
                          );
                        }}
                        aria-label={`Actions for ${product.name}`}
                        aria-expanded={productMenuId === product.id}
                      >
                        <MoreVertical size={18} />
                      </button>
                      {productMenuId === product.id && (
                        <div
                          className="row-popover product-row-popover"
                          role="menu"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <button
                            onClick={() => {
                              setProductMenuId("");
                              onEditProduct(product);
                            }}
                          >
                            <Edit3 size={15} />
                            Edit
                          </button>
                          <button onClick={() => onDuplicateProduct(product)}>
                            <Copy size={15} />
                            Duplicate
                          </button>
                          <button
                            className="danger"
                            onClick={() => onDeleteProduct(product)}
                          >
                            <Trash2 size={15} />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state editor-empty">
                  <Utensils size={30} />
                  <h3>No products yet</h3>
                  <p>Add the first product to {selected.name}.</p>
                  <button className="primary-button" onClick={onAddProduct}>
                    <Plus size={16} />
                    Add first product
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="empty-state editor-empty">
              <h3>Select a category</h3>
              <p>Choose a category to view its products.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export function ProductEditorOverlay({
  draft,
  categories,
  venue,
  dirty,
  errors,
  onChange,
  onImageSelect,
  onImageRemove,
  onClose,
  onSave,
  onDelete,
  isNew,
}: {
  draft: Product;
  categories: Category[];
  venue: { businessName: string; locationName: string };
  dirty: boolean;
  errors: Record<string, string>;
  onChange: (draft: Product) => void;
  onImageSelect: (file: File) => void;
  onImageRemove: () => void;
  onClose: () => void;
  onSave: () => void;
  onDelete: () => void;
  isNew: boolean;
}) {
  function change<K extends keyof Product>(key: K, value: Product[K]) {
    onChange({ ...draft, [key]: value });
  }

  function updateGroup(groupId: string, patch: Partial<VariantGroup>) {
    change(
      "variantGroups",
      draft.variantGroups.map((group) =>
        group.id === groupId ? { ...group, ...patch } : group,
      ),
    );
  }

  function updateOption(
    groupId: string,
    optionId: string,
    patch: Partial<VariantOption>,
  ) {
    change(
      "variantGroups",
      draft.variantGroups.map((group) =>
        group.id === groupId
          ? {
              ...group,
              options: group.options.map((option) =>
                option.id === optionId ? { ...option, ...patch } : option,
              ),
            }
          : group,
      ),
    );
  }

  function addGroup() {
    const id = createMenuId();
    change("variantGroups", [
      ...draft.variantGroups,
      {
        id,
        name: "New option group",
        type: "single",
        required: true,
        min: 1,
        max: 1,
        options: [],
      },
    ]);
  }

  function addOption(groupId: string) {
    const option: VariantOption = {
      id: createMenuId(),
      name: "New option",
      price: 0,
      available: true,
    };
    change(
      "variantGroups",
      draft.variantGroups.map((group) =>
        group.id === groupId
          ? { ...group, options: [...group.options, option] }
          : group,
      ),
    );
  }

  const scheduleWindows = scheduleWindowsFor(draft);

  function setDayWindow(
    day: string,
    patch: Partial<{ enabled: boolean; start: string; end: string }>,
  ) {
    const existing = scheduleWindows.find((window) => window.day === day);
    const enabled = patch.enabled ?? Boolean(existing);
    const nextWindows = enabled
      ? [
          ...scheduleWindows.filter((window) => window.day !== day),
          {
            day,
            start: patch.start ?? existing?.start ?? draft.scheduleStart ?? "16:00",
            end: patch.end ?? existing?.end ?? draft.scheduleEnd ?? "18:00",
          },
        ].sort((left, right) => DAYS.indexOf(left.day) - DAYS.indexOf(right.day))
      : scheduleWindows.filter((window) => window.day !== day);
    const first = nextWindows[0];
    onChange({
      ...draft,
      scheduleWindows: nextWindows,
      scheduleDays: nextWindows.map((window) => window.day),
      scheduleStart: first?.start ?? "",
      scheduleEnd: first?.end ?? "",
    });
  }

  function setScheduleMode(mode: Product["scheduleMode"]) {
    const first = scheduleWindows[0];
    const start = first?.start ?? (draft.scheduleStart || "16:00");
    const end = first?.end ?? (draft.scheduleEnd || "18:00");
    const windows =
      mode === "restaurant"
        ? []
        : mode === "same"
          ? DAYS.map((day) => ({ day, start, end }))
          : scheduleWindows;
    onChange({
      ...draft,
      scheduleMode: mode,
      scheduleWindows: windows,
      scheduleDays: windows.map((window) => window.day),
      scheduleStart: windows[0]?.start ?? start,
      scheduleEnd: windows[0]?.end ?? end,
    });
  }

  return (
    <div className="product-editor-layer" aria-label="Product editor">
      <div className="product-editor-scrim" aria-hidden="true" />

      <section
        className="live-preview-shell"
        aria-label="Live customer preview"
      >
        <div className="preview-label-row">
          <span>Live customer preview</span>
          <small>Updates instantly</small>
        </div>
        <div className="phone-frame">
          <div className="phone-speaker" />
          <div className="phone-screen">
            <header className="customer-preview-header">
              <span className="brand-mark tiny-mark">
                {venue.businessName.slice(0, 2).toUpperCase()}
              </span>
              <span>
                <strong>
                  {venue.businessName} · {venue.locationName}
                </strong>
                <small>Delivery · 30–40 min</small>
              </span>
            </header>
            <div className="customer-search">
              <Search size={14} />
              Search the menu
            </div>
            <div className="customer-category-title">
              <span>
                <strong>
                  {categories.find(
                    (category) => category.id === draft.categoryId,
                  )?.name || "Menu"}
                </strong>
                <small>Customer menu</small>
              </span>
              <ChevronDown size={15} />
            </div>
            <article
              className={`customer-product-card ${!draft.available ? "preview-unavailable" : ""}`}
            >
              <div className="preview-product-copy">
                <div className="product-title-line">
                  <FoodMarker type={draft.foodType} />
                  {draft.tag && (
                    <span className="customer-tag">{draft.tag}</span>
                  )}
                </div>
                <h3>{draft.name || "Product name"}</h3>
                <strong>From {money(Number(draft.price || 0))}</strong>
                {draft.description.trim() && <p>{draft.description}</p>}
                {!draft.available && (
                  <span className="preview-unavailable-label">
                    Currently unavailable
                  </span>
                )}
              </div>
              <div className="preview-image-wrap">
                {draft.image ? (
                  <img src={draft.image} alt="Product preview" />
                ) : (
                  <div className="preview-image-placeholder">
                    <Utensils size={24} />
                    <span>No image</span>
                  </div>
                )}
                <button disabled={!draft.available}>ADD</button>
              </div>
            </article>
          </div>
        </div>
      </section>

      <aside
        className="product-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-editor-title"
      >
        <header className="sheet-header">
          <div>
            <p>{isNew ? "Add product" : "Edit product"}</p>
            <h2 id="product-editor-title">{draft.name || "New product"}</h2>
          </div>
          <button onClick={onClose} aria-label="Close product editor">
            <X size={21} />
          </button>
        </header>
        <div className="sheet-body">
          <section className="form-section">
            <div className="form-section-heading">
              <h3>Product information</h3>
              <span>Required fields marked *</span>
            </div>
            <label className="field-label">
              Product name *
              <input
                value={draft.name}
                onChange={(event) => change("name", event.target.value)}
                aria-invalid={Boolean(errors.name)}
              />
              {errors.name && (
                <small className="field-error">{errors.name}</small>
              )}
            </label>
            <label className="field-label">
              Description
              <textarea
                value={draft.description}
                onChange={(event) => change("description", event.target.value)}
                rows={3}
                maxLength={500}
              />
              <span className="character-count">
                {draft.description.length}/500
              </span>
            </label>
            <div className="two-field-grid">
              <label className="field-label">
                Category *
                <select
                  value={draft.categoryId}
                  onChange={(event) => change("categoryId", event.target.value)}
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-label currency-field">
                Base price *
                <span>
                  <b>₹</b>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={draft.price}
                    onChange={(event) =>
                      change("price", priceFromInput(event.target.value))
                    }
                    aria-invalid={Boolean(errors.price)}
                  />
                </span>
                {errors.price && (
                  <small className="field-error">{errors.price}</small>
                )}
              </label>
            </div>
            <div className="field-label">
              Food type *
              <div className="choice-row">
                {(["Veg", "Non-veg", "Egg"] as FoodType[]).map((type) => (
                  <button
                    type="button"
                    key={type}
                    className={draft.foodType === type ? "selected" : ""}
                    onClick={() => change("foodType", type)}
                  >
                    <FoodMarker type={type} />
                    {type}
                  </button>
                ))}
              </div>
            </div>
            <label className="field-label">
              Customer tag
              <select value="" disabled>
                <option value="">No tag</option>
              </select>
            </label>
          </section>

          <section className="form-section">
            <div className="form-section-heading">
              <h3>Product image</h3>
            </div>
            <div className="image-upload-row">
              <div className="image-preview-box">
                {draft.image ? (
                  <img src={draft.image} alt="Uploaded product" />
                ) : (
                  <>
                    <ImagePlus size={24} />
                    <span>No image</span>
                  </>
                )}
              </div>
              <div>
                <label className="secondary-button upload-button">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => {
                      const [file] = Array.from(event.target.files ?? []);
                      if (file) onImageSelect(file);
                      event.target.value = "";
                    }}
                  />
                  {draft.image ? "Replace image" : "Upload image"}
                </label>
                {draft.image && (
                  <button
                    type="button"
                    className="destructive-link remove-image"
                    onClick={onImageRemove}
                  >
                    Remove
                  </button>
                )}
                {errors.image ? (
                  <small className="field-error">{errors.image}</small>
                ) : (
                  <small>JPG, PNG or WebP · up to 5 MB</small>
                )}
              </div>
            </div>
          </section>

          <section className="form-section">
            <div className="form-section-heading">
              <h3>Availability</h3>
            </div>
            <label className="required-field">
              <input
                type="checkbox"
                checked={draft.featured ?? false}
                onChange={(event) => change("featured", event.target.checked)}
              />
              <span>Mark featured</span>
            </label>
            <div className="availability-edit-row">
              <span>
                <strong>Manually available</strong>
                <small>
                  Category and schedule rules can still block this product.
                </small>
              </span>
              <div>
                <span>{draft.available ? "On" : "Off"}</span>
                <Toggle
                  checked={draft.available}
                  onChange={() => change("available", !draft.available)}
                  label="Toggle product availability"
                />
              </div>
            </div>
            <div
              className="schedule-options"
              role="radiogroup"
              aria-label="Product availability times"
            >
              <label>
                <input
                  type="radio"
                  checked={draft.scheduleMode === "restaurant"}
                  onChange={() => setScheduleMode("restaurant")}
                />
                All times the restaurant is open
              </label>
              <label>
                <input
                  type="radio"
                  checked={draft.scheduleMode === "same"}
                  onChange={() => setScheduleMode("same")}
                />
                Same time for all days
              </label>
              <label>
                <input
                  type="radio"
                  checked={draft.scheduleMode === "different"}
                  onChange={() => setScheduleMode("different")}
                />
                Different times on different days
              </label>
            </div>
            {draft.scheduleMode !== "restaurant" && (
              <div className="schedule-detail-box">
                {draft.scheduleMode === "different" ? (
                  <div className="weekday-window-list">
                    {DAYS.map((day) => {
                      const window = scheduleWindows.find(
                        (entry) => entry.day === day,
                      );
                      return (
                        <div className="weekday-window-row" key={day}>
                          <label>
                            <input
                              type="checkbox"
                              checked={Boolean(window)}
                              onChange={(event) =>
                                setDayWindow(day, { enabled: event.target.checked })
                              }
                            />
                            {day}
                          </label>
                          <input
                            aria-label={`${day} start time`}
                            type="time"
                            disabled={!window}
                            value={window?.start ?? ""}
                            onChange={(event) =>
                              setDayWindow(day, { start: event.target.value })
                            }
                          />
                          <input
                            aria-label={`${day} end time`}
                            type="time"
                            disabled={!window}
                            value={window?.end ?? ""}
                            onChange={(event) =>
                              setDayWindow(day, { end: event.target.value })
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="time-grid">
                    <label className="field-label">
                      Start
                      <input
                        type="time"
                        value={draft.scheduleStart}
                        onChange={(event) => {
                          const start = event.target.value;
                          onChange({
                            ...draft,
                            scheduleStart: start,
                            scheduleWindows: DAYS.map((day) => ({
                              day,
                              start,
                              end: draft.scheduleEnd,
                            })),
                          });
                        }}
                      />
                    </label>
                    <label className="field-label">
                      End
                      <input
                        type="time"
                        value={draft.scheduleEnd}
                        onChange={(event) => {
                          const end = event.target.value;
                          onChange({
                            ...draft,
                            scheduleEnd: end,
                            scheduleWindows: DAYS.map((day) => ({
                              day,
                              start: draft.scheduleStart,
                              end,
                            })),
                          });
                        }}
                      />
                    </label>
                  </div>
                )}
                {errors.schedule && (
                  <p className="field-error">{errors.schedule}</p>
                )}
              </div>
            )}
          </section>

          <section className="form-section variants-section">
            <div className="form-section-heading variants-heading">
              <div>
                <h3>Variants & add-ons</h3>
                <span>Set selection rules and price increments.</span>
              </div>
              <button
                className="secondary-button compact-button"
                onClick={addGroup}
              >
                <Plus size={15} />
                Add group
              </button>
            </div>
            {draft.variantGroups.length ? (
              draft.variantGroups.map((group, groupIndex) => (
                <div className="variant-group-editor" key={group.id}>
                  <div className="variant-group-head">
                    <GripVertical size={17} className="drag-handle" />
                    <input
                      value={group.name}
                      onChange={(event) =>
                        updateGroup(group.id, { name: event.target.value })
                      }
                      aria-label={`Variant group ${groupIndex + 1} name`}
                    />
                    <button
                      onClick={() =>
                        change(
                          "variantGroups",
                          draft.variantGroups.filter(
                            (item) => item.id !== group.id,
                          ),
                        )
                      }
                      aria-label={`Delete ${group.name}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="variant-rule-grid">
                    <label className="field-label">
                      Selection type
                      <select
                        value={group.type}
                        onChange={(event) =>
                          updateGroup(group.id, {
                            type: event.target.value as "single" | "multi",
                            max:
                              event.target.value === "single"
                                ? 1
                                : Math.max(2, group.max),
                          })
                        }
                      >
                        <option value="single">Choose one</option>
                        <option value="multi">Add-ons (choose many)</option>
                      </select>
                    </label>
                    <label className="required-field">
                      <input
                        type="checkbox"
                        checked={group.required}
                        onChange={(event) =>
                          updateGroup(group.id, {
                            required: event.target.checked,
                            min: event.target.checked
                              ? Math.max(1, group.min)
                              : 0,
                          })
                        }
                      />
                      <span>Required</span>
                    </label>
                    {group.type === "multi" && (
                      <>
                        <label className="field-label">
                          Minimum
                          <input
                            type="number"
                            min="0"
                            value={group.min}
                            onChange={(event) =>
                              updateGroup(group.id, {
                                min: Number(event.target.value),
                              })
                            }
                          />
                        </label>
                        <label className="field-label">
                          Maximum
                          <input
                            type="number"
                            min="1"
                            value={group.max}
                            onChange={(event) =>
                              updateGroup(group.id, {
                                max: Number(event.target.value),
                              })
                            }
                          />
                        </label>
                      </>
                    )}
                  </div>
                  <div className="variant-options-list">
                    {group.options.map((option, optionIndex) => (
                      <div className="variant-option-row" key={option.id}>
                        <GripVertical size={15} className="drag-handle" />
                        <span className="option-number">{optionIndex + 1}</span>
                        <input
                          value={option.name}
                          onChange={(event) =>
                            updateOption(group.id, option.id, {
                              name: event.target.value,
                            })
                          }
                          aria-label="Option name"
                        />
                        <label className="option-price">
                          <span>+ ₹</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={option.price}
                            onChange={(event) =>
                              updateOption(group.id, option.id, {
                                price: priceFromInput(event.target.value),
                              })
                            }
                            aria-label={`${option.name} price increment`}
                          />
                        </label>
                        <div className="option-availability">
                          <span>Available</span>
                          <Toggle
                            checked={option.available}
                            onChange={() =>
                              updateOption(group.id, option.id, {
                                available: !option.available,
                              })
                            }
                            label={`Toggle ${option.name} availability`}
                          />
                        </div>
                        <button
                          onClick={() =>
                            updateGroup(group.id, {
                              options: group.options.filter(
                                (item) => item.id !== option.id,
                              ),
                            })
                          }
                          aria-label={`Delete ${option.name}`}
                        >
                          <X size={15} />
                        </button>
                      </div>
                    ))}
                    <button
                      className="add-option-button"
                      onClick={() => addOption(group.id)}
                    >
                      <Plus size={15} />
                      Add option
                    </button>
                  </div>
                  {errors[`group-${groupIndex}`] && (
                    <p className="field-error group-error">
                      {errors[`group-${groupIndex}`]}
                    </p>
                  )}
                </div>
              ))
            ) : (
              <div className="empty-variants">
                <span>No variant groups</span>
                <button onClick={addGroup}>Add the first group</button>
              </div>
            )}
          </section>
        </div>
        <footer className="sheet-footer">
          {!isNew && (
            <button
              className="destructive-link delete-product-button"
              onClick={onDelete}
            >
              Delete product
            </button>
          )}
          <div className="sheet-footer-actions">
            <button className="secondary-button" onClick={onClose}>
              {dirty ? "Discard" : "Cancel"}
            </button>
            <button className="primary-button" onClick={onSave}>
              Save changes
            </button>
          </div>
        </footer>
      </aside>
    </div>
  );
}
