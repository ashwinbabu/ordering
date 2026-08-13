"use client";

import { CircleAlert, Clock3, Phone } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AppShell, type AdminView as View } from "@/components/layout/app-shell";
import { Modal } from "@/components/ui/modal";
import { Toast, type ToastTone } from "@/components/ui/toast";
import { LoginScreen } from "@/features/auth/login-screen";
import { useAuth } from "@/features/auth/auth-context";
import { useOutletContext } from "@/features/outlet-context/outlet-context";
import { useOrderingStatus } from "@/features/ordering-status/ordering-status-context";
import { formatMoney as money, INITIAL_ORDERS, nextOrderStatus as nextStatus, type Order, type OrderStatus } from "@/features/orders/order-model";
import { KotView, OrderDetails, OrdersPage } from "@/features/orders/orders-screen";
import { cloneCategories, DAYS, INITIAL_CATEGORIES, scheduleSummaryFor, type Category, type CategoryDialog, type Product, type ScheduleMode } from "@/features/menu/menu-model";
import { MenuAvailability, MenuEditor, ProductEditorOverlay } from "@/features/menu/menu-screen";
import { BusinessSettings } from "@/features/business-settings/business-settings-screen";

export function AdminApp() {
  const { authenticated, signIn, signOut } = useAuth();
  const { activeBranch, branches, setActiveBranch } = useOutletContext();
  const { orderingOpen, pauseOrdering, resumeOrdering } = useOrderingStatus();
  const [view, setView] = useState<View>("orders");
  const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS);
  const [categories, setCategories] = useState<Category[]>(() => cloneCategories(INITIAL_CATEGORIES));
  const [savedCategories, setSavedCategories] = useState<Category[]>(() => cloneCategories(INITIAL_CATEGORIES));
  const [selectedOrderId, setSelectedOrderId] = useState("1048");
  const [selectedCategoryId, setSelectedCategoryId] = useState("burgers");
  const [statusFilter, setStatusFilter] = useState<"All" | OrderStatus>("All");
  const [pauseConfirm, setPauseConfirm] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<View | null>(null);
  const [busyOrderId, setBusyOrderId] = useState("");
  const [busyAvailability, setBusyAvailability] = useState("");
  const [cancelOrderId, setCancelOrderId] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [cancelOther, setCancelOther] = useState("");
  const [refundAck, setRefundAck] = useState(false);
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
    return <LoginScreen onAuthenticated={() => { signIn(); setView("orders"); }} />;
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
        onOrderingToggle={() => orderingOpen ? setPauseConfirm(true) : resumeOrdering()}
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
    content = <BusinessSettings activeBranch={activeBranch} orderingOpen={orderingOpen} dirty={unsavedSettings} onOrderingToggle={() => orderingOpen ? setPauseConfirm(true) : (resumeOrdering(), showToast("Ordering resumed. Customers can place new orders.", "info"))} onDirtyChange={setUnsavedSettings} onSaved={(section) => showToast(`${section} settings saved.`)} />;
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
        onSignOut={() => { signOut(); setView("orders"); }}
        orderingOpen={orderingOpen}
        onKillSwitch={() => orderingOpen ? setPauseConfirm(true) : (resumeOrdering(), showToast("Ordering resumed. Customers can place new orders.", "info"))}
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
          footer={<><button className="secondary-button" onClick={() => setPauseConfirm(false)}>Keep accepting</button><button className="danger-button" onClick={() => { pauseOrdering(); setPauseConfirm(false); showToast("Ordering paused manually.", "info"); }}>Pause ordering</button></>}
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
