// Approximate centroid coordinates for the areas offered by the address
// picker. The address form does not collect a precise pin (no map/geocoding
// integration exists in this app), so this is the coarse "which coastal
// village" resolution used to call the real ordering.get_delivery_quote
// distance-zone boundary -- an honest, schema-backed estimate rather than a
// fabricated flat delivery fee.
export const areaCoordinates: Record<
  string,
  { latitude: number; longitude: number }
> = {
  Arambol: { latitude: 15.6889, longitude: 73.704 },
  Mandrem: { latitude: 15.658, longitude: 73.713 },
  Ashwem: { latitude: 15.643, longitude: 73.718 },
  Morjim: { latitude: 15.627, longitude: 73.735 },
};
