import { Check, ChevronRight, X } from "lucide-react";
import type { MenuCategory } from "../../domain/storefront";
import { categoryGlyphAt } from "./category-glyph";

interface CategoryNavigatorProps {
  activeCategoryId: string;
  categories: MenuCategory[];
  isOpen: boolean;
  onClose: () => void;
  onSelect: (categoryId: string) => void;
  productCounts: Record<string, number>;
}

export function CategoryNavigator({
  activeCategoryId,
  categories,
  isOpen,
  onClose,
  onSelect,
  productCounts,
}: CategoryNavigatorProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="sheet-layer" role="presentation" onMouseDown={onClose}>
      <button aria-label="Close categories" className="sheet-scrim" type="button" onClick={onClose} />
      <section
        className="bottom-sheet category-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="category-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="sheet-title-row">
          <div>
            <p className="eyebrow">Browse the menu</p>
            <h2 id="category-dialog-title">Categories</h2>
          </div>
          <button className="icon-button sheet-close" type="button" onClick={onClose} aria-label="Close categories">
            <X aria-hidden="true" size={20} />
          </button>
        </div>
        <div className="category-navigator-list">
          {categories.map((category, index) => {
            const isSelected = activeCategoryId === category.id;

            return (
              <button
                className={isSelected ? "is-active" : undefined}
                key={category.id}
                type="button"
                onClick={() => onSelect(category.id)}
              >
                <span className="category-nav-icon" aria-hidden="true">
                  {categoryGlyphAt(index)}
                </span>
                <span className="category-nav-copy">
                  <strong>{category.name}</strong>
                  <small>
                    {productCounts[category.id] ?? 0} {productCounts[category.id] === 1 ? "item" : "items"}
                  </small>
                </span>
                {isSelected ? <Check aria-hidden="true" size={19} /> : <ChevronRight aria-hidden="true" size={18} />}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
