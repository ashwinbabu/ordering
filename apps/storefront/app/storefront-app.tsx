import { a2MandremStorefront } from "../demo/a2-mandrem";
import { MenuScreen } from "../features/menu/menu-screen";
import { VenueFooter } from "../features/venue/venue-footer";
import { VenueHeader } from "../features/venue/venue-header";

export function StorefrontApp() {
  return (
    <main className="ordering-app">
      <VenueHeader venue={a2MandremStorefront.venue} />
      <MenuScreen menu={a2MandremStorefront.menu} orderingStatus={a2MandremStorefront.venue.orderingStatus} />
      <VenueFooter venue={a2MandremStorefront.venue} />
    </main>
  );
}
