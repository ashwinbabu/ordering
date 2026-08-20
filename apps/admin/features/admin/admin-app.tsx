"use client";

import { CircleAlert, Clock3, Phone } from "lucide-react";
import { useEffect, useRef, useState, type SetStateAction } from "react";
import {
  AppShell,
  type AdminView as View,
} from "@/components/layout/app-shell";
import { Modal } from "@/components/ui/modal";
import { Toast, type ToastTone } from "@/components/ui/toast";
import { LoginScreen } from "@/features/auth/login-screen";
import { useAuth } from "@/features/auth/auth-context";
import { useOutletContext } from "@/features/outlet-context/outlet-context";
import { useOrderingStatus } from "@/features/ordering-status/ordering-status-context";
import {
  defaultOrdersDateRange,
  formatMoney as money,
  nextOrderStatus as nextStatus,
  type Order,
  type OrderStatus,
  type OrdersDateRange,
} from "@/features/orders/order-model";
import {
  useOrdersQuery,
  useTransitionOrderMutation,
} from "@/features/orders/orders-query";
import { useNewOrderAlarm } from "@/features/orders/use-new-order-alarm";
import {
  KotView,
  OrderDetails,
  OrdersPage,
} from "@/features/orders/orders-screen";
import {
  cloneCategories,
  createMenuId,
  DAYS,
  duplicateMenuProduct,
  scheduleSummaryFor,
  type Category,
  type CategoryDialog,
  type Product,
  type ScheduleMode,
} from "@/features/menu/menu-model";
import {
  MenuAvailability,
  MenuEditor,
  ProductEditorOverlay,
} from "@/features/menu/menu-screen";
import {
  useMenuQuery,
  useSaveMenuMutation,
  useSetCategoryAvailabilityMutation,
  useSetProductAvailabilityMutation,
} from "@/features/menu/menu-query";
import type { MenuBaseline, MenuData } from "@/features/menu/api/menu-api";
import { BusinessSettings } from "@/features/business-settings/business-settings-screen";

interface LocalMenuState {
  scopeKey: string;
  categories: Category[];
  savedCategories: Category[];
  baseline: MenuBaseline;
}

function nextOrderBackendStatus(status: string | undefined) {
  if (status === "placed" || status === "needs_attention") return "accepted";
  if (status === "accepted" || status === "ready_for_pickup")
    return "out_for_delivery";
  if (status === "out_for_delivery") return "delivered";
  return null;
}

export function AdminApp() {
  const { authenticated, loading: authLoading, signOut } = useAuth();
  const {
    activeBusiness,
    activeLocation,
    locations,
    loading: outletLoading,
    error: outletError,
    selectLocation,
    retry: retryOutletContext,
  } = useOutletContext();
  const { orderingOpen, pauseOrdering, resumeOrdering, scheduleLabel } =
    useOrderingStatus();
  const menuQuery = useMenuQuery(
    activeBusiness?.id ?? null,
    activeLocation?.id ?? null,
  );
  const [ordersDateRange, setOrdersDateRange] = useState<OrdersDateRange>(() =>
    defaultOrdersDateRange(),
  );
  const ordersQuery = useOrdersQuery(
    activeBusiness?.id ?? null,
    activeLocation?.id ?? null,
    ordersDateRange,
  );
  const transitionOrderMutation = useTransitionOrderMutation();
  const saveMenuMutation = useSaveMenuMutation();
  const setCategoryAvailabilityMutation = useSetCategoryAvailabilityMutation();
  const setProductAvailabilityMutation = useSetProductAvailabilityMutation();
  const [view, setView] = useState<View>("orders");
  const [menuState, setMenuState] = useState<LocalMenuState | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | OrderStatus>("All");
  const [pauseConfirm, setPauseConfirm] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<View | null>(null);
  const [pendingLocationId, setPendingLocationId] = useState<string | null>(
    null,
  );
  const [busyOrderId, setBusyOrderId] = useState("");
  const [busyAvailability, setBusyAvailability] = useState("");
  const [cancelOrderId, setCancelOrderId] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [cancelOther, setCancelOther] = useState("");
  const [refundAck, setRefundAck] = useState(false);
  const [toast, setToast] = useState<{
    tone: ToastTone;
    message: string;
  } | null>(null);
  const toastTimer = useRef<number | null>(null);

  const [unsavedMenu, setUnsavedMenu] = useState(false);
  const [unsavedSettings, setUnsavedSettings] = useState(false);
  const [settingsResetToken, setSettingsResetToken] = useState(0);
  const [savingMenu, setSavingMenu] = useState(false);
  const [categoryMenuId, setCategoryMenuId] = useState("");
  const [productMenuId, setProductMenuId] = useState("");
  const [categoryDialog, setCategoryDialog] = useState<CategoryDialog>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [categoryScheduleMode, setCategoryScheduleMode] =
    useState<ScheduleMode>("restaurant");
  const [categoryScheduleStart, setCategoryScheduleStart] = useState("16:00");
  const [categoryScheduleEnd, setCategoryScheduleEnd] = useState("18:00");
  const [categoryScheduleDays, setCategoryScheduleDays] =
    useState<string[]>(DAYS);

  const [productDraft, setProductDraft] = useState<Product | null>(null);
  const [productOrigin, setProductOrigin] = useState<{
    categoryId: string;
    productId: string | null;
  } | null>(null);
  const [productDirty, setProductDirty] = useState(false);
  const [productErrors, setProductErrors] = useState<Record<string, string>>(
    {},
  );
  const [discardProductConfirm, setDiscardProductConfirm] = useState(false);
  const [deleteProductConfirm, setDeleteProductConfirm] = useState(false);
  const [productDeleteTarget, setProductDeleteTarget] =
    useState<Product | null>(null);

  const menuScopeKey =
    activeBusiness && activeLocation
      ? `${activeBusiness.id}:${activeLocation.id}`
      : null;
  const scopedMenuState =
    menuState?.scopeKey === menuScopeKey ? menuState : null;
  const categories =
    scopedMenuState?.categories ?? menuQuery.data?.categories ?? [];
  const savedCategories =
    scopedMenuState?.savedCategories ?? menuQuery.data?.categories ?? [];
  const menuBaseline =
    scopedMenuState?.baseline ?? menuQuery.data?.baseline ?? null;
  const currentSelectedCategoryId = categories.some(
    (category) => category.id === selectedCategoryId,
  )
    ? selectedCategoryId
    : (categories[0]?.id ?? "");
  const orders = ordersQuery.data ?? [];
  useNewOrderAlarm(orders, activeLocation?.id ?? null);

  const selectedOrder =
    orders.find((order) => order.recordId === selectedOrderId) || orders[0];
  const cancelOrder = orders.find((order) => order.recordId === cancelOrderId);

  useEffect(() => {
    document.body.style.overflow = productDraft ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [productDraft]);

  // A product draft is scoped to the outlet it was opened against. Switching
  // outlets while it's open would otherwise let a save seed the new outlet's
  // (still-loading) menu state from this draft alone.
  useEffect(() => {
    closeProductEditor();
  }, [menuScopeKey]);

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

  function setCategories(update: SetStateAction<Category[]>) {
    if (!menuScopeKey) return;
    setMenuState((current) => {
      const scoped = current?.scopeKey === menuScopeKey ? current : null;
      const currentCategories =
        scoped?.categories ?? menuQuery.data?.categories ?? [];
      const currentSavedCategories =
        scoped?.savedCategories ?? menuQuery.data?.categories ?? [];
      const currentBaseline = scoped?.baseline ??
        menuQuery.data?.baseline ?? { categories: [], products: [] };
      return {
        scopeKey: menuScopeKey,
        categories:
          typeof update === "function" ? update(currentCategories) : update,
        savedCategories: currentSavedCategories,
        baseline: currentBaseline,
      };
    });
  }

  function replaceMenuState(data: MenuData) {
    if (!menuScopeKey) return;
    setMenuState({
      scopeKey: menuScopeKey,
      categories: cloneCategories(data.categories),
      savedCategories: cloneCategories(data.categories),
      baseline: data.baseline,
    });
    setSelectedCategoryId((current) =>
      data.categories.some((category) => category.id === current)
        ? current
        : (data.categories[0]?.id ?? ""),
    );
  }

  async function persistMenu(categoriesToSave: Category[], reloadMenu = true) {
    if (!activeBusiness || !activeLocation || !menuBaseline) {
      throw new Error(
        "The menu is still loading. Please try again in a moment.",
      );
    }

    const baseline = await saveMenuMutation.mutateAsync({
      businessId: activeBusiness.id,
      locationId: activeLocation.id,
      baseline: menuBaseline,
      categories: categoriesToSave,
    });
    if (!reloadMenu) {
      replaceMenuState({ categories: categoriesToSave, baseline });
      return;
    }
    const refreshed = await menuQuery.refetch();
    if (refreshed.error) throw refreshed.error;
    if (!refreshed.data)
      throw new Error("The saved menu could not be reloaded.");
    replaceMenuState(refreshed.data);
  }

  function navigate(nextView: View) {
    if (
      (view === "menu-editor" && unsavedMenu && nextView !== "menu-editor") ||
      (view === "settings" && unsavedSettings && nextView !== "settings")
    ) {
      setPendingNavigation(nextView);
      return;
    }
    setView(nextView);
  }

  function switchLocation(locationId: string) {
    const branch = locations.find((location) => location.id === locationId);
    setSelectedOrderId("");
    setCancelOrderId("");
    setStatusFilter("All");
    selectLocation(locationId);
    showToast(
      `Switched to ${branch ? `${branch.businessName} · ${branch.name}` : "outlet"}.`,
      "info",
    );
  }

  function requestLocationChange(locationId: string) {
    if (locationId === activeLocation?.id) return;
    if (unsavedMenu || unsavedSettings) {
      setPendingLocationId(locationId);
      return;
    }
    switchLocation(locationId);
  }

  function discardChangesAndContinue() {
    setCategories(cloneCategories(savedCategories));
    setUnsavedMenu(false);
    setUnsavedSettings(false);
    setSettingsResetToken((current) => current + 1);
    if (pendingLocationId) {
      switchLocation(pendingLocationId);
      setPendingLocationId(null);
      return;
    }
    if (!pendingNavigation) return;
    setPendingNavigation(null);
    setView(pendingNavigation);
  }

  async function resumeOrderingWithFeedback() {
    try {
      await resumeOrdering();
      showToast("Ordering resumed. Customers can place new orders.", "info");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Could not resume ordering.",
        "error",
      );
    }
  }

  async function pauseOrderingWithFeedback() {
    try {
      await pauseOrdering();
      showToast("Ordering paused manually.", "info");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Could not pause ordering.",
        "error",
      );
    } finally {
      setPauseConfirm(false);
    }
  }

  async function progressOrder(order: Order) {
    const status = nextStatus(order.status);
    const nextBackendStatus = nextOrderBackendStatus(order.backendStatus);
    if (
      !status ||
      !nextBackendStatus ||
      !order.recordId ||
      !order.backendStatus ||
      !activeBusiness ||
      !activeLocation
    )
      return;
    setBusyOrderId(order.id);
    try {
      await transitionOrderMutation.mutateAsync({
        businessId: activeBusiness.id,
        locationId: activeLocation.id,
        orderId: order.recordId,
        expectedStatus: order.backendStatus,
        newStatus: nextBackendStatus,
      });
      showToast(`Order #${order.id} moved to ${status}.`);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Could not update the order.",
        "error",
      );
    } finally {
      setBusyOrderId("");
    }
  }

  function orderCopyText(order: Order) {
    const items = order.items
      .map((item) => {
        const variants = item.variants?.length
          ? ` (${item.variants.join(", ")})`
          : "";
        const note = item.instructions ? ` — ${item.instructions}` : "";
        return `${item.qty} x ${item.name}${variants}${note}`;
      })
      .join("\n");
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
    setSelectedOrderId(order.recordId ?? "");
    setView("order-detail");
  }

  function openKOT(order: Order) {
    setSelectedOrderId(order.recordId ?? "");
    setView("kot");
  }

  function requestCancel(order: Order) {
    setCancelOrderId(order.recordId ?? "");
    setCancelReason("");
    setCancelOther("");
    setRefundAck(false);
  }

  async function confirmCancel() {
    if (
      !cancelOrder ||
      !cancelReason ||
      (cancelReason === "Other" && !cancelOther.trim()) ||
      (cancelOrder.paid && !refundAck)
    )
      return;
    const reason = cancelReason === "Other" ? cancelOther.trim() : cancelReason;
    if (
      !cancelOrder.recordId ||
      !cancelOrder.backendStatus ||
      !activeBusiness ||
      !activeLocation
    )
      return;
    setBusyOrderId(cancelOrder.id);
    try {
      await transitionOrderMutation.mutateAsync({
        businessId: activeBusiness.id,
        locationId: activeLocation.id,
        orderId: cancelOrder.recordId,
        expectedStatus: cancelOrder.backendStatus,
        newStatus: "cancelled",
        cancelReason: reason,
      });
      setCancelOrderId("");
      showToast(
        `Order #${cancelOrder.id} cancelled. Manual refund responsibility recorded.`,
        "info",
      );
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Could not cancel the order.",
        "error",
      );
    } finally {
      setBusyOrderId("");
    }
  }

  // Availability toggles write a single row directly (RLS-scoped, not the
  // whole-menu RPC) and patch this local staged copy on success -- menuState
  // is what the screens actually render, so a mutation-cache patch alone
  // (see useSetCategoryAvailabilityMutation) isn't enough on its own.
  function commitCategoryAvailability(
    categoryId: string,
    isActive: boolean,
    updatedAt: string,
  ) {
    if (!menuScopeKey) return;
    setMenuState((current) => {
      const scoped = current?.scopeKey === menuScopeKey ? current : null;
      const patch = (list: Category[]) =>
        list.map((item) =>
          item.id === categoryId ? { ...item, available: isActive } : item,
        );
      const baseCategories =
        scoped?.categories ?? menuQuery.data?.categories ?? [];
      const baseSaved =
        scoped?.savedCategories ?? menuQuery.data?.categories ?? [];
      const baseBaseline = scoped?.baseline ??
        menuQuery.data?.baseline ?? { categories: [], products: [] };
      return {
        scopeKey: menuScopeKey,
        categories: patch(baseCategories),
        savedCategories: patch(baseSaved),
        baseline: {
          ...baseBaseline,
          categories: baseBaseline.categories.map((entry) =>
            entry.id === categoryId ? { ...entry, updatedAt } : entry,
          ),
        },
      };
    });
  }

  function commitProductAvailability(
    categoryId: string,
    productId: string,
    isAvailable: boolean,
  ) {
    if (!menuScopeKey) return;
    setMenuState((current) => {
      const scoped = current?.scopeKey === menuScopeKey ? current : null;
      const patch = (list: Category[]) =>
        list.map((item) =>
          item.id === categoryId
            ? {
                ...item,
                products: item.products.map((entry) =>
                  entry.id === productId
                    ? { ...entry, available: isAvailable }
                    : entry,
                ),
              }
            : item,
        );
      const baseCategories =
        scoped?.categories ?? menuQuery.data?.categories ?? [];
      const baseSaved =
        scoped?.savedCategories ?? menuQuery.data?.categories ?? [];
      const baseBaseline = scoped?.baseline ??
        menuQuery.data?.baseline ?? { categories: [], products: [] };
      return {
        scopeKey: menuScopeKey,
        categories: patch(baseCategories),
        savedCategories: patch(baseSaved),
        baseline: baseBaseline,
      };
    });
  }

  async function toggleCategoryAvailability(category: Category) {
    if (!activeBusiness || !activeLocation) return;
    const nextActive = !category.available;
    setBusyAvailability(category.id);
    try {
      const result = await setCategoryAvailabilityMutation.mutateAsync({
        businessId: activeBusiness.id,
        locationId: activeLocation.id,
        categoryId: category.id,
        isActive: nextActive,
      });
      commitCategoryAvailability(category.id, nextActive, result.updatedAt);
      showToast(
        `${category.name} ${category.available ? "made unavailable" : "is available"}.`,
      );
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Could not update category availability.",
        "error",
      );
    } finally {
      setBusyAvailability("");
    }
  }

  async function toggleProductAvailability(
    category: Category,
    product: Product,
    staged = false,
  ) {
    if (staged) {
      setCategories((current) =>
        current.map((item) =>
          item.id === category.id
            ? {
                ...item,
                products: item.products.map((entry) =>
                  entry.id === product.id
                    ? { ...entry, available: !entry.available }
                    : entry,
                ),
              }
            : item,
        ),
      );
      setUnsavedMenu(true);
      return;
    }
    if (!activeBusiness || !activeLocation) return;
    const nextAvailable = !product.available;
    setBusyAvailability(product.id);
    try {
      await setProductAvailabilityMutation.mutateAsync({
        businessId: activeBusiness.id,
        locationId: activeLocation.id,
        productId: product.id,
        isAvailable: nextAvailable,
      });
      commitProductAvailability(category.id, product.id, nextAvailable);
      showToast(
        `${product.name} ${product.available ? "made unavailable" : "is available"}.`,
      );
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Could not update product availability.",
        "error",
      );
    } finally {
      setBusyAvailability("");
    }
  }

  async function saveMenu() {
    setSavingMenu(true);
    try {
      await persistMenu(categories);
      setUnsavedMenu(false);
      showToast("Menu changes saved.");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Could not save menu changes.",
        "error",
      );
    } finally {
      setSavingMenu(false);
    }
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

  function reorderProduct(
    categoryId: string,
    productId: string,
    direction: -1 | 1,
  ) {
    setCategories((current) =>
      current.map((category) => {
        if (category.id !== categoryId) return category;
        const index = category.products.findIndex(
          (product) => product.id === productId,
        );
        const target = index + direction;
        if (index < 0 || target < 0 || target >= category.products.length)
          return category;
        const products = [...category.products];
        [products[index], products[target]] = [
          products[target],
          products[index],
        ];
        return { ...category, products };
      }),
    );
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
      const duplicate = categories.some(
        (category) =>
          category.name.toLowerCase() === name.toLowerCase() &&
          (categoryDialog.type === "add" ||
            category.id !== categoryDialog.categoryId),
      );
      if (duplicate) {
        setCategoryError("A category with this name already exists.");
        return;
      }
      if (categoryDialog.type === "add") {
        const id = createMenuId();
        setCategories((current) => [
          ...current,
          {
            id,
            name,
            description: "",
            available: true,
            scheduleMode: "restaurant",
            scheduleSummary: "All restaurant hours",
            scheduleStart: "",
            scheduleEnd: "",
            scheduleDays: DAYS,
            products: [],
          },
        ]);
        setSelectedCategoryId(id);
      } else {
        setCategories((current) =>
          current.map((category) =>
            category.id === categoryDialog.categoryId
              ? { ...category, name }
              : category,
          ),
        );
      }
      setUnsavedMenu(true);
      setCategoryDialog(null);
      return;
    }
    if (categoryDialog.type === "schedule") {
      if (
        categoryScheduleMode !== "restaurant" &&
        (!categoryScheduleStart ||
          !categoryScheduleEnd ||
          categoryScheduleStart >= categoryScheduleEnd)
      ) {
        setCategoryError("End time must be later than start time.");
        return;
      }
      if (
        categoryScheduleMode === "different" &&
        !categoryScheduleDays.length
      ) {
        setCategoryError("Select at least one day.");
        return;
      }
      const summary = scheduleSummaryFor({
        scheduleMode: categoryScheduleMode,
        scheduleStart: categoryScheduleStart,
        scheduleEnd: categoryScheduleEnd,
        scheduleDays: categoryScheduleDays,
      });
      setCategories((current) =>
        current.map((category) =>
          category.id === categoryDialog.categoryId
            ? {
                ...category,
                scheduleMode: categoryScheduleMode,
                scheduleStart: categoryScheduleStart,
                scheduleEnd: categoryScheduleEnd,
                scheduleDays: categoryScheduleDays,
                scheduleSummary: summary,
              }
            : category,
        ),
      );
      setUnsavedMenu(true);
      setCategoryDialog(null);
      return;
    }
    if (categoryDialog.type === "delete") {
      const category = categories.find(
        (item) => item.id === categoryDialog.categoryId,
      );
      if (category?.products.length) return;
      setCategories((current) =>
        current.filter((item) => item.id !== categoryDialog.categoryId),
      );
      setSelectedCategoryId(
        categories.find((item) => item.id !== categoryDialog.categoryId)?.id ||
          "",
      );
      setUnsavedMenu(true);
      setCategoryDialog(null);
    }
  }

  function duplicateCategory(category: Category) {
    const id = createMenuId();
    const clone: Category = {
      ...category,
      id,
      name: `Copy of ${category.name}`,
      scheduleDays: [...category.scheduleDays],
      products: category.products.map((product) =>
        duplicateMenuProduct(product, id),
      ),
    };
    setCategories((current) => [...current, clone]);
    setSelectedCategoryId(id);
    setUnsavedMenu(true);
    setCategoryMenuId("");
    showToast(`${clone.name} created. Review before saving.`, "info");
  }

  function duplicateProduct(product: Product) {
    const clone = duplicateMenuProduct(product);
    clone.name = `Copy of ${product.name}`;
    setCategories((current) =>
      current.map((category) =>
        category.id === product.categoryId
          ? { ...category, products: [...category.products, clone] }
          : category,
      ),
    );
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
    setCategories((current) =>
      current.map((category) =>
        category.id === productDeleteTarget.categoryId
          ? {
              ...category,
              products: category.products.filter(
                (product) => product.id !== productDeleteTarget.id,
              ),
            }
          : category,
      ),
    );
    setUnsavedMenu(true);
    setProductDeleteTarget(null);
    showToast(`${name} deleted. Save the menu to publish.`, "info");
  }

  function createBlankProduct(): Product {
    return {
      id: createMenuId(),
      name: "",
      description: "",
      categoryId: currentSelectedCategoryId,
      price: 0,
      prepTimeMinutes: null,
      foodType: "Veg",
      tag: "",
      catalogAvailable: true,
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
    setProductOrigin({
      categoryId: currentSelectedCategoryId,
      productId: null,
    });
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
    if (!Number.isFinite(product.price) || product.price <= 0)
      errors.price = "Enter a price greater than ₹0.";
    if (product.scheduleMode !== "restaurant") {
      if (
        !product.scheduleStart ||
        !product.scheduleEnd ||
        product.scheduleStart >= product.scheduleEnd
      )
        errors.schedule = "End time must be later than start time.";
      if (product.scheduleMode === "different" && !product.scheduleDays.length)
        errors.schedule = "Select at least one day.";
    }
    product.variantGroups.forEach((group, index) => {
      if (group.required && !group.options.length)
        errors[`group-${index}`] =
          "A required group needs at least one option.";
      else if (
        group.type === "multi" &&
        (group.min > group.max || group.max < 1)
      )
        errors[`group-${index}`] = "Minimum cannot exceed maximum.";
      else if (
        group.options.some((option) => !option.name.trim() || option.price < 0)
      )
        errors[`group-${index}`] = "Every option needs a name and valid price.";
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
    const finalProduct = {
      ...productDraft,
      scheduleSummary: scheduleSummaryFor(productDraft),
    };
    setCategories((current) => {
      if (
        productOrigin.productId &&
        productOrigin.categoryId === finalProduct.categoryId
      ) {
        return current.map((category) =>
          category.id === finalProduct.categoryId
            ? {
                ...category,
                products: category.products.map((product) =>
                  product.id === finalProduct.id ? finalProduct : product,
                ),
              }
            : category,
        );
      }
      return current.map((category) => {
        const products = category.products.filter(
          (product) => product.id !== productOrigin.productId,
        );
        return category.id === finalProduct.categoryId
          ? { ...category, products: [...products, finalProduct] }
          : { ...category, products };
      });
    });
    setSelectedCategoryId(finalProduct.categoryId);
    setUnsavedMenu(true);
    closeProductEditor();
    showToast(`${finalProduct.name} updated in the menu.`);
  }

  function deleteProduct() {
    if (!productOrigin?.productId || !productDraft) return;
    setCategories((current) =>
      current.map((category) => ({
        ...category,
        products: category.products.filter(
          (product) => product.id !== productOrigin.productId,
        ),
      })),
    );
    setUnsavedMenu(true);
    const name = productDraft.name;
    closeProductEditor();
    showToast(`${name} deleted. Save the menu to publish.`, "info");
  }

  if (authLoading) {
    return <main className="login-page" aria-label="Checking your session" />;
  }

  if (!authenticated) {
    return <LoginScreen />;
  }

  if (outletLoading) {
    return (
      <OutletContextState
        title="Loading your business"
        message="We’re confirming the business and outlet available to this account."
      />
    );
  }

  if (outletError) {
    return (
      <OutletContextState
        title="Couldn’t load your business"
        message={outletError.message}
        onRetry={retryOutletContext}
        onSignOut={() => {
          void signOut();
        }}
      />
    );
  }

  if (!activeBusiness || !activeLocation) {
    return (
      <OutletContextState
        title="No active outlet available"
        message="This account does not have an active business membership with an active outlet."
        onSignOut={() => {
          void signOut();
        }}
      />
    );
  }

  const branches = locations.map((location) => ({
    id: location.id,
    label: `${location.businessName} · ${location.name}`,
  }));
  const activeBranch = branches.find(
    (branch) => branch.id === activeLocation.id,
  ) ?? {
    id: activeLocation.id,
    label: `${activeLocation.businessName} · ${activeLocation.name}`,
  };

  if (view === "kot" && selectedOrder) {
    return (
      <KotView order={selectedOrder} onBack={() => setView("order-detail")} />
    );
  }

  let content: React.ReactNode;
  if (view === "orders" && ordersQuery.isPending) {
    content = (
      <MenuDataState
        title="Loading orders"
        message="Fetching the orders for this outlet."
      />
    );
  } else if (view === "orders" && ordersQuery.error) {
    content = (
      <MenuDataState
        title="Couldn’t load orders"
        message={ordersQuery.error.message}
        onRetry={() => {
          void ordersQuery.refetch();
        }}
      />
    );
  } else if (view === "orders") {
    content = (
      <OrdersPage
        orders={orders}
        orderingOpen={orderingOpen}
        onOrderingToggle={() => {
          if (orderingOpen) setPauseConfirm(true);
          else void resumeOrderingWithFeedback();
        }}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        dateRange={ordersDateRange}
        setDateRange={setOrdersDateRange}
        busyOrderId={busyOrderId}
        onProgress={progressOrder}
        onOpen={openOrder}
        onCopy={copyOrder}
        onKOT={openKOT}
        onCancel={requestCancel}
      />
    );
  } else if (
    (view === "menu" || view === "menu-editor") &&
    menuQuery.isPending
  ) {
    content = (
      <MenuDataState
        title="Loading menu"
        message="Fetching the categories and products for this outlet."
      />
    );
  } else if ((view === "menu" || view === "menu-editor") && menuQuery.error) {
    content = (
      <MenuDataState
        title="Couldn’t load menu"
        message={menuQuery.error.message}
        onRetry={() => {
          void menuQuery.refetch();
        }}
      />
    );
  } else if (view === "menu") {
    content = (
      <MenuAvailability
        categories={categories}
        timezone={activeBusiness.timezone}
        busyAvailability={busyAvailability}
        onToggleCategory={toggleCategoryAvailability}
        onToggleProduct={(category, product) =>
          toggleProductAvailability(category, product)
        }
        onEditMenu={() => setView("menu-editor")}
      />
    );
  } else if (view === "menu-editor") {
    content = (
      <MenuEditor
        categories={categories}
        selectedCategoryId={currentSelectedCategoryId}
        onSelectCategory={setSelectedCategoryId}
        unsaved={unsavedMenu}
        saving={savingMenu}
        onSave={saveMenu}
        onBack={() => navigate("menu")}
        categoryMenuId={categoryMenuId}
        setCategoryMenuId={setCategoryMenuId}
        onCategoryAction={openCategoryDialog}
        onDuplicateCategory={duplicateCategory}
        canDeleteCategory={(category) =>
          !menuBaseline?.categories.some(
            (savedCategory) => savedCategory.id === category.id,
          )
        }
        onReorderCategory={reorderCategory}
        onReorderProduct={reorderProduct}
        onToggleProduct={(category, product) =>
          toggleProductAvailability(category, product, true)
        }
        onAddProduct={openNewProduct}
        onEditProduct={openEditProduct}
        productMenuId={productMenuId}
        setProductMenuId={setProductMenuId}
        onDuplicateProduct={duplicateProduct}
        onDeleteProduct={requestDeleteProductFromMenu}
      />
    );
  } else if (view === "settings") {
    content = (
      <BusinessSettings
        businessId={activeBusiness.id}
        locationId={activeLocation.id}
        businessRole={activeBusiness.role}
        orderingOpen={orderingOpen}
        resetToken={settingsResetToken}
        onOrderingToggle={() => {
          if (orderingOpen) setPauseConfirm(true);
          else void resumeOrderingWithFeedback();
        }}
        onDirtyChange={setUnsavedSettings}
        onSaved={(section) => showToast(`${section} settings saved.`)}
      />
    );
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

  const categoryForDialog =
    categoryDialog && categoryDialog.type !== "add"
      ? categories.find((category) => category.id === categoryDialog.categoryId)
      : null;
  const canConfirmCancel = Boolean(
    cancelOrder &&
    cancelReason &&
    (cancelReason !== "Other" || cancelOther.trim()) &&
    (!cancelOrder.paid || refundAck),
  );

  return (
    <>
      <AppShell
        view={view}
        onNavigate={navigate}
        activeBranch={activeBranch}
        branches={branches}
        businessLogoUrl={activeBusiness?.logoUrl}
        onBranchChange={requestLocationChange}
        onSignOut={() => {
          void signOut();
          setView("orders");
        }}
        orderingOpen={orderingOpen}
        onKillSwitch={() => {
          if (orderingOpen) setPauseConfirm(true);
          else void resumeOrderingWithFeedback();
        }}
      >
        {content}
      </AppShell>

      {productDraft && (
        <ProductEditorOverlay
          draft={productDraft}
          categories={categories}
          dirty={productDirty}
          errors={productErrors}
          onChange={(draft) => {
            setProductDraft(draft);
            setProductDirty(true);
            setProductErrors({});
          }}
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
          footer={
            <>
              <button
                className="secondary-button"
                onClick={() => setPauseConfirm(false)}
              >
                Keep accepting
              </button>
              <button
                className="danger-button"
                onClick={() => {
                  void pauseOrderingWithFeedback();
                }}
              >
                Pause ordering
              </button>
            </>
          }
        >
          <p>
            Customers will not be able to place new orders until ordering is
            resumed.
          </p>
          <div className="modal-info-row">
            <Clock3 size={17} />
            <span>
              <strong>Current schedule</strong>
              {scheduleLabel ?? "Loading…"}
            </span>
          </div>
        </Modal>
      )}

      {(pendingNavigation || pendingLocationId) && (
        <Modal
          title={
            unsavedSettings
              ? "Your settings are mid-recipe"
              : "Your menu has a plot twist"
          }
          onClose={() => {
            setPendingNavigation(null);
            setPendingLocationId(null);
          }}
          footer={
            <>
              <button
                className="secondary-button"
                onClick={() => {
                  setPendingNavigation(null);
                  setPendingLocationId(null);
                }}
              >
                Keep editing
              </button>
              <button
                className="danger-button"
                onClick={discardChangesAndContinue}
              >
                Leave without saving
              </button>
            </>
          }
        >
          <p>
            {unsavedSettings
              ? "A few changes are still on the counter. Leaving now will put the saved settings back exactly as they were."
              : "You have menu changes waiting in the wings. Leaving now will send them back to the kitchen—unsaved."}
          </p>
          <div className="modal-info-row">
            <CircleAlert size={17} />
            <span>
              <strong>Nothing has gone live.</strong>
              {unsavedSettings
                ? "Your current outlet settings will stay exactly as they were."
                : "Your customer menu will stay exactly as it was."}
            </span>
          </div>
        </Modal>
      )}

      {cancelOrder && (
        <Modal
          title={`Cancel order #${cancelOrder.id}`}
          onClose={() => setCancelOrderId("")}
          destructive
          wide
          footer={
            <>
              <button
                className="secondary-button"
                onClick={() => setCancelOrderId("")}
              >
                Keep order
              </button>
              <button
                className="danger-button"
                disabled={!canConfirmCancel}
                onClick={() => {
                  void confirmCancel();
                }}
              >
                Confirm cancellation
              </button>
            </>
          }
        >
          <div className="cancel-summary">
            <span>
              <strong>{cancelOrder.customer}</strong>
              <small>{cancelOrder.phone}</small>
            </span>
            <span>
              <small>{cancelOrder.status}</small>
              <strong>
                {money(cancelOrder.total)} ·{" "}
                {cancelOrder.paid ? "Paid" : "Cash"}
              </strong>
            </span>
          </div>
          <fieldset className="reason-list">
            <legend>Reason *</legend>
            {[
              "Item unavailable",
              "Restaurant unable to fulfil",
              "Customer requested cancellation",
              "Duplicate order",
              "Other",
            ].map((reason) => (
              <label key={reason}>
                <input
                  type="radio"
                  name="cancel-reason"
                  checked={cancelReason === reason}
                  onChange={() => setCancelReason(reason)}
                />
                {reason}
              </label>
            ))}
          </fieldset>
          {cancelReason === "Other" && (
            <label className="field-label">
              Describe the reason *
              <textarea
                value={cancelOther}
                onChange={(event) => setCancelOther(event.target.value)}
                rows={2}
              />
            </label>
          )}
          {cancelOrder.paid && (
            <label className="refund-ack">
              <input
                type="checkbox"
                checked={refundAck}
                onChange={(event) => setRefundAck(event.target.checked)}
              />
              <span>
                <strong>
                  I will handle this {money(cancelOrder.total)} refund manually.
                </strong>
                <small>
                  This action records responsibility; it does not send a
                  provider refund.
                </small>
              </span>
            </label>
          )}
          <div className="call-nudge">
            <Phone size={18} />
            <span>
              <strong>
                Please call the customer to explain the cancellation.
              </strong>
              <small>{cancelOrder.phone}</small>
            </span>
            <a href={`tel:${cancelOrder.phone.replaceAll(" ", "")}`}>Call</a>
            <button
              onClick={() => navigator.clipboard?.writeText(cancelOrder.phone)}
            >
              Copy
            </button>
          </div>
        </Modal>
      )}

      {categoryDialog && (
        <Modal
          title={
            categoryDialog.type === "add"
              ? "Add category"
              : categoryDialog.type === "rename"
                ? "Rename category"
                : categoryDialog.type === "schedule"
                  ? "Availability times"
                  : "Delete category"
          }
          onClose={() => setCategoryDialog(null)}
          destructive={categoryDialog.type === "delete"}
          footer={
            <>
              <button
                className="secondary-button"
                onClick={() => setCategoryDialog(null)}
              >
                Cancel
              </button>
              <button
                className={
                  categoryDialog.type === "delete"
                    ? "danger-button"
                    : "primary-button"
                }
                disabled={
                  categoryDialog.type === "delete" &&
                  Boolean(categoryForDialog?.products.length)
                }
                onClick={saveCategoryDialog}
              >
                {categoryDialog.type === "delete" ? "Delete category" : "Save"}
              </button>
            </>
          }
        >
          {(categoryDialog.type === "add" ||
            categoryDialog.type === "rename") && (
            <label className="field-label">
              Category name *
              <input
                autoFocus
                value={categoryName}
                onChange={(event) => setCategoryName(event.target.value)}
                aria-invalid={Boolean(categoryError)}
              />
              {categoryError && (
                <small className="field-error">{categoryError}</small>
              )}
            </label>
          )}
          {categoryDialog.type === "schedule" && (
            <>
              <div className="schedule-options" role="radiogroup">
                <label>
                  <input
                    type="radio"
                    checked={categoryScheduleMode === "restaurant"}
                    onChange={() => setCategoryScheduleMode("restaurant")}
                  />
                  All times the restaurant is open
                </label>
                <label>
                  <input
                    type="radio"
                    checked={categoryScheduleMode === "same"}
                    onChange={() => setCategoryScheduleMode("same")}
                  />
                  Same time for all days
                </label>
                <label>
                  <input
                    type="radio"
                    checked={categoryScheduleMode === "different"}
                    onChange={() => setCategoryScheduleMode("different")}
                  />
                  Different times on different days
                </label>
              </div>
              {categoryScheduleMode !== "restaurant" && (
                <div className="schedule-detail-box">
                  {categoryScheduleMode === "different" && (
                    <div className="weekday-selector">
                      {DAYS.map((day) => (
                        <button
                          key={day}
                          className={
                            categoryScheduleDays.includes(day) ? "selected" : ""
                          }
                          onClick={() =>
                            setCategoryScheduleDays(
                              categoryScheduleDays.includes(day)
                                ? categoryScheduleDays.filter(
                                    (value) => value !== day,
                                  )
                                : [...categoryScheduleDays, day],
                            )
                          }
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="time-grid">
                    <label className="field-label">
                      Start
                      <input
                        type="time"
                        value={categoryScheduleStart}
                        onChange={(event) =>
                          setCategoryScheduleStart(event.target.value)
                        }
                      />
                    </label>
                    <label className="field-label">
                      End
                      <input
                        type="time"
                        value={categoryScheduleEnd}
                        onChange={(event) =>
                          setCategoryScheduleEnd(event.target.value)
                        }
                      />
                    </label>
                  </div>
                </div>
              )}
              {categoryError && <p className="field-error">{categoryError}</p>}
            </>
          )}
          {categoryDialog.type === "delete" && (
            <div className="delete-explanation">
              <CircleAlert size={20} />
              <span>
                <strong>{categoryForDialog?.name}</strong>
                {categoryForDialog?.products.length
                  ? ` contains ${categoryForDialog.products.length} products. Deletion is blocked until the backend move/archive rule is finalised.`
                  : " is empty and can be deleted. This is staged until you save the menu."}
              </span>
            </div>
          )}
        </Modal>
      )}

      {discardProductConfirm && (
        <Modal
          title="Discard product changes?"
          onClose={() => setDiscardProductConfirm(false)}
          footer={
            <>
              <button
                className="secondary-button"
                onClick={() => setDiscardProductConfirm(false)}
              >
                Continue editing
              </button>
              <button className="danger-button" onClick={closeProductEditor}>
                Discard changes
              </button>
            </>
          }
        >
          <p>
            Your unsaved edits to {productDraft?.name || "this product"} will be
            lost.
          </p>
        </Modal>
      )}

      {deleteProductConfirm && (
        <Modal
          title="Delete this product?"
          onClose={() => setDeleteProductConfirm(false)}
          destructive
          footer={
            <>
              <button
                className="secondary-button"
                onClick={() => setDeleteProductConfirm(false)}
              >
                Keep product
              </button>
              <button className="danger-button" onClick={deleteProduct}>
                Delete product
              </button>
            </>
          }
        >
          <p>
            {productDraft?.name} will be removed when the menu changes are
            saved.
          </p>
        </Modal>
      )}

      {productDeleteTarget && (
        <Modal
          title="Delete this product?"
          onClose={() => setProductDeleteTarget(null)}
          destructive
          footer={
            <>
              <button
                className="secondary-button"
                onClick={() => setProductDeleteTarget(null)}
              >
                Keep product
              </button>
              <button className="danger-button" onClick={deleteProductFromMenu}>
                Delete product
              </button>
            </>
          }
        >
          <p>
            {productDeleteTarget.name} will be removed when the menu changes are
            saved.
          </p>
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

function MenuDataState({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="page">
      <div className="empty-state compact-empty">
        <CircleAlert size={26} />
        <h3>{title}</h3>
        <p>{message}</p>
        {onRetry && (
          <button className="primary-button" onClick={onRetry}>
            Try again
          </button>
        )}
      </div>
    </div>
  );
}

function OutletContextState({
  title,
  message,
  onRetry,
  onSignOut,
}: {
  title: string;
  message: string;
  onRetry?: () => void;
  onSignOut?: () => void;
}) {
  return (
    <main className="login-page" aria-live="polite">
      <section className="login-card">
        <div className="login-heading">
          <h1>{title}</h1>
          <p>{message}</p>
        </div>
        {(onRetry || onSignOut) && (
          <div className="auth-form">
            {onRetry && (
              <button className="primary-button" onClick={onRetry}>
                Try again
              </button>
            )}
            {onSignOut && (
              <button className="secondary-button" onClick={onSignOut}>
                Sign out
              </button>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
