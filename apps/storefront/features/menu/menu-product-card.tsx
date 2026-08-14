import { Plus } from "lucide-react";
import { formatRupees, type MenuPresentation, type MenuProduct } from "../../domain/storefront";
import { MenuImage } from "./menu-image";

interface MenuProductCardProps {
  presentation: MenuPresentation;
  product: MenuProduct;
}

const dietaryBadges = {
  Vegetarian: "veg",
  "Non-vegetarian": "non-veg",
  Nonvegetarian: "non-veg",
  Eggitarian: "egg",
  Eggiterian: "egg",
} as const;

export function MenuProductCard({ presentation, product }: MenuProductCardProps) {
  const isAvailable = product.availability === "available";
  const dietaryBadge = product.badges?.find((badge) => badge in dietaryBadges);
  const productTag = product.badges?.find((badge) => !(badge in dietaryBadges) && badge !== "Sold out");

  return (
    <article className={`product-card product-card--${presentation}`}>
      <div className="product-card__surface">
        <MenuImage src={product.imageUrl} alt={product.name} className="product-card__image" />
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
      {isAvailable ? (
        <span className="add-button" aria-label={`Add ${product.name} in the next ordering phase`}>
          <Plus aria-hidden="true" size={15} strokeWidth={2.5} />
          Add
        </span>
      ) : (
        <span className="unavailable-pill" aria-label={`${product.name} is sold out`}>
          Sold out
        </span>
      )}
    </article>
  );
}
