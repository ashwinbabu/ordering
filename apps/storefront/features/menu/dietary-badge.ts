const dietaryBadges = {
  Veg: { modifier: "veg", label: "Vegetarian" },
  "Non-veg": { modifier: "non-veg", label: "Non-vegetarian" },
  Egg: { modifier: "egg", label: "Eggitarian" },
} as const;

export function dietaryInfoFor(badges?: string[]) {
  const badge = badges?.find((candidate) => candidate in dietaryBadges);
  return badge ? dietaryBadges[badge as keyof typeof dietaryBadges] : undefined;
}

export function productTagFor(badges?: string[]) {
  return badges?.find((badge) => !(badge in dietaryBadges) && badge !== "Sold out");
}
