import { ChevronDown, Clock3, Grid2X2, List, Menu as MenuIcon, Sparkle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  productById,
  productsForCategory,
  type Menu,
  type MenuPresentation,
} from "../../domain/storefront";
import { CategoryNavigator } from "./category-navigator";
import { MenuImage } from "./menu-image";
import { MenuProductCard } from "./menu-product-card";

interface MenuScreenProps {
  menu: Menu;
  orderingStatus: string;
}

const categorySymbols: Record<string, string> = {
  "south-indian": "◒",
  "goan-mains": "✦",
  "quick-bites": "◇",
  beverages: "◡",
  desserts: "○",
};

export function MenuScreen({ menu, orderingStatus }: MenuScreenProps) {
  const initialCategoryId = menu.categories[0]?.id ?? "";
  const [activeCategoryId, setActiveCategoryId] = useState(initialCategoryId);
  const [isNavigatorOpen, setIsNavigatorOpen] = useState(false);
  const [presentation, setPresentation] = useState<MenuPresentation>(menu.defaultPresentation);
  const [showFloatingNavigator, setShowFloatingNavigator] = useState(false);
  const categoryRowRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef(new Map<string, HTMLElement>());

  const productCounts = useMemo(
    () =>
      Object.fromEntries(
        menu.categories.map((category) => [category.id, productsForCategory(menu, category.id).length]),
      ),
    [menu],
  );

  const featuredProducts = useMemo(
    () =>
      menu.featuredProducts
        .map((featuredProduct) => ({
          ...featuredProduct,
          product: productById(menu, featuredProduct.productId),
        }))
        .filter((featuredProduct) => featuredProduct.product !== undefined),
    [menu],
  );

  useEffect(() => {
    const categoryRow = categoryRowRef.current;
    if (!categoryRow) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setShowFloatingNavigator(!entry.isIntersecting),
      { rootMargin: "-76px 0px 0px 0px", threshold: 0 },
    );

    observer.observe(categoryRow);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    function updateActiveCategory() {
      const categoryAtReadingPosition = menu.categories.reduce((currentCategory, category) => {
        const section = sectionRefs.current.get(category.id);

        if (section && section.getBoundingClientRect().top <= window.innerHeight * 0.36) {
          return category;
        }

        return currentCategory;
      }, menu.categories[0]);

      if (categoryAtReadingPosition) {
        setActiveCategoryId((currentCategoryId) =>
          currentCategoryId === categoryAtReadingPosition.id
            ? currentCategoryId
            : categoryAtReadingPosition.id,
        );
      }
    }

    updateActiveCategory();
    window.addEventListener("scroll", updateActiveCategory, { passive: true });
    window.addEventListener("resize", updateActiveCategory);

    return () => {
      window.removeEventListener("scroll", updateActiveCategory);
      window.removeEventListener("resize", updateActiveCategory);
    };
  }, [menu.categories]);

  function selectCategory(categoryId: string) {
    setActiveCategoryId(categoryId);
    setIsNavigatorOpen(false);
    sectionRefs.current.get(categoryId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <section className="menu-page" aria-labelledby="menu-title">
      <div className="menu-shell">
        <section className="menu-intro content-width">
          <p className="service-status"><span aria-hidden="true" />{orderingStatus}</p>
          <h1 id="menu-title">What are you craving?</h1>
          <p className="menu-intro__message">Made fresh in Mandrem. Choose delivery or pickup in your cart.</p>
          <p className="menu-intro__delivery-note">
            <Clock3 aria-hidden="true" size={14} strokeWidth={1.9} />
            Typical delivery · 25–35 min
          </p>
        </section>

        <section className="category-discovery content-width" aria-label="Menu categories" ref={categoryRowRef}>
          <div className="category-boxes">
            {menu.categories.map((category) => (
              <button
                className="category-box"
                data-active={activeCategoryId === category.id}
                key={category.id}
                type="button"
                onClick={() => selectCategory(category.id)}
              >
                <span className="category-box__icon" aria-hidden="true">
                  {categorySymbols[category.id] ?? "•"}
                </span>
                <span>{category.name}</span>
                <small>{productCounts[category.id] ?? 0} dishes</small>
              </button>
            ))}
          </div>
        </section>

        {featuredProducts.length ? (
          <section className="featured-section content-width" aria-labelledby="featured-title">
            <div className="section-heading">
              <div>
                <p className="section-kicker">From our kitchen</p>
                <h2 id="featured-title">A2 favourites</h2>
              </div>
              <span className="rail-hint">Swipe to explore</span>
            </div>
            <div className="featured-rail">
              {featuredProducts.map(({ editorialLabel, product }) => {
                if (!product) {
                  return null;
                }

                return (
                  <article className="featured-card" key={product.id}>
                    <MenuImage src={product.imageUrl} alt={product.name} className="featured-card__image" />
                    <div className="featured-card__gradient" />
                    <div className="featured-card__content">
                      <p>
                        {editorialLabel === "A Mandrem favourite" ? <Sparkle aria-hidden="true" size={12} /> : null}
                        {editorialLabel}
                      </p>
                      <h3>{product.name}</h3>
                      <span>From ₹{product.price}</span>
                    </div>
                    <span className="featured-card__add" aria-hidden="true">Add</span>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className="full-menu content-width" aria-labelledby="full-menu-title">
          <div className="full-menu__heading">
            <div>
              <p className="section-kicker">Made with Love in Mandrem</p>
              <h2 id="full-menu-title">Full menu</h2>
            </div>
            {menu.allowPresentationChange ? (
              <div className="view-switch" aria-label="Menu view">
                <button
                  type="button"
                  aria-label="List view"
                  aria-pressed={presentation === "list"}
                  onClick={() => setPresentation("list")}
                >
                  <List aria-hidden="true" size={18} />
                </button>
                <button
                  type="button"
                  aria-label="Grid view"
                  aria-pressed={presentation === "grid"}
                  onClick={() => setPresentation("grid")}
                >
                  <Grid2X2 aria-hidden="true" size={17} />
                </button>
              </div>
            ) : null}
          </div>
        {menu.categories.map((category) => {
          const products = productsForCategory(menu, category.id);
          const availableProducts = products.filter((product) => product.availability === "available");

          return (
            <section
              aria-labelledby={`menu-category-title-${category.id}`}
              className="menu-category"
              id={`menu-category-${category.id}`}
              key={category.id}
              ref={(element) => {
                if (element) {
                  sectionRefs.current.set(category.id, element);
                } else {
                  sectionRefs.current.delete(category.id);
                }
              }}
            >
              <div className="menu-category__heading">
                <h3 id={`menu-category-title-${category.id}`}>{category.name}</h3>
                <span>{availableProducts.length} available</span>
              </div>
              <div className={presentation === "list" ? "product-collection--list" : "product-collection--grid"}>
                {products.map((product) => (
                  <MenuProductCard key={product.id} product={product} presentation={presentation} />
                ))}
              </div>
            </section>
          );
        })}
        </section>
      </div>

      {showFloatingNavigator ? (
        <button className="floating-category-button" type="button" onClick={() => setIsNavigatorOpen(true)}>
          <MenuIcon aria-hidden="true" size={18} />
          <span>{menu.categories.find((category) => category.id === activeCategoryId)?.name ?? "Menu"}</span>
          <ChevronDown aria-hidden="true" size={16} />
        </button>
      ) : null}

      <CategoryNavigator
        activeCategoryId={activeCategoryId}
        categories={menu.categories}
        isOpen={isNavigatorOpen}
        onClose={() => setIsNavigatorOpen(false)}
        onSelect={selectCategory}
        productCounts={productCounts}
      />
    </section>
  );
}
