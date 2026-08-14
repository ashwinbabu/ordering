import { Minus, Plus } from "lucide-react";
import { formatRupees, type MenuPresentation, type MenuProduct } from "../../domain/storefront";
import { MenuImage } from "./menu-image";

interface MenuProductCardProps {
  onAdd: (product: MenuProduct) => void;
  onQuantityChange: (productId: string, quantity: number) => void;
  presentation: MenuPresentation;
  product: MenuProduct;
  quantity: number;
}

const dietaryBadges = {
  Vegetarian: "veg",
  "Non-vegetarian": "non-veg",
  Nonvegetarian: "non-veg",
  Eggitarian: "egg",
  Eggiterian: "egg",
} as const;

export function MenuProductCard({ onAdd, onQuantityChange, presentation, product, quantity }: MenuProductCardProps) {
  const isAvailable = product.availability === "available";
  const isConfigurable = (product.optionGroups?.length ?? 0) > 0;
  const dietaryBadge = product.badges?.find((badge) => badge in dietaryBadges);
  const productTag = product.badges?.find((badge) => !(badge in dietaryBadges) && badge !== "Sold out");

  return (
    <article
      className={`product-card product-card--${presentation}${isAvailable ? "" : " product-card--unavailable"}`}
    >
      <div className={`product-card__surface${product.imageUrl ? "" : " product-card__surface--without-image"}`}>
        {product.imageUrl ? <MenuImage src={product.imageUrl} alt={product.name} className="product-card__image" /> : null}
        <div className="product-card__body">
          <div className="product-card__title-row">
            {dietaryBadge ? (
              <span
                className={`dietary-mark dietary-mark--${dietaryBadges[dietaryBadge as keyof typeof dietaryBadges]}`}
                aria-label={dietaryBadge}
              >
                <span aria-hidden="true" />
              </span>
            ) : null}
            <strong>{product.name}</strong>
          </div>
          {productTag ? <span className="eyebrow-tag">{productTag}</span> : null}
          <p className="product-card__description">{product.description}</p>
          <strong className="product-price">{formatRupees(product.price)}</strong>
        </div>
      </div>
      {isAvailable && isConfigurable ? (
        <button className="add-button" type="button" onClick={() => onAdd(product)}>
          <Plus aria-hidden="true" size={15} strokeWidth={2.5} />
          Configure
        </button>
      ) : isAvailable ? quantity > 0 ? (
        <div className="quantity-control" aria-label={`Quantity of ${product.name}`}>
          <button type="button" aria-label={`Remove one ${product.name}`} onClick={() => onQuantityChange(product.id, quantity - 1)}>
            <Minus aria-hidden="true" size={15} strokeWidth={2.5} />
          </button>
          <span>{quantity}</span>
          <button type="button" aria-label={`Add one ${product.name}`} onClick={() => onQuantityChange(product.id, quantity + 1)}>
            <Plus aria-hidden="true" size={15} strokeWidth={2.5} />
          </button>
        </div>
      ) : (
        <button className="add-button" type="button" onClick={() => onAdd(product)}>
          <Plus aria-hidden="true" size={15} strokeWidth={2.5} />
          Add
        </button>
      ) : (
        <span className="unavailable-pill" aria-label={`${product.name} is sold out`}>
          Sold out
        </span>
      )}
    </article>
  );
}
