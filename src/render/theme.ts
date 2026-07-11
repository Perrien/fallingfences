// Read a CSS custom property (design token) at runtime — used by the canvas components
// (dial, contact graph) so they draw with the same palette as the CSS-styled UI, keeping
// theme.css the single source of truth. Light-only, so values are static; reading per draw
// is cheap and avoids duplicating the palette in JS.
export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
