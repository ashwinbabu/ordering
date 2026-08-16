import { Clock, Store, X } from "lucide-react";
import { useEffect } from "react";
import { formatRupees, type MenuProduct } from "../../domain/storefront";
import { dietaryInfoFor, productTagFor } from "./dietary-badge";
import { MenuImage } from "./menu-image";

interface ProductDetailSheetProps {
  locationName: string;
  onAdd: (product: MenuProduct) => void;
  onClose: () => void;
  product: MenuProduct;
}

export function ProductDetailSheet({ locationName, onAdd, onClose, product }: ProductDetailSheetProps) {
  const isAvailable = product.availability === "available";
  const isConfigurable = (product.optionGroups?.length ?? 0) > 0;
  const dietaryInfo = dietaryInfoFor(product.badges);
  const productTag = productTagFor(product.badges);
  const shortLocationName = locationName.split(",")[0];

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function addAndClose() {
    onAdd(product);
    onClose();
  }

  return (
    <div className="sheet-layer" role="presentation">
      <button aria-label={`Close ${product.name} details`} className="sheet-scrim" type="button" onClick={onClose} />
      <section aria-labelledby="product-detail-title" aria-modal="true" className="bottom-sheet product-detail-sheet" role="dialog">
        {product.imageUrl ? (
          <div className="detail-image-wrap">
            <MenuImage alt={product.name} className="detail-image" src={product.imageUrl} />
            <button aria-label="Close details" className="icon-button sheet-close" type="button" onClick={onClose}>
              <X aria-hidden="true" size={20} />
            </button>
          </div>
        ) : (
          <button aria-label="Close details" className="icon-button sheet-close sheet-close--floating" type="button" onClick={onClose}>
            <X aria-hidden="true" size={20} />
          </button>
        )}
        <div className="detail-content">
          <div className="detail-title-row">
            <div className="detail-name-line">
              {dietaryInfo ? (
                <span className={`dietary-mark dietary-mark--${dietaryInfo.modifier}`} aria-label={dietaryInfo.label}>
                  <span aria-hidden="true" />
                </span>
              ) : null}
              <h2 id="product-detail-title">{product.name}</h2>
            </div>
            <span className="product-price">{isConfigurable ? "From " : ""}{formatRupees(product.price)}</span>
          </div>
          {productTag ? <span className="eyebrow-tag detail-badge">{productTag}</span> : null}
          <p className="detail-description">{product.description}</p>
          <div className="detail-facts">
            <span><Clock aria-hidden="true" size={17} strokeWidth={1.8} /> Made to order</span>
            <span><Store aria-hidden="true" size={17} strokeWidth={1.8} /> From {shortLocationName}</span>
          </div>
        </div>
        <div className="sheet-cta">
          <button className="primary-button" disabled={!isAvailable} type="button" onClick={addAndClose}>
            {isAvailable ? `${isConfigurable ? "Choose options" : "Add to Cart"} · ${formatRupees(product.price)}` : "Currently unavailable"}
          </button>
        </div>
      </section>
    </div>
  );
}
