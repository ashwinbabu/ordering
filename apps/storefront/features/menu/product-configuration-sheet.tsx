import { Check, Plus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatRupees, type CartLineOptionSelection, type MenuProduct, type StorefrontMenuOptionGroup } from "../../domain/storefront";
import { MenuImage } from "./menu-image";

interface ProductConfigurationSheetProps {
  initialSelections?: CartLineOptionSelection[];
  onClose: () => void;
  onConfirm: (selections: CartLineOptionSelection[]) => void;
  product: MenuProduct;
}

type SelectionByGroup = Record<string, string[]>;

function selectionsFor(groups: StorefrontMenuOptionGroup[], selections: CartLineOptionSelection[]): SelectionByGroup {
  return Object.fromEntries(groups.map((group) => [
    group.id,
    selections.filter((selection) => selection.groupId === group.id).map((selection) => selection.optionId),
  ]));
}

function isGroupValid(group: StorefrontMenuOptionGroup, selection: string[] | undefined) {
  const count = selection?.length ?? 0;
  return count >= group.minSelections && count <= group.maxSelections;
}

export function ProductConfigurationSheet({ initialSelections = [], onClose, onConfirm, product }: ProductConfigurationSheetProps) {
  const optionGroups = product.optionGroups ?? [];
  const [selectedOptionIds, setSelectedOptionIds] = useState<SelectionByGroup>(() => selectionsFor(optionGroups, initialSelections));
  const [showValidation, setShowValidation] = useState(false);
  const isValid = optionGroups.every((group) => isGroupValid(group, selectedOptionIds[group.id]));
  const selectedOptions = useMemo(
    () => optionGroups.flatMap((group) => group.options
      .filter((option) => selectedOptionIds[group.id]?.includes(option.id))
      .map((option): CartLineOptionSelection => ({
        groupId: group.id,
        optionId: option.id,
        groupName: group.name,
        optionName: option.name,
        priceDelta: option.priceDelta,
      }))),
    [optionGroups, selectedOptionIds],
  );
  const configuredPrice = product.price + selectedOptions.reduce((total, option) => total + option.priceDelta, 0);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function toggleOption(group: StorefrontMenuOptionGroup, optionId: string) {
    setShowValidation(false);
    setSelectedOptionIds((current) => {
      const currentIds = current[group.id] ?? [];
      if (group.selectionType === "single") {
        return { ...current, [group.id]: currentIds.includes(optionId) ? [] : [optionId] };
      }

      return currentIds.includes(optionId)
        ? { ...current, [group.id]: currentIds.filter((id) => id !== optionId) }
        : currentIds.length < group.maxSelections
          ? { ...current, [group.id]: [...currentIds, optionId] }
          : current;
    });
  }

  function confirm() {
    if (!isValid) {
      setShowValidation(true);
      return;
    }
    onConfirm(selectedOptions);
  }

  return (
    <div className="sheet-layer" role="presentation">
      <button aria-label={`Close ${product.name} configuration`} className="sheet-scrim" type="button" onClick={onClose} />
      <section aria-labelledby="product-configuration-title" aria-modal="true" className="bottom-sheet product-configuration-sheet" role="dialog">
        <div className="sheet-title-row">
          <div><p className="eyebrow">Customize your order</p><h2 id="product-configuration-title">{product.name}</h2></div>
          <button aria-label="Close configuration" className="icon-button sheet-close" type="button" onClick={onClose}><X aria-hidden="true" size={20} /></button>
        </div>
        <div className="product-configuration-sheet__content">
          <div className="product-configuration-sheet__intro">
            <MenuImage alt={product.name} className="product-configuration-sheet__image" src={product.imageUrl} />
            <div><p>{product.description}</p><strong>{formatRupees(product.price)}</strong></div>
          </div>
          {optionGroups.map((group) => {
            const selection = selectedOptionIds[group.id] ?? [];
            const invalid = showValidation && !isGroupValid(group, selection);
            const requirement = group.minSelections > 0
              ? `Required · choose ${group.minSelections === group.maxSelections ? group.minSelections : `${group.minSelections}–${group.maxSelections}`}`
              : `Optional · choose up to ${group.maxSelections}`;

            return <fieldset className="configuration-group" key={group.id} aria-describedby={invalid ? `configuration-error-${group.id}` : undefined}>
              <legend><span>{group.name}</span><small>{requirement}</small></legend>
              <div className="configuration-options">
                {group.options.map((option) => {
                  const checked = selection.includes(option.id);
                  const atMaximum = !checked && group.selectionType === "multiple" && selection.length >= group.maxSelections;
                  return <label className="configuration-option" data-selected={checked} key={option.id}>
                    <input checked={checked} disabled={atMaximum} name={group.id} type={group.selectionType === "single" ? "radio" : "checkbox"} onChange={() => toggleOption(group, option.id)} />
                    <span className="configuration-option__indicator" aria-hidden="true">{checked ? <Check size={14} strokeWidth={3} /> : group.selectionType === "multiple" ? <Plus size={14} /> : null}</span>
                    <span>{option.name}</span>
                    <strong>{option.priceDelta === 0 ? "Included" : `+ ${formatRupees(option.priceDelta)}`}</strong>
                  </label>;
                })}
              </div>
              {invalid ? <p className="configuration-group__error" id={`configuration-error-${group.id}`} role="alert">Select {group.minSelections === group.maxSelections ? group.minSelections : `at least ${group.minSelections}`} option{group.minSelections === 1 ? "" : "s"}.</p> : null}
            </fieldset>;
          })}
        </div>
        <div className="product-configuration-sheet__footer">
          <span><small>Total</small><strong>{formatRupees(configuredPrice)}</strong></span>
          <button className="primary-button" type="button" onClick={confirm}>Add to Cart</button>
        </div>
      </section>
    </div>
  );
}
