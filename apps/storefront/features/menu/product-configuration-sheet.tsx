import { Check, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatRupees, type CartLineOptionSelection, type MenuProduct, type StorefrontMenuOptionGroup } from "../../domain/storefront";

interface ProductConfigurationSheetProps {
  initialSelections?: CartLineOptionSelection[];
  isAcceptingOrders: boolean;
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

function requirementText(group: StorefrontMenuOptionGroup) {
  if (group.minSelections <= 0) return `Optional · choose up to ${group.maxSelections}`;
  if (group.minSelections === group.maxSelections) return group.minSelections === 1 ? "Select one" : `Select ${group.minSelections}`;
  return `Select ${group.minSelections}–${group.maxSelections}`;
}

export function ProductConfigurationSheet({ initialSelections = [], isAcceptingOrders, onClose, onConfirm, product }: ProductConfigurationSheetProps) {
  const optionGroups = product.optionGroups ?? [];
  const [selectedOptionIds, setSelectedOptionIds] = useState<SelectionByGroup>(() => selectionsFor(optionGroups, initialSelections));
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

  return (
    <div className="sheet-layer" role="presentation">
      <button aria-label={`Close ${product.name} configuration`} className="sheet-scrim" type="button" onClick={onClose} />
      <section aria-labelledby="product-configuration-title" aria-modal="true" className="bottom-sheet configuration-sheet" role="dialog">
        <div className="sheet-title-row configuration-title">
          <div>
            <p className="eyebrow">Customise</p>
            <h2 id="product-configuration-title">{product.name}</h2>
            <p>Choose exactly how you would like it.</p>
          </div>
          <button aria-label="Close configuration" className="icon-button sheet-close" type="button" onClick={onClose}><X aria-hidden="true" size={20} /></button>
        </div>
        <div className="configuration-scroll">
          {optionGroups.map((group) => {
            const selection = selectedOptionIds[group.id] ?? [];

            return <fieldset className="option-group" key={group.id}>
              <legend>
                <span><strong>{group.name}</strong><small>{requirementText(group)}</small></span>
                {group.minSelections > 0 ? <em>Required</em> : null}
              </legend>
              <div className="option-choices">
                {group.options.map((option) => {
                  const checked = selection.includes(option.id);
                  const atMaximum = !checked && group.selectionType === "multiple" && selection.length >= group.maxSelections;
                  return <button
                    aria-pressed={checked}
                    className={checked ? "is-selected" : undefined}
                    disabled={atMaximum}
                    key={option.id}
                    type="button"
                    onClick={() => toggleOption(group, option.id)}
                  >
                    <span className={`choice-control choice-control--${group.selectionType}`} aria-hidden="true">{checked ? <Check size={13} strokeWidth={2.4} /> : null}</span>
                    <span className="choice-name"><strong>{option.name}</strong></span>
                    <span className="choice-price">{option.priceDelta === 0 ? "Included" : `+ ${formatRupees(option.priceDelta)}`}</span>
                  </button>;
                })}
              </div>
            </fieldset>;
          })}
        </div>
        <div className="sheet-cta configuration-cta">
          {!isValid ? <p>Select the required options to continue</p> : null}
          <button className="primary-button" disabled={!isValid || !isAcceptingOrders} type="button" onClick={() => {
            if (isAcceptingOrders) onConfirm(selectedOptions);
          }}>
            <span>Add to Cart</span>
            <strong>{formatRupees(configuredPrice)}</strong>
          </button>
        </div>
      </section>
    </div>
  );
}
