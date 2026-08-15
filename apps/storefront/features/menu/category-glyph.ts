const categoryGlyphs = ["◒", "✦", "◇", "◡", "○"];

export function categoryGlyphAt(index: number) {
  return categoryGlyphs[index % categoryGlyphs.length];
}
