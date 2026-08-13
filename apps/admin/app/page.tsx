"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Clock3,
  Copy,
  Edit3,
  GripVertical,
  ImagePlus,
  LoaderCircle,
  MapPin,
  MoreVertical,
  Phone,
  Plus,
  Search,
  Store,
  Truck,
  Trash2,
  Utensils,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AppShell, type AdminView as View } from "@/components/layout/app-shell";
import { Modal } from "@/components/ui/modal";
import { Toast, type ToastTone } from "@/components/ui/toast";
import { Toggle } from "@/components/ui/toggle";
import {
  formatMoney as money,
  INITIAL_ORDERS,
  nextOrderStatus as nextStatus,
  type Order,
  type OrderStatus,
} from "@/features/orders/order-model";
import { KotView, OrderDetails, OrdersPage } from "@/features/orders/orders-screen";

interface VariantOption {
  id: string;
  name: string;
  price: number;
  available: boolean;
}

interface VariantGroup {
  id: string;
  name: string;
  type: "single" | "multi";
  required: boolean;
  min: number;
  max: number;
  options: VariantOption[];
}

interface Product {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  price: number;
  foodType: FoodType;
  tag: string;
  available: boolean;
  scheduledUnavailable: boolean;
  scheduleMode: ScheduleMode;
  scheduleSummary: string;
  scheduleStart: string;
  scheduleEnd: string;
  scheduleDays: string[];
  image?: string;
  variantGroups: VariantGroup[];
}

interface Category {
  id: string;
  name: string;
  available: boolean;
  scheduleMode: ScheduleMode;
  scheduleSummary: string;
  scheduleStart: string;
  scheduleEnd: string;
  scheduleDays: string[];
  products: Product[];
}

type CategoryDialog =
  | { type: "add" }
  | { type: "rename"; categoryId: string }
  | { type: "schedule"; categoryId: string }
  | { type: "delete"; categoryId: string }
  | null;

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];


const burgerVariants: VariantGroup[] = [
  {
    id: "size",
    name: "Choose a size",
    type: "single",
    required: true,
    min: 1,
    max: 1,
    options: [
      { id: "classic", name: "Classic", price: 0, available: true },
      { id: "double", name: "Double patty", price: 140, available: true },
    ],
  },
  {
    id: "extras",
    name: "Add something extra",
    type: "multi",
    required: false,
    min: 0,
    max: 2,
    options: [
      { id: "cheese", name: "Cheese", price: 40, available: true },
      { id: "egg", name: "Fried egg", price: 55, available: true },
    ],
  },
];

const INITIAL_CATEGORIES: Category[] = [
  {
    id: "burgers",
    name: "Burgers & wraps",
    available: true,
    scheduleMode: "restaurant",
    scheduleSummary: "All restaurant hours",
    scheduleStart: "",
    scheduleEnd: "",
    scheduleDays: DAYS,
    products: [
      {
        id: "cafreal-burger",
        name: "Chicken Cafreal Burger",
        description:
          "Goan cafreal chicken, pickled onions, lettuce and house mayo in a toasted bun.",
        categoryId: "burgers",
        price: 280,
        foodType: "Non-veg",
        tag: "Best seller",
        available: true,
        scheduledUnavailable: false,
        scheduleMode: "restaurant",
        scheduleSummary: "All restaurant hours",
        scheduleStart: "",
        scheduleEnd: "",
        scheduleDays: DAYS,
        variantGroups: burgerVariants,
      },
      {
        id: "paneer-wrap",
        name: "Paneer Tikka Wrap",
        description: "Charred paneer tikka, mint chutney, onions and crisp lettuce.",
        categoryId: "burgers",
        price: 230,
        foodType: "Veg",
        tag: "Chef’s pick",
        available: true,
        scheduledUnavailable: false,
        scheduleMode: "restaurant",
        scheduleSummary: "All restaurant hours",
        scheduleStart: "",
        scheduleEnd: "",
        scheduleDays: DAYS,
        variantGroups: [],
      },
      {
        id: "mushroom-burger",
        name: "Mushroom Melt Burger",
        description: "Peppery mushrooms, caramelised onions and melted cheddar.",
        categoryId: "burgers",
        price: 250,
        foodType: "Veg",
        tag: "",
        available: false,
        scheduledUnavailable: false,
        scheduleMode: "restaurant",
        scheduleSummary: "All restaurant hours",
        scheduleStart: "",
        scheduleEnd: "",
        scheduleDays: DAYS,
        variantGroups: [],
      },
    ],
  },
  {
    id: "beverages",
    name: "Beverages",
    available: true,
    scheduleMode: "same",
    scheduleSummary: "Daily, 4:00 PM–6:00 PM",
    scheduleStart: "16:00",
    scheduleEnd: "18:00",
    scheduleDays: DAYS,
    products: [
      {
        id: "rose-milk",
        name: "Rose Milk",
        description: "Chilled milk, rose syrup and a touch of cardamom.",
        categoryId: "beverages",
        price: 120,
        foodType: "Veg",
        tag: "Best seller",
        available: true,
        scheduledUnavailable: true,
        scheduleMode: "different",
        scheduleSummary: "Mon–Tue, 5:00 PM–6:00 PM",
        scheduleStart: "17:00",
        scheduleEnd: "18:00",
        scheduleDays: ["Mon", "Tue"],
        variantGroups: [],
      },
      {
        id: "lime-soda",
        name: "Fresh Lime Soda",
        description: "Fresh lime with soda, served sweet, salted or mixed.",
        categoryId: "beverages",
        price: 100,
        foodType: "Veg",
        tag: "",
        available: true,
        scheduledUnavailable: false,
        scheduleMode: "same",
        scheduleSummary: "Daily, 4:00 PM–6:00 PM",
        scheduleStart: "16:00",
        scheduleEnd: "18:00",
        scheduleDays: DAYS,
        variantGroups: [
          {
            id: "style",
            name: "Choose lime soda style",
            type: "single",
            required: true,
            min: 1,
            max: 1,
            options: [
              { id: "sweet", name: "Sweet", price: 0, available: true },
              { id: "salted", name: "Salted", price: 0, available: true },
              { id: "mixed", name: "Sweet & salted", price: 0, available: true },
            ],
          },
        ],
      },
      {
        id: "cold-coffee",
        name: "Cold Coffee",
        description: "Strong coffee blended with chilled milk and ice.",
        categoryId: "beverages",
        price: 180,
        foodType: "Veg",
        tag: "",
        available: true,
        scheduledUnavailable: false,
        scheduleMode: "same",
        scheduleSummary: "Daily, 4:00 PM–6:00 PM",
        scheduleStart: "16:00",
        scheduleEnd: "18:00",
        scheduleDays: DAYS,
        variantGroups: [],
      },
    ],
  },
  {
    id: "bowls",
    name: "Rice bowls",
    available: false,
    scheduleMode: "restaurant",
    scheduleSummary: "All restaurant hours",
    scheduleStart: "",
    scheduleEnd: "",
    scheduleDays: DAYS,
    products: [
      {
        id: "cafreal-bowl",
        name: "Chicken Cafreal Rice Bowl",
        description: "Cafreal chicken, jeera rice, cabbage slaw and lime.",
        categoryId: "bowls",
        price: 320,
        foodType: "Non-veg",
        tag: "",
        available: true,
        scheduledUnavailable: false,
        scheduleMode: "restaurant",
        scheduleSummary: "All restaurant hours",
        scheduleStart: "",
        scheduleEnd: "",
        scheduleDays: DAYS,
        variantGroups: [],
      },
    ],
  },
  {
    id: "desserts",
    name: "Desserts",
    available: true,
    scheduleMode: "restaurant",
    scheduleSummary: "All restaurant hours",
    scheduleStart: "",
    scheduleEnd: "",
    scheduleDays: DAYS,
    products: [],
  },
];

function cloneCategories(categories: Category[]) {
  return JSON.parse(JSON.stringify(categories)) as Category[];
}

function priceFromInput(value: string) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
}

function effectiveProductState(category: Category, product: Product) {
  if (!category.available) return "Unavailable — category off";
  if (!product.available) return "Unavailable";
  if (product.scheduledUnavailable) return "Scheduled unavailable";
  return "Available";
}

function scheduleSummaryFor(product: Product) {
  if (product.scheduleMode === "restaurant") return "All restaurant hours";
  const start = product.scheduleStart || "16:00";
  const end = product.scheduleEnd || "18:00";
  const format = (value: string) => {
    const [h, m] = value.split(":").map(Number);
    const suffix = h >= 12 ? "PM" : "AM";
    const hour = h % 12 || 12;
    return `${hour}:${String(m || 0).padStart(2, "0")} ${suffix}`;
  };
  if (product.scheduleMode === "same") {
    return `Daily, ${format(start)}–${format(end)}`;
  }
  const days = product.scheduleDays.length ? product.scheduleDays.join(", ") : "No days";
  return `${days}, ${format(start)}–${format(end)}`;
}


function FoodMarker({ type }: { type: FoodType }) {
  return (
    <span className={`food-marker food-${type.toLowerCase().replace("-", "")}`} aria-label={type}>
      <span />
    </span>
  );
}

function LoginScreen({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [method, setMethod] = useState<"phone" | "email">("phone");
  const [phoneStep, setPhoneStep] = useState<"number" | "otp">("number");
  const [phone, setPhone] = useState("94490 76076");
  const [otp, setOtp] = useState("");
  const [email, setEmail] = useState("owner@a2goa.in");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(28);

  useEffect(() => {
    if (phoneStep !== "otp" || resendSeconds <= 0) return;
    const timer = window.setInterval(() => setResendSeconds((value) => value - 1), 1000);
    return () => window.clearInterval(timer);
  }, [phoneStep, resendSeconds]);

  function finish() {
    setBusy(true);
    setError("");
    window.setTimeout(() => {
      setBusy(false);
      onAuthenticated();
    }, 650);
  }

  function submitPhone(event: React.FormEvent) {
    event.preventDefault();
    if (phoneStep === "number") {
      if (phone.replace(/\D/g, "").length < 10) {
        setError("Enter a valid 10-digit mobile number.");
        return;
      }
      setError("");
      setPhoneStep("otp");
      setResendSeconds(28);
      return;
    }
    if (!/^\d{6}$/.test(otp)) {
      setError("Enter the 6-digit code.");
      return;
    }
    finish();
  }

  function submitEmail(event: React.FormEvent) {
    event.preventDefault();
    if (!email.includes("@") || password.length < 4) {
      setError("Check your email and password, then try again.");
      return;
    }
    finish();
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <div className="brand-lockup login-brand">
          <span className="brand-mark">A2</span>
          <span>A2</span>
        </div>
        <div className="login-heading">
          <h1 id="login-title">Sign in to A2</h1>
          <p>Manage orders and your menu.</p>
        </div>

        <div className="segmented" role="tablist" aria-label="Sign in method">
          <button
            className={method === "phone" ? "active" : ""}
            onClick={() => {
              setMethod("phone");
              setError("");
            }}
            role="tab"
            aria-selected={method === "phone"}
          >
            Phone & OTP
          </button>
          <button
            className={method === "email" ? "active" : ""}
            onClick={() => {
              setMethod("email");
              setError("");
            }}
            role="tab"
            aria-selected={method === "email"}
          >
            Email & password
          </button>
        </div>

        {method === "phone" ? (
          <form onSubmit={submitPhone} className="auth-form">
            {phoneStep === "number" ? (
              <label className="field-label">
                Mobile number
                <span className="phone-input">
                  <span>+91</span>
                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    inputMode="tel"
                    autoComplete="tel"
                    aria-invalid={Boolean(error)}
                  />
                </span>
              </label>
            ) : (
              <>
                <div className="otp-sent-row">
                  <span>Code sent to +91 {phone}</span>
                  <button type="button" className="text-button" onClick={() => setPhoneStep("number")}>
                    Edit
                  </button>
                </div>
                <label className="field-label">
                  6-digit code
                  <input
                    className="otp-input"
                    value={otp}
                    onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="• • • • • •"
                    aria-invalid={Boolean(error)}
                  />
                </label>
                <button
                  type="button"
                  className="resend-button"
                  disabled={resendSeconds > 0}
                  onClick={() => setResendSeconds(28)}
                >
                  {resendSeconds > 0 ? `Resend in 00:${String(resendSeconds).padStart(2, "0")}` : "Resend code"}
                </button>
              </>
            )}
            {error && <p className="field-error" role="alert">{error}</p>}
            <button className="primary-button auth-submit" disabled={busy}>
              {busy && <LoaderCircle className="spin" size={17} />}
              {phoneStep === "number" ? "Send code" : "Verify & sign in"}
            </button>
          </form>
        ) : (
          <form onSubmit={submitEmail} className="auth-form">
            <label className="field-label">
              Email address
              <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" />
            </label>
            <label className="field-label">
              Password
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
              />
            </label>
            <button type="button" className="text-button forgot-button" onClick={() => setError("If this account exists, reset instructions have been sent.")}>
              Forgot password?
            </button>
            {error && <p className="neutral-message" role="status">{error}</p>}
            <button className="primary-button auth-submit" disabled={busy}>
              {busy && <LoaderCircle className="spin" size={17} />}
              Sign in
            </button>
          </form>
        )}
      </section>
    </main>
  );
}

function MenuAvailability({
  categories,
  busyAvailability,
  onToggleCategory,
  onToggleProduct,
  onEditMenu,
}: {
  categories: Category[];
  busyAvailability: string;
  onToggleCategory: (category: Category) => void;
  onToggleProduct: (category: Category, product: Product) => void;
  onEditMenu: () => void;
}) {
  const [expanded, setExpanded] = useState<string[]>(["burgers", "beverages"]);
  const [search, setSearch] = useState("");
  const filtered = categories.filter((category) =>
    category.name.toLowerCase().includes(search.toLowerCase()) ||
    category.products.some((product) => product.name.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <div className="page menu-page">
      <div className="menu-status-row">
        <span><span className="service-dot" />Menu live</span>
        <button className="secondary-button compact-button edit-menu-button" onClick={onEditMenu}><Edit3 size={16} />Edit menu</button>
      </div>

      <label className="search-field menu-search">
        <Search size={18} />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search categories or products" />
      </label>

      <section className="availability-list" aria-label="Menu categories">
        {filtered.map((category) => {
          const isExpanded = expanded.includes(category.id);
          return (
            <article className="availability-category" key={category.id}>
              <div className="category-availability-row">
                <button
                  className="category-expand"
                  onClick={() => setExpanded((ids) => ids.includes(category.id) ? ids.filter((id) => id !== category.id) : [...ids, category.id])}
                  aria-expanded={isExpanded}
                >
                  <ChevronRight size={18} className={isExpanded ? "rotate-right" : ""} />
                  <span>
                    <strong>{category.name}</strong>
                    <small>{category.products.length} {category.products.length === 1 ? "product" : "products"} · {category.scheduleSummary}</small>
                  </span>
                </button>
                <div className="availability-control">
                  <span className={category.available ? "available-text" : "unavailable-text"}>
                    {busyAvailability === category.id ? "Saving…" : category.available ? "Available" : "Unavailable"}
                  </span>
                  {busyAvailability === category.id ? <LoaderCircle className="spin" size={20} /> : (
                    <Toggle checked={category.available} onChange={() => onToggleCategory(category)} label={`Toggle ${category.name}`} />
                  )}
                </div>
              </div>
              {isExpanded && (
                <div className="product-availability-list">
                  {category.products.length ? category.products.map((product) => {
                    const state = effectiveProductState(category, product);
                    return (
                      <div className="product-availability-row" key={product.id}>
                        <div className={`food-thumb thumb-${product.foodType.toLowerCase().replace("-", "")}`}>
                          {product.image ? <img src={product.image} alt="" /> : <Utensils size={18} />}
                        </div>
                        <div className="product-primary">
                          <div className="product-title-line"><FoodMarker type={product.foodType} /><strong>{product.name}</strong>{product.tag && <span className="quiet-tag">{product.tag}</span>}</div>
                          <span>{money(product.price)}</span>
                          {product.scheduleMode !== "restaurant" && <small><Clock3 size={13} />{product.scheduleSummary}</small>}
                        </div>
                        <div className="availability-control product-toggle-control">
                          <span className={state === "Available" ? "available-text" : state === "Scheduled unavailable" ? "scheduled-text" : "unavailable-text"}>
                            {busyAvailability === product.id ? "Saving…" : state}
                          </span>
                          {busyAvailability === product.id ? <LoaderCircle className="spin" size={20} /> : (
                            <Toggle checked={product.available} onChange={() => onToggleProduct(category, product)} label={`Toggle ${product.name}`} disabled={!category.available} />
                          )}
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="empty-product-row"><span>No products in this category.</span></div>
                  )}
                </div>
              )}
            </article>
          );
        })}
        {!filtered.length && (
          <div className="empty-state compact-empty"><Search size={26} /><h3>No menu matches</h3><p>Try a different search.</p></div>
        )}
      </section>
    </div>
  );
}

function MenuEditor({
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
  onReorderCategory: (id: string, direction: -1 | 1) => void;
  onReorderProduct: (categoryId: string, productId: string, direction: -1 | 1) => void;
  onToggleProduct: (category: Category, product: Product) => void;
  onAddProduct: () => void;
  onEditProduct: (product: Product) => void;
  productMenuId: string;
  setProductMenuId: (id: string) => void;
  onDuplicateProduct: (product: Product) => void;
  onDeleteProduct: (product: Product) => void;
}) {
  const selected = categories.find((category) => category.id === selectedCategoryId) || categories[0];

  return (
    <div className="page menu-editor-page">
      <div className="editor-top-row">
        <button className="back-button" onClick={onBack}><ArrowLeft size={18} />Back</button>
        <div className="editor-save-group">
          {unsaved && <span className="unsaved-label"><span />Unsaved changes</span>}
          <button className="primary-button" onClick={onSave} disabled={!unsaved || saving}>
            {saving && <LoaderCircle className="spin" size={17} />}
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      <div className="menu-editor-workspace">
        <aside className="category-pane">
          <div className="pane-heading">
            <span><strong>Categories</strong><small>{categories.length}</small></span>
            <button className="icon-text-button" onClick={() => onCategoryAction({ type: "add" })}><Plus size={16} />Add</button>
          </div>
          <div className="category-editor-list">
            {categories.map((category, index) => (
              <div key={category.id} className={`editor-category-row ${selected?.id === category.id ? "selected" : ""}`}>
                <button className="category-select-button" onClick={() => onSelectCategory(category.id)}>
                  <GripVertical size={16} className="drag-handle" />
                  <span><strong>{category.name}</strong><small>{category.products.length} {category.products.length === 1 ? "product" : "products"} · {category.available ? "Available" : "Unavailable"}</small></span>
                </button>
                <div className="row-controls">
                  <button onClick={() => onReorderCategory(category.id, -1)} disabled={index === 0} aria-label={`Move ${category.name} up`}><ArrowUp size={14} /></button>
                  <button onClick={() => onReorderCategory(category.id, 1)} disabled={index === categories.length - 1} aria-label={`Move ${category.name} down`}><ArrowDown size={14} /></button>
                  <button onClick={() => setCategoryMenuId(categoryMenuId === category.id ? "" : category.id)} aria-label={`Actions for ${category.name}`}><MoreVertical size={17} /></button>
                </div>
                {categoryMenuId === category.id && (
                  <div className="row-popover" role="menu">
                    <button onClick={() => onCategoryAction({ type: "rename", categoryId: category.id })}><Edit3 size={15} />Rename</button>
                    <button onClick={() => onDuplicateCategory(category)}><Copy size={15} />Duplicate</button>
                    <button onClick={() => onCategoryAction({ type: "schedule", categoryId: category.id })}><Clock3 size={15} />Edit availability times</button>
                    <button className="danger" onClick={() => onCategoryAction({ type: "delete", categoryId: category.id })}><Trash2 size={15} />Delete</button>
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
                  <small>{selected.products.length} products · {selected.available ? "Available" : "Unavailable"} · {selected.scheduleSummary}</small>
                </span>
                <button className="primary-button compact-button" onClick={onAddProduct}><Plus size={16} />Add product</button>
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
                      <div className={`food-thumb thumb-${product.foodType.toLowerCase().replace("-", "")}`}>
                        {product.image ? <img src={product.image} alt="" /> : <Utensils size={17} />}
                      </div>
                      <div className="editor-product-info">
                        <div><FoodMarker type={product.foodType} /><strong>{product.name}</strong>{product.tag && <span className="quiet-tag">{product.tag}</span>}</div>
                        <span>{money(product.price)} · {product.available ? "Available" : "Unavailable"}</span>
                      </div>
                      <div className="editor-row-availability">
                        <span>{product.available ? "On" : "Off"}</span>
                        <Toggle checked={product.available} onChange={() => onToggleProduct(selected, product)} label={`Toggle ${product.name}`} />
                      </div>
                      <div className="row-controls product-move-controls">
                        <button onClick={(event) => { event.stopPropagation(); onReorderProduct(selected.id, product.id, -1); }} disabled={index === 0} aria-label={`Move ${product.name} up`}><ArrowUp size={14} /></button>
                        <button onClick={(event) => { event.stopPropagation(); onReorderProduct(selected.id, product.id, 1); }} disabled={index === selected.products.length - 1} aria-label={`Move ${product.name} down`}><ArrowDown size={14} /></button>
                      </div>
                      <button className="row-product-actions" onClick={(event) => { event.stopPropagation(); setProductMenuId(productMenuId === product.id ? "" : product.id); }} aria-label={`Actions for ${product.name}`} aria-expanded={productMenuId === product.id}><MoreVertical size={18} /></button>
                      {productMenuId === product.id && (
                        <div className="row-popover product-row-popover" role="menu" onClick={(event) => event.stopPropagation()}>
                          <button onClick={() => { setProductMenuId(""); onEditProduct(product); }}><Edit3 size={15} />Edit</button>
                          <button onClick={() => onDuplicateProduct(product)}><Copy size={15} />Duplicate</button>
                          <button className="danger" onClick={() => onDeleteProduct(product)}><Trash2 size={15} />Delete</button>
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
                  <button className="primary-button" onClick={onAddProduct}><Plus size={16} />Add first product</button>
                </div>
              )}
            </>
          ) : (
            <div className="empty-state editor-empty"><h3>Select a category</h3><p>Choose a category to view its products.</p></div>
          )}
        </section>
      </div>
    </div>
  );
}

function ProductEditorOverlay({
  draft,
  categories,
  dirty,
  errors,
  onChange,
  onClose,
  onSave,
  onDelete,
  isNew,
}: {
  draft: Product;
  categories: Category[];
  dirty: boolean;
  errors: Record<string, string>;
  onChange: (draft: Product) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete: () => void;
  isNew: boolean;
}) {
  function change<K extends keyof Product>(key: K, value: Product[K]) {
    onChange({ ...draft, [key]: value });
  }

  function updateGroup(groupId: string, patch: Partial<VariantGroup>) {
    change("variantGroups", draft.variantGroups.map((group) => group.id === groupId ? { ...group, ...patch } : group));
  }

  function updateOption(groupId: string, optionId: string, patch: Partial<VariantOption>) {
    change(
      "variantGroups",
      draft.variantGroups.map((group) => group.id === groupId
        ? { ...group, options: group.options.map((option) => option.id === optionId ? { ...option, ...patch } : option) }
        : group),
    );
  }

  function addGroup() {
    const id = `group-${Date.now()}`;
    change("variantGroups", [
      ...draft.variantGroups,
      { id, name: "New option group", type: "single", required: true, min: 1, max: 1, options: [] },
    ]);
  }

  function addOption(groupId: string) {
    const option: VariantOption = { id: `option-${Date.now()}`, name: "New option", price: 0, available: true };
    change("variantGroups", draft.variantGroups.map((group) => group.id === groupId ? { ...group, options: [...group.options, option] } : group));
  }

  return (
    <div className="product-editor-layer" aria-label="Product editor">
      <div className="product-editor-scrim" aria-hidden="true" />

      <section className="live-preview-shell" aria-label="Live customer preview">
        <div className="preview-label-row"><span>Live customer preview</span><small>Updates instantly</small></div>
        <div className="phone-frame">
          <div className="phone-speaker" />
          <div className="phone-screen">
            <header className="customer-preview-header">
              <span className="brand-mark tiny-mark">A2</span>
              <span><strong>A2 · Mandrem</strong><small>Delivery · 30–40 min</small></span>
            </header>
            <div className="customer-search"><Search size={14} />Search the menu</div>
            <div className="customer-category-title">
              <span><strong>{categories.find((category) => category.id === draft.categoryId)?.name || "Menu"}</strong><small>Customer menu</small></span>
              <ChevronDown size={15} />
            </div>
            <article className={`customer-product-card ${!draft.available ? "preview-unavailable" : ""}`}>
              <div className="preview-product-copy">
                <div className="product-title-line"><FoodMarker type={draft.foodType} />{draft.tag && <span className="customer-tag">{draft.tag}</span>}</div>
                <h3>{draft.name || "Product name"}</h3>
                <strong>From {money(Number(draft.price || 0))}</strong>
                {draft.description.trim() && <p>{draft.description}</p>}
                {!draft.available && <span className="preview-unavailable-label">Currently unavailable</span>}
              </div>
              <div className="preview-image-wrap">
                {draft.image ? <img src={draft.image} alt="Product preview" /> : <div className="preview-image-placeholder"><Utensils size={24} /><span>No image</span></div>}
                <button disabled={!draft.available}>ADD</button>
              </div>
            </article>
          </div>
        </div>
      </section>

      <aside className="product-sheet" role="dialog" aria-modal="true" aria-labelledby="product-editor-title">
        <header className="sheet-header">
          <div><p>{isNew ? "Add product" : "Edit product"}</p><h2 id="product-editor-title">{draft.name || "New product"}</h2></div>
          <button onClick={onClose} aria-label="Close product editor"><X size={21} /></button>
        </header>
        <div className="sheet-body">
          <section className="form-section">
            <div className="form-section-heading"><h3>Product information</h3><span>Required fields marked *</span></div>
            <label className="field-label">
              Product name *
              <input value={draft.name} onChange={(event) => change("name", event.target.value)} aria-invalid={Boolean(errors.name)} />
              {errors.name && <small className="field-error">{errors.name}</small>}
            </label>
            <label className="field-label">
              Description
              <textarea value={draft.description} onChange={(event) => change("description", event.target.value)} rows={3} maxLength={500} />
              <span className="character-count">{draft.description.length}/500</span>
            </label>
            <div className="two-field-grid">
              <label className="field-label">
                Category *
                <select value={draft.categoryId} onChange={(event) => change("categoryId", event.target.value)}>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </label>
              <label className="field-label currency-field">
                Base price *
                <span><b>₹</b><input type="number" min="0" step="0.01" value={draft.price} onChange={(event) => change("price", priceFromInput(event.target.value))} aria-invalid={Boolean(errors.price)} /></span>
                {errors.price && <small className="field-error">{errors.price}</small>}
              </label>
            </div>
            <div className="field-label">
              Food type *
              <div className="choice-row">
                {(["Veg", "Non-veg", "Egg"] as FoodType[]).map((type) => (
                  <button type="button" key={type} className={draft.foodType === type ? "selected" : ""} onClick={() => change("foodType", type)}>
                    <FoodMarker type={type} />{type}
                  </button>
                ))}
              </div>
            </div>
            <label className="field-label">
              Customer tag
              <select value={draft.tag} onChange={(event) => change("tag", event.target.value)}>
                <option value="">No tag</option>
                <option value="Best seller">Best seller</option>
                <option value="Chef’s pick">Chef’s pick</option>
              </select>
            </label>
          </section>

          <section className="form-section">
            <div className="form-section-heading"><h3>Product image</h3></div>
            <div className="image-upload-row">
              <div className="image-preview-box">
                {draft.image ? <img src={draft.image} alt="Uploaded product" /> : <><ImagePlus size={24} /><span>No image</span></>}
              </div>
              <div>
                <label className="secondary-button upload-button">
                  {draft.image ? "Replace image" : "Upload image"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) change("image", URL.createObjectURL(file));
                    }}
                  />
                </label>
                {draft.image && <button className="destructive-link remove-image" onClick={() => change("image", undefined)}>Remove</button>}
                <small>JPG, PNG or WebP · up to 10 MB</small>
              </div>
            </div>
          </section>

          <section className="form-section">
            <div className="form-section-heading"><h3>Availability</h3></div>
            <div className="availability-edit-row">
              <span><strong>Manually available</strong><small>Category and schedule rules can still block this product.</small></span>
              <div><span>{draft.available ? "On" : "Off"}</span><Toggle checked={draft.available} onChange={() => change("available", !draft.available)} label="Toggle product availability" /></div>
            </div>
            <div className="schedule-options" role="radiogroup" aria-label="Product availability times">
              <label><input type="radio" checked={draft.scheduleMode === "restaurant"} onChange={() => change("scheduleMode", "restaurant")} />All times the restaurant is open</label>
              <label><input type="radio" checked={draft.scheduleMode === "same"} onChange={() => change("scheduleMode", "same")} />Same time for all days</label>
              <label><input type="radio" checked={draft.scheduleMode === "different"} onChange={() => change("scheduleMode", "different")} />Different times on different days</label>
            </div>
            {draft.scheduleMode !== "restaurant" && (
              <div className="schedule-detail-box">
                {draft.scheduleMode === "different" && (
                  <div className="weekday-selector">
                    {DAYS.map((day) => (
                      <button key={day} className={draft.scheduleDays.includes(day) ? "selected" : ""} onClick={() => change("scheduleDays", draft.scheduleDays.includes(day) ? draft.scheduleDays.filter((value) => value !== day) : [...draft.scheduleDays, day])}>{day}</button>
                    ))}
                  </div>
                )}
                <div className="time-grid">
                  <label className="field-label">Start<input type="time" value={draft.scheduleStart} onChange={(event) => change("scheduleStart", event.target.value)} /></label>
                  <label className="field-label">End<input type="time" value={draft.scheduleEnd} onChange={(event) => change("scheduleEnd", event.target.value)} /></label>
                </div>
                {errors.schedule && <p className="field-error">{errors.schedule}</p>}
              </div>
            )}
          </section>

          <section className="form-section variants-section">
            <div className="form-section-heading variants-heading">
              <div><h3>Variants & add-ons</h3><span>Set selection rules and price increments.</span></div>
              <button className="secondary-button compact-button" onClick={addGroup}><Plus size={15} />Add group</button>
            </div>
            {draft.variantGroups.length ? draft.variantGroups.map((group, groupIndex) => (
              <div className="variant-group-editor" key={group.id}>
                <div className="variant-group-head">
                  <GripVertical size={17} className="drag-handle" />
                  <input value={group.name} onChange={(event) => updateGroup(group.id, { name: event.target.value })} aria-label={`Variant group ${groupIndex + 1} name`} />
                  <button onClick={() => change("variantGroups", draft.variantGroups.filter((item) => item.id !== group.id))} aria-label={`Delete ${group.name}`}><Trash2 size={16} /></button>
                </div>
                <div className="variant-rule-grid">
                  <label className="field-label">Selection type<select value={group.type} onChange={(event) => updateGroup(group.id, { type: event.target.value as "single" | "multi", max: event.target.value === "single" ? 1 : Math.max(2, group.max) })}><option value="single">Choose one</option><option value="multi">Add-ons (choose many)</option></select></label>
                  <label className="required-field"><input type="checkbox" checked={group.required} onChange={(event) => updateGroup(group.id, { required: event.target.checked, min: event.target.checked ? Math.max(1, group.min) : 0 })} /><span>Required</span></label>
                  {group.type === "multi" && (
                    <>
                      <label className="field-label">Minimum<input type="number" min="0" value={group.min} onChange={(event) => updateGroup(group.id, { min: Number(event.target.value) })} /></label>
                      <label className="field-label">Maximum<input type="number" min="1" value={group.max} onChange={(event) => updateGroup(group.id, { max: Number(event.target.value) })} /></label>
                    </>
                  )}
                </div>
                <div className="variant-options-list">
                  {group.options.map((option, optionIndex) => (
                    <div className="variant-option-row" key={option.id}>
                      <GripVertical size={15} className="drag-handle" />
                      <span className="option-number">{optionIndex + 1}</span>
                      <input value={option.name} onChange={(event) => updateOption(group.id, option.id, { name: event.target.value })} aria-label="Option name" />
                      <label className="option-price"><span>+ ₹</span><input type="number" min="0" step="0.01" value={option.price} onChange={(event) => updateOption(group.id, option.id, { price: priceFromInput(event.target.value) })} aria-label={`${option.name} price increment`} /></label>
                      <div className="option-availability"><span>Available</span><Toggle checked={option.available} onChange={() => updateOption(group.id, option.id, { available: !option.available })} label={`Toggle ${option.name} availability`} /></div>
                      <button onClick={() => updateGroup(group.id, { options: group.options.filter((item) => item.id !== option.id) })} aria-label={`Delete ${option.name}`}><X size={15} /></button>
                    </div>
                  ))}
                  <button className="add-option-button" onClick={() => addOption(group.id)}><Plus size={15} />Add option</button>
                </div>
                {errors[`group-${groupIndex}`] && <p className="field-error group-error">{errors[`group-${groupIndex}`]}</p>}
              </div>
            )) : (
              <div className="empty-variants"><span>No variant groups</span><button onClick={addGroup}>Add the first group</button></div>
            )}
          </section>
        </div>
        <footer className="sheet-footer">
          {!isNew && <button className="destructive-link delete-product-button" onClick={onDelete}>Delete product</button>}
          <div className="sheet-footer-actions">
            <button className="secondary-button" onClick={onClose}>{dirty ? "Discard" : "Cancel"}</button>
            <button className="primary-button" onClick={onSave}>Save changes</button>
          </div>
        </footer>
      </aside>
    </div>
  );
}

function BusinessSettings({ activeBranch, orderingOpen, onOrderingToggle, dirty, onDirtyChange, onSaved }: { activeBranch: string; orderingOpen: boolean; onOrderingToggle: () => void; dirty: boolean; onDirtyChange: (dirty: boolean) => void; onSaved: (section: string) => void }) {
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState("general");
  const [orderType, setOrderType] = useState("both");
  const [taxRate, setTaxRate] = useState("18%");
  const [allowClosed, setAllowClosed] = useState(false);
  const [hours, setHours] = useState(DAYS.map((day, index) => ({ day, open: index !== 0, start: "08:00", end: "22:30" })));
  const [zones, setZones] = useState([{ id: "local", name: "Mandrem & Ashvem", min: 0, max: 5, fee: 35, freeAt: 650, minimum: 0, cost: 24, active: true }, { id: "nearby", name: "Arambol", min: 5, max: 12, fee: 60, freeAt: 900, minimum: 0, cost: 42, active: true }]);
  const [zoneError, setZoneError] = useState("");
  const sections = [["general", "General"], ["ordering", "Ordering"], ["hours", "Opening Hours"], ["tax", "Tax"], ["delivery", "Delivery"], ["commercials", "Commercials"]];
  const markDirty = () => onDirtyChange(true);
  const save = (section: string) => { if (section === "delivery") { const invalid = zones.some((zone) => zone.min >= zone.max) || zones.some((zone, index) => zones.some((other, otherIndex) => index !== otherIndex && zone.min < other.max && other.min < zone.max)); if (invalid) { setZoneError("Distance ranges cannot overlap. Adjust the zone boundaries, then save again."); return; } setZoneError(""); } onDirtyChange(false); onSaved(section); };
  const updateZone = (id: string, key: string, value: string | number | boolean) => { setZones((current) => current.map((zone) => zone.id === id ? { ...zone, [key]: value } : zone)); setZoneError(""); markDirty(); };
  const input = (label: string, value: string, type = "text") => <label className="field-label">{label}<input type={type} defaultValue={value} onChange={markDirty} /></label>;
  useEffect(() => { const timer = window.setTimeout(() => setLoading(false), 320); return () => window.clearTimeout(timer); }, []);
  if (loading) return <div className="settings-page page"><div className="settings-loading"><span /><span /><span /><span /></div></div>;
  return <div className="settings-page page">
    <div className="settings-context"><span><Store size={16} />Settings for <strong>{activeBranch.replace("A2 · ", "")}</strong></span></div>
    <div className="settings-layout">
      <nav className="settings-nav" aria-label="Business settings sections">{sections.map(([id, label]) => <button key={id} className={activeSection === id ? "active" : ""} onClick={() => { setActiveSection(id); document.getElementById(`settings-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>{label}</button>)}</nav>
      <main className="settings-content">
        <section id="settings-general" className="settings-section"><div className="settings-section-head"><div><h2>General</h2><p>Business information shown to customers and staff for this outlet.</p></div></div><div className="settings-grid">{input("Business name", "A2 Food & Beverages")}{input("Location / outlet name", activeBranch.replace("A2 · ", ""))}{input("Contact phone", "+91 94490 76076", "tel")}<label className="field-label settings-full">Address<textarea defaultValue="House 14, Palm Grove Lane" onChange={markDirty} rows={2} /></label>{input("Locality", "Mandrem")}{input("City", "North Goa")}{input("State", "Goa")}{input("PIN code", "403527")}</div><div className="map-location"><MapPin size={18} /><span><strong>Restaurant map location</strong><small>Mandrem Beach Road, Goa</small></span><button className="secondary-button compact-button" onClick={markDirty}>Search address</button><button className="text-button" onClick={markDirty}>Use current location</button></div><div className="section-save"><button className="primary-button" onClick={() => save("General")}>Save changes</button></div></section>
        <section id="settings-ordering" className="settings-section"><div className="settings-section-head"><div><h2>Ordering</h2><p>Choose how customers can place online orders from this outlet.</p></div></div><div className="operational-setting"><span><strong>Accepting orders</strong><small>Temporarily stop customers from placing new online orders.</small></span><div><span className={orderingOpen ? "available-text" : "unavailable-text"}>{orderingOpen ? "On" : "Off"}</span><Toggle checked={orderingOpen} onChange={onOrderingToggle} label="Toggle accepting orders" /></div></div><div className="settings-grid"><label className="field-label settings-full">Order types<div className="choice-row">{[["delivery", "Delivery"], ["pickup", "Pickup"], ["both", "Delivery & Pickup"]].map(([id,label]) => <button key={id} type="button" className={orderType === id ? "selected" : ""} onClick={() => { setOrderType(id); markDirty(); }}>{label}</button>)}</div></label><label className="field-label currency-field">Minimum order value<span><b>₹</b><input type="number" min="0" step="0.01" defaultValue="200" onChange={markDirty} /></span><small>Applied at checkout.</small></label><label className="field-label">Default preparation time<input type="number" min="1" defaultValue="25" onChange={markDirty} /><small>Minutes. Product-level timing takes priority when set.</small></label></div><label className="settings-toggle-line"><input type="checkbox" checked={allowClosed} onChange={(event) => { setAllowClosed(event.target.checked); markDirty(); }} /><span><strong>Allow orders when closed</strong><small>Customers can order for a later fulfilment window.</small></span></label><div className="section-save"><button className="primary-button" onClick={() => save("Ordering")}>Save changes</button></div></section>
        <section id="settings-hours" className="settings-section"><div className="settings-section-head"><div><h2>Opening Hours</h2><p>Weekly outlet hours in Asia/Kolkata.</p></div></div><div className="hours-editor">{hours.map((row, index) => <div className="hours-row" key={row.day}><strong>{row.day}</strong><Toggle checked={row.open} onChange={() => { setHours((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, open: !item.open } : item)); markDirty(); }} label={`${row.day} open`} />{row.open ? <><input type="time" value={row.start} onChange={(event) => { setHours((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, start: event.target.value } : item)); markDirty(); }} /><span>to</span><input type="time" value={row.end} onChange={(event) => { setHours((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, end: event.target.value } : item)); markDirty(); }} /></> : <span className="closed-label">Closed</span>}</div>)}</div><div className="section-save"><button className="primary-button" onClick={() => save("Opening hours")}>Save changes</button></div></section>
        <section id="settings-tax" className="settings-section"><div className="settings-section-head"><div><h2>Tax</h2><p>Applied automatically to eligible orders.</p></div></div><div className="tax-options">{["0%", "5%", "12%", "18%", "28%"].map((rate) => <button key={rate} className={taxRate === rate ? "selected" : ""} onClick={() => { setTaxRate(rate); markDirty(); }}>{rate}</button>)}</div><div className="section-save"><button className="primary-button" onClick={() => save("Tax")}>Save changes</button></div></section>
        <section id="settings-delivery" className="settings-section"><div className="settings-section-head"><div><h2>Delivery</h2><p>Set customer charges and coverage by distance from this outlet.</p></div><button className="secondary-button compact-button" onClick={() => { setZones((current) => [...current, { id: `zone-${Date.now()}`, name: "New zone", min: 12, max: 18, fee: 0, freeAt: 0, minimum: 0, cost: 0, active: true }]); markDirty(); }}><Plus size={15} />Add zone</button></div>{zones.length ? <div className="delivery-zones">{zones.map((zone, index) => <div className="delivery-zone" key={zone.id}><div className="zone-number">{index + 1}</div><div className="zone-fields"><label className="field-label">Zone name<input value={zone.name} onChange={(event) => updateZone(zone.id, "name", event.target.value)} /></label><label className="field-label">Distance range<div className="range-fields"><input type="number" value={zone.min} onChange={(event) => updateZone(zone.id, "min", Number(event.target.value))} /><span>to</span><input type="number" value={zone.max} onChange={(event) => updateZone(zone.id, "max", Number(event.target.value))} /><small>km</small></div></label><label className="field-label">Delivery fee<div className="currency-field"><span><b>₹</b><input type="number" value={zone.fee} onChange={(event) => updateZone(zone.id, "fee", Number(event.target.value))} /></span></div></label><label className="field-label">Free delivery at<div className="currency-field"><span><b>₹</b><input type="number" value={zone.freeAt} onChange={(event) => updateZone(zone.id, "freeAt", Number(event.target.value))} /></span></div></label><label className="field-label">Zone minimum <div className="currency-field"><span><b>₹</b><input type="number" value={zone.minimum} onChange={(event) => updateZone(zone.id, "minimum", Number(event.target.value))} /></span></div></label><label className="field-label">Estimated delivery cost<div className="currency-field"><span><b>₹</b><input type="number" value={zone.cost} onChange={(event) => updateZone(zone.id, "cost", Number(event.target.value))} /></span></div><small>Used to estimate delivery margin.</small></label></div><div className="zone-actions"><Toggle checked={zone.active} onChange={() => updateZone(zone.id, "active", !zone.active)} label={`${zone.name} active`} /><button className="destructive-link" onClick={() => { setZones((current) => current.filter((item) => item.id !== zone.id)); markDirty(); }}>Remove</button></div></div>)}</div> : <div className="empty-state compact-empty"><Truck size={26} /><h3>No delivery zones</h3><p>Add a distance range to start offering delivery.</p></div>}{zoneError && <p className="field-error">{zoneError}</p>}<div className="section-save"><button className="primary-button" onClick={() => save("Delivery")}>Save changes</button></div></section>
        <section id="settings-commercials" className="settings-section"><div className="settings-section-head"><div><h2>Commercials</h2><p>Read-only agreement details for this business.</p></div></div><div className="commercials-grid"><div><span>Platform commission</span><strong>8%</strong><small>Applied to eligible direct-order revenue according to your agreement.</small></div><div><span>Aggregator benchmark</span><strong>40%</strong><small>Used only to estimate aggregator fees avoided in analytics.</small></div></div><div className="managed-note"><CircleAlert size={16} /><span><strong>Managed by your account team</strong>Contact them to review these commercial terms.</span></div><div className="read-only-meta"><span>Currency <strong>INR</strong></span><span>Timezone <strong>Asia/Kolkata</strong></span></div></section>
      </main>
    </div>
    {dirty && <div className="settings-unsaved-bar"><span><span />Unsaved changes</span><button className="primary-button compact-button" onClick={() => save("Business")}>Save changes</button></div>}
  </div>;
}

export default function Home() {
  const [authenticated, setAuthenticated] = useState(true);
  const [view, setView] = useState<View>("orders");
  const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS);
  const [categories, setCategories] = useState<Category[]>(() => cloneCategories(INITIAL_CATEGORIES));
  const [savedCategories, setSavedCategories] = useState<Category[]>(() => cloneCategories(INITIAL_CATEGORIES));
  const [selectedOrderId, setSelectedOrderId] = useState("1048");
  const [selectedCategoryId, setSelectedCategoryId] = useState("burgers");
  const [statusFilter, setStatusFilter] = useState<"All" | OrderStatus>("All");
  const [orderingOpen, setOrderingOpen] = useState(true);
  const [pauseConfirm, setPauseConfirm] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<View | null>(null);
  const [busyOrderId, setBusyOrderId] = useState("");
  const [busyAvailability, setBusyAvailability] = useState("");
  const [cancelOrderId, setCancelOrderId] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [cancelOther, setCancelOther] = useState("");
  const [refundAck, setRefundAck] = useState(false);
  const [activeBranch, setActiveBranch] = useState("A2 · Mandrem");
  const branches = ["A2 · Mandrem", "A2 · Arambol"];
  const [toast, setToast] = useState<{ tone: ToastTone; message: string } | null>(null);
  const toastTimer = useRef<number | null>(null);

  const [unsavedMenu, setUnsavedMenu] = useState(false);
  const [unsavedSettings, setUnsavedSettings] = useState(false);
  const [savingMenu, setSavingMenu] = useState(false);
  const [categoryMenuId, setCategoryMenuId] = useState("");
  const [productMenuId, setProductMenuId] = useState("");
  const [categoryDialog, setCategoryDialog] = useState<CategoryDialog>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [categoryScheduleMode, setCategoryScheduleMode] = useState<ScheduleMode>("restaurant");
  const [categoryScheduleStart, setCategoryScheduleStart] = useState("16:00");
  const [categoryScheduleEnd, setCategoryScheduleEnd] = useState("18:00");
  const [categoryScheduleDays, setCategoryScheduleDays] = useState<string[]>(DAYS);

  const [productDraft, setProductDraft] = useState<Product | null>(null);
  const [productOrigin, setProductOrigin] = useState<{ categoryId: string; productId: string | null } | null>(null);
  const [productDirty, setProductDirty] = useState(false);
  const [productErrors, setProductErrors] = useState<Record<string, string>>({});
  const [discardProductConfirm, setDiscardProductConfirm] = useState(false);
  const [deleteProductConfirm, setDeleteProductConfirm] = useState(false);
  const [productDeleteTarget, setProductDeleteTarget] = useState<Product | null>(null);

  const selectedOrder = orders.find((order) => order.id === selectedOrderId) || orders[0];
  const cancelOrder = orders.find((order) => order.id === cancelOrderId);

  useEffect(() => {
    document.body.style.overflow = productDraft ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [productDraft]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && productDraft) {
        if (productDirty) setDiscardProductConfirm(true);
        else closeProductEditor();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function showToast(message: string, tone: ToastTone = "success") {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({ message, tone });
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  }

  function navigate(nextView: View) {
    if ((view === "menu-editor" && unsavedMenu && nextView !== "menu-editor") || (view === "settings" && unsavedSettings && nextView !== "settings")) {
      setPendingNavigation(nextView);
      return;
    }
    setView(nextView);
  }

  function discardMenuAndNavigate() {
    if (!pendingNavigation) return;
    setCategories(cloneCategories(savedCategories));
    setUnsavedMenu(false);
    setUnsavedSettings(false);
    setPendingNavigation(null);
    setView(pendingNavigation);
  }

  function progressOrder(order: Order) {
    const status = nextStatus(order.status);
    if (!status) return;
    setBusyOrderId(order.id);
    window.setTimeout(() => {
      const time = new Date().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
      setOrders((current) => current.map((item) => item.id === order.id
        ? {
            ...item,
            status,
            age: status === "Delivered" ? `Delivered ${time}` : item.age,
            timeline: item.timeline.map((entry) => entry.label === (status === "Preparing" ? "Accepted" : status) ? { ...entry, complete: true, time } : entry),
          }
        : item));
      setBusyOrderId("");
      showToast(`Order #${order.id} moved to ${status}.`);
    }, 650);
  }

  function orderCopyText(order: Order) {
    const items = order.items.map((item) => {
      const variants = item.variants?.length ? ` (${item.variants.join(", ")})` : "";
      const note = item.instructions ? ` — ${item.instructions}` : "";
      return `${item.qty} x ${item.name}${variants}${note}`;
    }).join("\n");
    return `A2 Order #${order.id}\nCustomer: ${order.customer} · ${order.phone}\n\n${items}\n\nOrder note: ${order.instructions || "None"}\nAddress: ${order.fullAddress}\nDelivery: ${order.deliveryInstructions}\nTotal: ${money(order.total)} · ${order.paid ? "Paid" : "Cash on delivery"}`;
  }

  async function copyOrder(order: Order) {
    try {
      await navigator.clipboard.writeText(orderCopyText(order));
      showToast("Copied for WhatsApp.");
    } catch {
      showToast("Copy failed. Try again.", "error");
    }
  }

  function openOrder(order: Order) {
    setSelectedOrderId(order.id);
    setView("order-detail");
  }

  function openKOT(order: Order) {
    setSelectedOrderId(order.id);
    setView("kot");
  }

  function requestCancel(order: Order) {
    setCancelOrderId(order.id);
    setCancelReason("");
    setCancelOther("");
    setRefundAck(false);
  }

  function confirmCancel() {
    if (!cancelOrder || !cancelReason || (cancelReason === "Other" && !cancelOther.trim()) || (cancelOrder.paid && !refundAck)) return;
    const reason = cancelReason === "Other" ? cancelOther.trim() : cancelReason;
    const time = new Date().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
    setOrders((current) => current.map((order) => order.id === cancelOrder.id ? {
      ...order,
      status: "Cancelled",
      cancellationReason: reason,
      timeline: [...order.timeline.filter((item) => item.label !== "Delivered"), { label: "Cancelled", time, complete: true }],
    } : order));
    setCancelOrderId("");
    showToast(`Order #${cancelOrder.id} cancelled. Manual refund responsibility recorded.`, "info");
  }

  function toggleCategoryAvailability(category: Category) {
    setBusyAvailability(category.id);
    window.setTimeout(() => {
      setCategories((current) => current.map((item) => item.id === category.id ? { ...item, available: !item.available } : item));
      setSavedCategories((current) => current.map((item) => item.id === category.id ? { ...item, available: !item.available } : item));
      setBusyAvailability("");
      showToast(`${category.name} ${category.available ? "made unavailable" : "is available"}.`);
    }, 480);
  }

  function toggleProductAvailability(category: Category, product: Product, staged = false) {
    if (staged) {
      setCategories((current) => current.map((item) => item.id === category.id ? { ...item, products: item.products.map((entry) => entry.id === product.id ? { ...entry, available: !entry.available } : entry) } : item));
      setUnsavedMenu(true);
      return;
    }
    setBusyAvailability(product.id);
    window.setTimeout(() => {
      setCategories((current) => current.map((item) => item.id === category.id ? { ...item, products: item.products.map((entry) => entry.id === product.id ? { ...entry, available: !entry.available } : entry) } : item));
      setSavedCategories((current) => current.map((item) => item.id === category.id ? { ...item, products: item.products.map((entry) => entry.id === product.id ? { ...entry, available: !entry.available } : entry) } : item));
      setBusyAvailability("");
      showToast(`${product.name} ${product.available ? "made unavailable" : "is available"}.`);
    }, 480);
  }

  function saveMenu() {
    setSavingMenu(true);
    window.setTimeout(() => {
      setSavingMenu(false);
      setSavedCategories(cloneCategories(categories));
      setUnsavedMenu(false);
      showToast("Menu changes saved.");
    }, 700);
  }

  function reorderCategory(id: string, direction: -1 | 1) {
    setCategories((current) => {
      const index = current.findIndex((category) => category.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setUnsavedMenu(true);
  }

  function reorderProduct(categoryId: string, productId: string, direction: -1 | 1) {
    setCategories((current) => current.map((category) => {
      if (category.id !== categoryId) return category;
      const index = category.products.findIndex((product) => product.id === productId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= category.products.length) return category;
      const products = [...category.products];
      [products[index], products[target]] = [products[target], products[index]];
      return { ...category, products };
    }));
    setUnsavedMenu(true);
  }

  function openCategoryDialog(dialog: CategoryDialog) {
    setCategoryMenuId("");
    setCategoryDialog(dialog);
    setCategoryError("");
    if (!dialog) return;
    if (dialog.type === "add") {
      setCategoryName("");
      return;
    }
    const category = categories.find((item) => item.id === dialog.categoryId);
    if (!category) return;
    setCategoryName(category.name);
    setCategoryScheduleMode(category.scheduleMode);
    setCategoryScheduleStart(category.scheduleStart || "16:00");
    setCategoryScheduleEnd(category.scheduleEnd || "18:00");
    setCategoryScheduleDays(category.scheduleDays);
  }

  function saveCategoryDialog() {
    if (!categoryDialog) return;
    if (categoryDialog.type === "add" || categoryDialog.type === "rename") {
      const name = categoryName.trim();
      if (!name) {
        setCategoryError("Category name is required.");
        return;
      }
      const duplicate = categories.some((category) => category.name.toLowerCase() === name.toLowerCase() && (categoryDialog.type === "add" || category.id !== categoryDialog.categoryId));
      if (duplicate) {
        setCategoryError("A category with this name already exists.");
        return;
      }
      if (categoryDialog.type === "add") {
        const id = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
        setCategories((current) => [...current, { id, name, available: true, scheduleMode: "restaurant", scheduleSummary: "All restaurant hours", scheduleStart: "", scheduleEnd: "", scheduleDays: DAYS, products: [] }]);
        setSelectedCategoryId(id);
      } else {
        setCategories((current) => current.map((category) => category.id === categoryDialog.categoryId ? { ...category, name } : category));
      }
      setUnsavedMenu(true);
      setCategoryDialog(null);
      return;
    }
    if (categoryDialog.type === "schedule") {
      if (categoryScheduleMode !== "restaurant" && (!categoryScheduleStart || !categoryScheduleEnd || categoryScheduleStart >= categoryScheduleEnd)) {
        setCategoryError("End time must be later than start time.");
        return;
      }
      if (categoryScheduleMode === "different" && !categoryScheduleDays.length) {
        setCategoryError("Select at least one day.");
        return;
      }
      const template = categories.find((category) => category.id === categoryDialog.categoryId)?.products[0] || INITIAL_CATEGORIES[0].products[0];
      const summary = scheduleSummaryFor({ ...template, scheduleMode: categoryScheduleMode, scheduleStart: categoryScheduleStart, scheduleEnd: categoryScheduleEnd, scheduleDays: categoryScheduleDays });
      setCategories((current) => current.map((category) => category.id === categoryDialog.categoryId ? { ...category, scheduleMode: categoryScheduleMode, scheduleStart: categoryScheduleStart, scheduleEnd: categoryScheduleEnd, scheduleDays: categoryScheduleDays, scheduleSummary: summary } : category));
      setUnsavedMenu(true);
      setCategoryDialog(null);
      return;
    }
    if (categoryDialog.type === "delete") {
      const category = categories.find((item) => item.id === categoryDialog.categoryId);
      if (category?.products.length) return;
      setCategories((current) => current.filter((item) => item.id !== categoryDialog.categoryId));
      setSelectedCategoryId(categories.find((item) => item.id !== categoryDialog.categoryId)?.id || "");
      setUnsavedMenu(true);
      setCategoryDialog(null);
    }
  }

  function duplicateCategory(category: Category) {
    const id = `${category.id}-copy-${Date.now()}`;
    const clone: Category = {
      ...JSON.parse(JSON.stringify(category)),
      id,
      name: `Copy of ${category.name}`,
      products: category.products.map((product) => ({ ...JSON.parse(JSON.stringify(product)), id: `${product.id}-copy-${Date.now()}-${Math.random()}`, categoryId: id })),
    };
    setCategories((current) => [...current, clone]);
    setSelectedCategoryId(id);
    setUnsavedMenu(true);
    setCategoryMenuId("");
    showToast(`${clone.name} created. Review before saving.`, "info");
  }

  function duplicateProduct(product: Product) {
    const now = Date.now();
    const clone = JSON.parse(JSON.stringify(product)) as Product;
    clone.id = `${product.id}-copy-${now}`;
    clone.name = `Copy of ${product.name}`;
    clone.variantGroups = clone.variantGroups.map((group, groupIndex) => ({
      ...group,
      id: `${group.id}-copy-${now}-${groupIndex}`,
      options: group.options.map((option, optionIndex) => ({ ...option, id: `${option.id}-copy-${now}-${optionIndex}` })),
    }));
    setCategories((current) => current.map((category) => category.id === product.categoryId ? { ...category, products: [...category.products, clone] } : category));
    setUnsavedMenu(true);
    setProductMenuId("");
    showToast(`${clone.name} created. Review before saving.`, "info");
  }

  function requestDeleteProductFromMenu(product: Product) {
    setProductMenuId("");
    setProductDeleteTarget(product);
  }

  function deleteProductFromMenu() {
    if (!productDeleteTarget) return;
    const name = productDeleteTarget.name;
    setCategories((current) => current.map((category) => category.id === productDeleteTarget.categoryId ? { ...category, products: category.products.filter((product) => product.id !== productDeleteTarget.id) } : category));
    setUnsavedMenu(true);
    setProductDeleteTarget(null);
    showToast(`${name} deleted. Save the menu to publish.`, "info");
  }

  function createBlankProduct(): Product {
    return {
      id: `product-${Date.now()}`,
      name: "",
      description: "",
      categoryId: selectedCategoryId,
      price: 0,
      foodType: "Veg",
      tag: "",
      available: true,
      scheduledUnavailable: false,
      scheduleMode: "restaurant",
      scheduleSummary: "All restaurant hours",
      scheduleStart: "",
      scheduleEnd: "",
      scheduleDays: DAYS,
      variantGroups: [],
    };
  }

  function openNewProduct() {
    setProductDraft(createBlankProduct());
    setProductOrigin({ categoryId: selectedCategoryId, productId: null });
    setProductDirty(true);
    setProductErrors({});
  }

  function openEditProduct(product: Product) {
    setProductDraft(JSON.parse(JSON.stringify(product)) as Product);
    setProductOrigin({ categoryId: product.categoryId, productId: product.id });
    setProductDirty(false);
    setProductErrors({});
  }

  function closeProductEditor() {
    setProductDraft(null);
    setProductOrigin(null);
    setProductDirty(false);
    setProductErrors({});
    setDiscardProductConfirm(false);
    setDeleteProductConfirm(false);
  }

  function requestCloseProduct() {
    if (productDirty) setDiscardProductConfirm(true);
    else closeProductEditor();
  }

  function validateProduct(product: Product) {
    const errors: Record<string, string> = {};
    if (!product.name.trim()) errors.name = "Product name is required.";
    if (!Number.isFinite(product.price) || product.price <= 0) errors.price = "Enter a price greater than ₹0.";
    if (product.scheduleMode !== "restaurant") {
      if (!product.scheduleStart || !product.scheduleEnd || product.scheduleStart >= product.scheduleEnd) errors.schedule = "End time must be later than start time.";
      if (product.scheduleMode === "different" && !product.scheduleDays.length) errors.schedule = "Select at least one day.";
    }
    product.variantGroups.forEach((group, index) => {
      if (group.required && !group.options.length) errors[`group-${index}`] = "A required group needs at least one option.";
      else if (group.type === "multi" && (group.min > group.max || group.max < 1)) errors[`group-${index}`] = "Minimum cannot exceed maximum.";
      else if (group.options.some((option) => !option.name.trim() || option.price < 0)) errors[`group-${index}`] = "Every option needs a name and valid price.";
    });
    return errors;
  }

  function saveProduct() {
    if (!productDraft || !productOrigin) return;
    const errors = validateProduct(productDraft);
    setProductErrors(errors);
    if (Object.keys(errors).length) {
      showToast("Fix the highlighted fields before saving.", "error");
      return;
    }
    const finalProduct = { ...productDraft, scheduleSummary: scheduleSummaryFor(productDraft) };
    setCategories((current) => {
      if (productOrigin.productId && productOrigin.categoryId === finalProduct.categoryId) {
        return current.map((category) => category.id === finalProduct.categoryId ? { ...category, products: category.products.map((product) => product.id === finalProduct.id ? finalProduct : product) } : category);
      }
      return current.map((category) => {
        const products = category.products.filter((product) => product.id !== productOrigin.productId);
        return category.id === finalProduct.categoryId ? { ...category, products: [...products, finalProduct] } : { ...category, products };
      });
    });
    setSelectedCategoryId(finalProduct.categoryId);
    setUnsavedMenu(true);
    closeProductEditor();
    showToast(`${finalProduct.name} updated in the menu.`);
  }

  function deleteProduct() {
    if (!productOrigin?.productId || !productDraft) return;
    setCategories((current) => current.map((category) => ({ ...category, products: category.products.filter((product) => product.id !== productOrigin.productId) })));
    setUnsavedMenu(true);
    const name = productDraft.name;
    closeProductEditor();
    showToast(`${name} deleted. Save the menu to publish.`, "info");
  }

  if (!authenticated) {
    return <LoginScreen onAuthenticated={() => { setAuthenticated(true); setView("orders"); }} />;
  }

  if (view === "kot" && selectedOrder) {
    return <KotView order={selectedOrder} onBack={() => setView("order-detail")} />;
  }

  let content: React.ReactNode;
  if (view === "orders") {
    content = (
      <OrdersPage
        orders={orders}
        orderingOpen={orderingOpen}
        onOrderingToggle={() => orderingOpen ? setPauseConfirm(true) : setOrderingOpen(true)}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        busyOrderId={busyOrderId}
        onProgress={progressOrder}
        onOpen={openOrder}
        onCopy={copyOrder}
        onKOT={openKOT}
        onCancel={requestCancel}
      />
    );
  } else if (view === "menu") {
    content = (
      <MenuAvailability
        categories={categories}
        busyAvailability={busyAvailability}
        onToggleCategory={toggleCategoryAvailability}
        onToggleProduct={(category, product) => toggleProductAvailability(category, product)}
        onEditMenu={() => setView("menu-editor")}
      />
    );
  } else if (view === "menu-editor") {
    content = (
      <MenuEditor
        categories={categories}
        selectedCategoryId={selectedCategoryId}
        onSelectCategory={setSelectedCategoryId}
        unsaved={unsavedMenu}
        saving={savingMenu}
        onSave={saveMenu}
        onBack={() => navigate("menu")}
        categoryMenuId={categoryMenuId}
        setCategoryMenuId={setCategoryMenuId}
        onCategoryAction={openCategoryDialog}
        onDuplicateCategory={duplicateCategory}
        onReorderCategory={reorderCategory}
        onReorderProduct={reorderProduct}
        onToggleProduct={(category, product) => toggleProductAvailability(category, product, true)}
        onAddProduct={openNewProduct}
        onEditProduct={openEditProduct}
        productMenuId={productMenuId}
        setProductMenuId={setProductMenuId}
        onDuplicateProduct={duplicateProduct}
        onDeleteProduct={requestDeleteProductFromMenu}
      />
    );
  } else if (view === "settings") {
    content = <BusinessSettings activeBranch={activeBranch} orderingOpen={orderingOpen} dirty={unsavedSettings} onOrderingToggle={() => orderingOpen ? setPauseConfirm(true) : (setOrderingOpen(true), showToast("Ordering resumed. Customers can place new orders.", "info"))} onDirtyChange={setUnsavedSettings} onSaved={(section) => showToast(`${section} settings saved.`)} />;
  } else {
    content = (
      <OrderDetails
        order={selectedOrder}
        busy={busyOrderId === selectedOrder.id}
        onBack={() => setView("orders")}
        onProgress={() => progressOrder(selectedOrder)}
        onCopy={() => copyOrder(selectedOrder)}
        onKOT={() => openKOT(selectedOrder)}
        onCancel={() => requestCancel(selectedOrder)}
      />
    );
  }

  const categoryForDialog = categoryDialog && categoryDialog.type !== "add" ? categories.find((category) => category.id === categoryDialog.categoryId) : null;
  const canConfirmCancel = Boolean(cancelOrder && cancelReason && (cancelReason !== "Other" || cancelOther.trim()) && (!cancelOrder.paid || refundAck));

  return (
    <>
      <AppShell
        view={view}
        onNavigate={navigate}
        activeBranch={activeBranch}
        branches={branches}
        onBranchChange={(branch) => { setActiveBranch(branch); showToast(`Switched to ${branch}.`, "info"); }}
        onSignOut={() => { setAuthenticated(false); setView("orders"); }}
        orderingOpen={orderingOpen}
        onKillSwitch={() => orderingOpen ? setPauseConfirm(true) : (setOrderingOpen(true), showToast("Ordering resumed. Customers can place new orders.", "info"))}
      >
        {content}
      </AppShell>

      {productDraft && (
        <ProductEditorOverlay
          draft={productDraft}
          categories={categories}
          dirty={productDirty}
          errors={productErrors}
          onChange={(draft) => { setProductDraft(draft); setProductDirty(true); setProductErrors({}); }}
          onClose={requestCloseProduct}
          onSave={saveProduct}
          onDelete={() => setDeleteProductConfirm(true)}
          isNew={!productOrigin?.productId}
        />
      )}

      {pauseConfirm && (
        <Modal
          title="Pause new orders?"
          onClose={() => setPauseConfirm(false)}
          footer={<><button className="secondary-button" onClick={() => setPauseConfirm(false)}>Keep accepting</button><button className="danger-button" onClick={() => { setOrderingOpen(false); setPauseConfirm(false); showToast("Ordering paused manually.", "info"); }}>Pause ordering</button></>}
        >
          <p>Customers will not be able to place new orders until ordering is resumed.</p>
          <div className="modal-info-row"><Clock3 size={17} /><span><strong>Current schedule</strong>Open until 10:30 PM</span></div>
        </Modal>
      )}

      {pendingNavigation && (
        <Modal
          title={view === "settings" ? "Your settings are mid-recipe" : "Your menu has a plot twist"}
          onClose={() => setPendingNavigation(null)}
          footer={<><button className="secondary-button" onClick={() => setPendingNavigation(null)}>Keep editing</button><button className="danger-button" onClick={discardMenuAndNavigate}>Leave without saving</button></>}
        >
          <p>{view === "settings" ? "A few changes are still on the counter. Leaving now will put the saved settings back exactly as they were." : "You have menu changes waiting in the wings. Leaving now will send them back to the kitchen—unsaved."}</p>
          <div className="modal-info-row"><CircleAlert size={17} /><span><strong>Nothing has gone live.</strong>{view === "settings" ? "Your current outlet settings will stay exactly as they were." : "Your customer menu will stay exactly as it was."}</span></div>
        </Modal>
      )}

      {cancelOrder && (
        <Modal
          title={`Cancel order #${cancelOrder.id}`}
          onClose={() => setCancelOrderId("")}
          destructive
          wide
          footer={<><button className="secondary-button" onClick={() => setCancelOrderId("")}>Keep order</button><button className="danger-button" disabled={!canConfirmCancel} onClick={confirmCancel}>Confirm cancellation</button></>}
        >
          <div className="cancel-summary"><span><strong>{cancelOrder.customer}</strong><small>{cancelOrder.phone}</small></span><span><small>{cancelOrder.status}</small><strong>{money(cancelOrder.total)} · {cancelOrder.paid ? "Paid" : "Cash"}</strong></span></div>
          <fieldset className="reason-list">
            <legend>Reason *</legend>
            {["Item unavailable", "Restaurant unable to fulfil", "Customer requested cancellation", "Duplicate order", "Other"].map((reason) => (
              <label key={reason}><input type="radio" name="cancel-reason" checked={cancelReason === reason} onChange={() => setCancelReason(reason)} />{reason}</label>
            ))}
          </fieldset>
          {cancelReason === "Other" && <label className="field-label">Describe the reason *<textarea value={cancelOther} onChange={(event) => setCancelOther(event.target.value)} rows={2} /></label>}
          {cancelOrder.paid && (
            <label className="refund-ack"><input type="checkbox" checked={refundAck} onChange={(event) => setRefundAck(event.target.checked)} /><span><strong>I will handle this {money(cancelOrder.total)} refund manually.</strong><small>This action records responsibility; it does not send a provider refund.</small></span></label>
          )}
          <div className="call-nudge"><Phone size={18} /><span><strong>Please call the customer to explain the cancellation.</strong><small>{cancelOrder.phone}</small></span><a href={`tel:${cancelOrder.phone.replaceAll(" ", "")}`}>Call</a><button onClick={() => navigator.clipboard?.writeText(cancelOrder.phone)}>Copy</button></div>
        </Modal>
      )}

      {categoryDialog && (
        <Modal
          title={categoryDialog.type === "add" ? "Add category" : categoryDialog.type === "rename" ? "Rename category" : categoryDialog.type === "schedule" ? "Availability times" : "Delete category"}
          onClose={() => setCategoryDialog(null)}
          destructive={categoryDialog.type === "delete"}
          footer={<><button className="secondary-button" onClick={() => setCategoryDialog(null)}>Cancel</button><button className={categoryDialog.type === "delete" ? "danger-button" : "primary-button"} disabled={categoryDialog.type === "delete" && Boolean(categoryForDialog?.products.length)} onClick={saveCategoryDialog}>{categoryDialog.type === "delete" ? "Delete category" : "Save"}</button></>}
        >
          {(categoryDialog.type === "add" || categoryDialog.type === "rename") && <label className="field-label">Category name *<input autoFocus value={categoryName} onChange={(event) => setCategoryName(event.target.value)} aria-invalid={Boolean(categoryError)} />{categoryError && <small className="field-error">{categoryError}</small>}</label>}
          {categoryDialog.type === "schedule" && (
            <>
              <div className="schedule-options" role="radiogroup">
                <label><input type="radio" checked={categoryScheduleMode === "restaurant"} onChange={() => setCategoryScheduleMode("restaurant")} />All times the restaurant is open</label>
                <label><input type="radio" checked={categoryScheduleMode === "same"} onChange={() => setCategoryScheduleMode("same")} />Same time for all days</label>
                <label><input type="radio" checked={categoryScheduleMode === "different"} onChange={() => setCategoryScheduleMode("different")} />Different times on different days</label>
              </div>
              {categoryScheduleMode !== "restaurant" && <div className="schedule-detail-box">{categoryScheduleMode === "different" && <div className="weekday-selector">{DAYS.map((day) => <button key={day} className={categoryScheduleDays.includes(day) ? "selected" : ""} onClick={() => setCategoryScheduleDays(categoryScheduleDays.includes(day) ? categoryScheduleDays.filter((value) => value !== day) : [...categoryScheduleDays, day])}>{day}</button>)}</div>}<div className="time-grid"><label className="field-label">Start<input type="time" value={categoryScheduleStart} onChange={(event) => setCategoryScheduleStart(event.target.value)} /></label><label className="field-label">End<input type="time" value={categoryScheduleEnd} onChange={(event) => setCategoryScheduleEnd(event.target.value)} /></label></div></div>}
              {categoryError && <p className="field-error">{categoryError}</p>}
            </>
          )}
          {categoryDialog.type === "delete" && <div className="delete-explanation"><CircleAlert size={20} /><span><strong>{categoryForDialog?.name}</strong>{categoryForDialog?.products.length ? ` contains ${categoryForDialog.products.length} products. Deletion is blocked until the backend move/archive rule is finalised.` : " is empty and can be deleted. This is staged until you save the menu."}</span></div>}
        </Modal>
      )}

      {discardProductConfirm && (
        <Modal title="Discard product changes?" onClose={() => setDiscardProductConfirm(false)} footer={<><button className="secondary-button" onClick={() => setDiscardProductConfirm(false)}>Continue editing</button><button className="danger-button" onClick={closeProductEditor}>Discard changes</button></>}>
          <p>Your unsaved edits to {productDraft?.name || "this product"} will be lost.</p>
        </Modal>
      )}

      {deleteProductConfirm && (
        <Modal title="Delete this product?" onClose={() => setDeleteProductConfirm(false)} destructive footer={<><button className="secondary-button" onClick={() => setDeleteProductConfirm(false)}>Keep product</button><button className="danger-button" onClick={deleteProduct}>Delete product</button></>}>
          <p>{productDraft?.name} will be removed when the menu changes are saved.</p>
        </Modal>
      )}

      {productDeleteTarget && (
        <Modal title="Delete this product?" onClose={() => setProductDeleteTarget(null)} destructive footer={<><button className="secondary-button" onClick={() => setProductDeleteTarget(null)}>Keep product</button><button className="danger-button" onClick={deleteProductFromMenu}>Delete product</button></>}>
          <p>{productDeleteTarget.name} will be removed when the menu changes are saved.</p>
        </Modal>
      )}

      {toast && (
        <Toast
          tone={toast.tone}
          message={toast.message}
          onDismiss={() => setToast(null)}
        />
      )}
    </>
  );
}
