import { Minus, Plus } from "lucide-react";
import { formatRupees, type MenuPresentation, type MenuProduct } from "../../domain/storefront";
import { dietaryInfoFor, productTagFor } from "./dietary-badge";
import { MenuImage } from "./menu-image";

interface MenuProductCardProps {
  isAcceptingOrders: boolean;
  onAdd: (product: MenuProduct) => void;
  onQuantityChange: (productId: string, quantity: number) => void;
  onView: (product: MenuProduct) => void;
  presentation: MenuPresentation;
  product: MenuProduct;
  quantity: number;
}

export function MenuProductCard({ isAcceptingOrders, onAdd, onQuantityChange, onView, presentation, product, quantity }: MenuProductCardProps) {
  const isAvailable = product.availability === "available";
  const isConfigurable = (product.optionGroups?.length ?? 0) > 0;
  const dietaryInfo = dietaryInfoFor(product.badges);
  const productTag = productTagFor(product.badges);

  return (
    <article
      className={`product-card product-card--${presentation}${isAvailable ? "" : " product-card--unavailable"}`}
    >
      <button
        aria-label={`View ${product.name}`}
        className={`product-card__surface${product.imageUrl ? "" : " product-card__surface--without-image"}`}
        type="button"
        onClick={() => onView(product)}
      >
        {product.imageUrl ? <MenuImage src={product.imageUrl} alt={product.name} className="product-card__image" /> : null}
        <span className="product-card__body">
          <span className="product-card__title-row">
            {dietaryInfo ? (
              <span
                className={`dietary-mark dietary-mark--${dietaryInfo.modifier}`}
                aria-label={dietaryInfo.label}
              >
                <span aria-hidden="true" />
              </span>
            ) : null}
            <strong>{product.name}</strong>
          </span>
          {productTag ? <span className="eyebrow-tag">{productTag}</span> : null}
          <span className="product-card__description">{product.description}</span>
          <strong className="product-price">{formatRupees(product.price)}</strong>
        </span>
      </button>
      {isAvailable && isConfigurable ? (
        <button className="add-button" type="button" disabled={!isAcceptingOrders} onClick={() => onAdd(product)}>
          <Plus aria-hidden="true" size={15} strokeWidth={2.5} />
          Configure
        </button>
      ) : isAvailable ? quantity > 0 ? (
        <div className="quantity-control" aria-label={`Quantity of ${product.name}`}>
          {/* Removing stays available while ordering is paused so a customer
              can still undo an accidental tap; only adding is blocked. */}
          <button type="button" aria-label={`Remove one ${product.name}`} onClick={() => onQuantityChange(product.id, quantity - 1)}>
            <Minus aria-hidden="true" size={15} strokeWidth={2.5} />
          </button>
          <span>{quantity}</span>
          <button type="button" aria-label={`Add one ${product.name}`} disabled={!isAcceptingOrders} onClick={() => onQuantityChange(product.id, quantity + 1)}>
            <Plus aria-hidden="true" size={15} strokeWidth={2.5} />
          </button>
        </div>
      ) : (
        <button className="add-button" type="button" disabled={!isAcceptingOrders} onClick={() => onAdd(product)}>
          <Plus aria-hidden="true" size={15} strokeWidth={2.5} />
          Add
        </button>
      ) : (
        <span className="unavailable-pill">Unavailable</span>
      )}
    </article>
  );
}
