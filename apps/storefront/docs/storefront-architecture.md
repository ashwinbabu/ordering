# A2 Ordering Customer Storefront — Rebuild Brief

Status: canonical product and UX reference for the local reverse-engineering rebuild.

This document consolidates the original customer-ordering design brief and the later approved UI refinements. It is intentionally about product behaviour, visual intent, and acceptance criteria. It is not a component plan and must not force a final feature-folder taxonomy before the repository audit is complete.

## 1. Product definition

A2 Ordering Customer is a mobile-first, restaurant-specific direct-ordering web app/PWA opened from an outlet QR code or direct link.

It is a white-labelled SaaS product:

- each restaurant/business has its own branding, menu, imagery, copy, pricing and outlet information;
- each customer session is scoped to one business and one selected outlet/location;
- the same application must support many businesses and locations later;
- the customer experience is not a marketplace, discovery platform or restaurant directory;
- the current demo uses A2 Food & Beverages in Mandrem as seed content only.

Current public reference site:

`https://a2-ordering-customer.ashwinbabu007.chatgpt.site`

The live site is a behavioural and visual reference. The local implementation must be maintainable source code, not a copied production bundle or a static mockup.

## 2. Source-of-truth hierarchy

When references disagree, use this order:

1. This document and its approved decisions.
2. Screenshots, videos and written flow notes in `reference/storefront/`.
3. The current public Customer Site, inspected through the browser where possible.
4. The original design brief or older planning material.
5. Reasonable implementation inference.

Do not silently resolve a material conflict. Record it in the analysis report and ask for a decision when it affects visible behaviour, data shape, routing or architecture.

The reference media directory may contain different files over time. Enumerate the files that actually exist; do not assume that a missing screenshot or video exists.

## 3. Rebuild boundaries

This task is frontend reverse engineering and restructuring only.

Required:

- reproduce the current approved visual language and interaction behaviour;
- preserve the customer journey end to end using demo/seed data and local state where the reference uses it;
- create clean seams for later data integration;
- make the result responsive, accessible and runnable locally;
- keep tenant/location configuration separate from A2-specific presentation where practical.

Explicitly excluded from this rebuild:

- Supabase setup or connection;
- authentication implementation;
- Supabase client, generated database types, queries, mutations, RPCs, migrations or RLS;
- backend API or Edge Function work;
- real payment gateway credentials or payment processing;
- live order creation, refunds, delivery integrations or Realtime;
- marketplace/discovery features;
- loyalty, rewards or memberships;
- dark mode;
- rider or restaurant-admin functionality;
- inventory management or stock deduction.

Supabase is a future integration boundary only. Do not add backend work simply because the final product will use Supabase later.

## 4. Visual direction

The experience should feel warm, food-led, calm, premium and spacious.

Use:

- warm white and soft neutral surfaces;
- restrained outlet/brand colour;
- crisp sans-serif typography with clear hierarchy;
- generous spacing and readable line lengths;
- soft radii;
- subtle dividers and light elevation;
- minimal line icons;
- circular standard menu imagery in list view;
- rectangular/landscape featured and product-detail imagery;
- restrained motion and polished bottom-sheet transitions;
- touch-friendly controls without depending on hover.

Avoid:

- marketplace styling;
- dense utility-dashboard layouts;
- heavy shadows or excessive decoration;
- unnecessary labels and instructional clutter;
- invented Skrowia/platform branding in the customer UI;
- generic broken-image placeholders.

Images must have a deliberate fallback when unavailable. Food imagery should remain appetising and correctly matched to the product.

## 5. Tenant and outlet behaviour

The storefront must be designed as a tenant-aware surface even though the current rebuild uses seed data.

The runtime should be able to resolve a business and location from the route, host or equivalent configuration boundary. The exact production routing scheme may remain a documented seam until backend integration.

The UI must not assume that every tenant is A2. Branding, logo, accent colour, menu content, product imagery, category sequence, featured products, ordering mode and outlet copy are configuration/data concerns.

The active outlet should be visible through normal menu context. Do not add a second branch selector to the customer experience.

## 6. Menu experience

The initial destination is the outlet's live menu, not a landing page or generic discovery screen.

The menu may contain:

1. outlet/menu header;
2. compact category boxes near the top;
3. optional featured-product rail;
4. category-by-category product sections;
5. sticky cart access after the first successful add.

### Category boxes

- Category boxes are compact, inviting and touch-friendly.
- They act as both discovery and navigation controls.
- They may scroll horizontally when needed.
- The active state must be clear and brand-consistent.
- Do not show the labels `Browse` or `Pick a Category`.

### Featured products

- Featured products are optional and appear outside the normal category flow.
- They use larger landscape/rectangular editorial imagery.
- A featured product remains in its normal category as well.
- Featured products respect live availability in the future data model.
- Featured cards must have a visible, usable Add control; an empty button shape is not acceptable.

### Regular products

The vendor configures the default menu presentation as list or grid. The customer may switch between modes only if the product configuration permits it.

List view:

- compact horizontal product rows;
- standard product image always remains a true circle;
- the image may be top-aligned or centre-aligned, but must never stretch into an ellipse;
- product name, price, relevant description and badges remain legible;
- Add/counter controls remain easy to reach.

Grid view:

- visual two-column product cards where appropriate;
- product photos are rectangular rather than circular;
- card heights may adapt to content without distorting the image;
- featured products retain their own landscape treatment.

The list/grid switch must not change product data, category order, pricing, availability, cart contents or navigation position.

## 7. Scroll-aware category navigation

Once the original category area has scrolled out of view, show a compact floating categories/menu button.

Opening it presents a fixed-height, internally scrollable navigator:

- every category is listed;
- every category shows its relevant product count;
- the current category is visibly selected;
- selecting a category scrolls the main menu to that section and closes the navigator;
- natural scrolling updates the current-category state;
- opening and closing the navigator does not reset menu position.

The floating category control must coexist cleanly with the sticky cart CTA.

## 8. Product interactions

There are two separate add paths:

| Action                                          | Result                                 |
| ----------------------------------------------- | -------------------------------------- |
| Tap the product surface outside the add control | Open product-detail bottom sheet       |
| Tap Add on a simple product                     | Add the base configuration immediately |
| Tap Add on a configurable product               | Open configuration sheet before adding |

### Product-detail sheet

The product-detail sheet may contain:

- landscape product image;
- product name and description;
- price or starting price;
- relevant badges/tags;
- add/configure action.

It preserves the customer's menu position when closed.

### Configuration sheet

- Long variant/option content scrolls inside the sheet.
- Required and optional groups are visibly distinguished.
- Single-select and multi-select patterns are supported.
- Price increments are shown where relevant, such as `+ ₹30`.
- Invalid configurations cannot be added.
- The bottom CTA remains fixed within the sheet and reads `Add to Cart`.
- The CTA text and price are correctly aligned.
- The CTA reflects the actual configured price when displayed.

## 9. Cart behaviour

Before the first successful add, there is no sticky cart bar.

After the first add:

- show a persistent `Go to Cart` CTA;
- show enough item/count/total context to make the cart state understandable;
- keep enough bottom padding so it never hides menu content;
- allow continued browsing and adding.

Product add controls use a traditional remove-capable counter:

- minus;
- current quantity;
- plus.

After adding, the control must not become an irreversible Add-only state. The customer must be able to reduce the quantity or remove the item because of an accidental tap.

From the cart, `Add more` returns directly to the menu at the category/navigation area near the top, not to the hero/header start.

## 10. Cart and checkout

The cart is a vertically scrollable, decision-complete review surface with a fixed bottom primary CTA.

It contains:

1. cart header with back-to-menu control, title and item count;
2. editable order items;
3. selected variants/options;
4. quantity controls and removal;
5. special instructions;
6. compact discount-code state;
7. delivery/pickup selector;
8. address selection or inline add-address flow when Delivery is selected;
9. transparent pricing summary;
10. fixed `Choose payment` or dynamic `Pay ₹[total]` CTA.

The cart header's translucent background extends full width. The header content retains the established centred/max-width alignment; only the background is full bleed.

Keep `Payment summary` and `Your order` at the stronger section-heading size. Use smaller, quieter headings for discount code, special instructions and fulfilment.

### Delivery

- Selecting Delivery reveals the address block.
- Do not show a final delivery fee or ETA before an address is available and serviceability is resolved.
- Show loading while eligibility, fee and ETA are calculated.
- Show an honest out-of-range state while preserving the cart.
- Payment remains disabled until the address is valid and eligible.

### Pickup

- Selecting Pickup sets delivery fee to `₹0`.
- Remove address requirements.
- Show outlet/pickup context and timing when available.
- Enable payment once the remaining cart validation passes.

### Address flow

The address flow is inline/focused, not an unrelated full checkout journey.

- Use a custom accessible area picker, not the browser/system select control.
- Area options should have clear hover/focus/selected states.
- Hover states may be used throughout cart and checkout controls, but touch operation must never depend on hover.
- When submission is attempted with missing fields, highlight each missing field in red.
- On mobile, move focus/scroll to the first missing field so the error is immediately visible.
- The address card/sheet should finish cleanly at the bottom CTA; the CTA is anchored to the bottom rather than floating awkwardly above the card end.
- After saving, return to the cart and recalculate delivery details automatically.

### Discount code

The normal collapsed state is compact and restrained. Expanding it must not create an oversized title or disproportionate block.

Support visible states for:

- idle;
- expanded entry;
- applying;
- applied;
- invalid/ineligible;
- removed.

## 11. Payment and order states

Payment is a gateway hand-off boundary. Do not invent an internal A2 payment-method UI or claim that payment processing is real without configured credentials and integration.

The frontend demo may represent the boundary with a clearly labelled stub/test transition.

After a successful simulated or future gateway result:

1. show `Securing your order`;
2. use one circular loader only;
3. remove the horizontal loader;
4. show `Order received`;
5. show a 90-second cancellation countdown;
6. proceed to live order tracking.

Tracking states:

- Accepted;
- Preparing;
- Out for delivery;
- pickup-appropriate completion state.

The current demo may simulate transitions. Do not imply that live order status or cancellation/refunds are connected to a backend.

## 12. Required states and resilience

The rebuild must include reviewable UI states for:

- empty cart;
- menu loading;
- menu error;
- unavailable product/category;
- configuration validation;
- coupon applying/applied/error;
- delivery address required;
- custom picker open/selected/error;
- delivery calculation loading;
- delivery available;
- delivery out of range;
- pickup selected;
- payment cancelled/failed boundary;
- securing order;
- order received/cancel countdown;
- order tracking.

Preserve cart state while navigating. Closing sheets and returning from address flows must not reset the customer's browsing position or lose cart contents.

## 13. Accessibility and responsive baseline

- Mobile is the primary context because QR traffic is expected to dominate.
- Desktop and tablet layouts must remain natural, not merely stretched mobile screens.
- Touch targets must be comfortable.
- Keyboard users must be able to operate sheets, category navigation, toggles, counters, picker options and CTAs.
- Focus must be managed when sheets and dialogs open/close.
- Selected, unavailable, error and price states must not depend on colour alone.
- Sticky/fixed controls must not hide content or trap focus.

## 14. Current demo data boundary

The current visual experience uses realistic Indian restaurant seed data, rupee pricing, Mandrem/A2 copy and local or supplied food imagery.

During this rebuild:

- keep demo data functional;
- keep it behind a replaceable data boundary;
- do not connect Supabase;
- do not add a fake backend merely to imitate production;
- do not turn seed content into hard-coded A2-only assumptions inside reusable UI.

## 15. Acceptance standard

The rebuild is ready for review when:

- Codex can explain the existing Site's observed routes, states and interactions;
- the local app reproduces the approved menu-to-order journey;
- mobile and desktop screenshots are visually comparable to the supplied references;
- the app remains tenant/location-configurable at the presentation/data boundary;
- no backend work has been added;
- the code has clear future TanStack/Supabase seams without prematurely deciding feature folders;
- lint/build/type checks appropriate to the existing toolchain pass;
- the final folder structure is proposed from the audit and approved before large-scale extraction.
