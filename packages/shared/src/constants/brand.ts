/** Plexsol brand tokens for shared UI / docs references. */
export const PLEXSOL_BRAND = {
  name: "Plexsol",
  productName: "Plexsol Business Manager",
  colors: {
    orange: "#FF6500",
    orangeHover: "#E85B00",
    orangePressed: "#CC5000",
    orangeSubtle: "#FFF0E6",
    orangeBorder: "#FFD9BF",
    charcoal: "#111827",
    secondaryText: "#475569",
    black: "#0B0B0B",
    white: "#FFFFFF",
    offWhite: "#F8F9FB",
    muted: "#64748B",
    border: "#E7E9EF",
    divider: "#F0F1F4",
    hoverSurface: "#F5F6F8",
    success: "#15803D",
    successBackground: "#DCFCE7",
    warning: "#B45309",
    warningBackground: "#FEF3C7",
    danger: "#DC2626",
    dangerBackground: "#FEE2E2",
  },
  typography: {
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
} as const;

export type PlexsolBrand = typeof PLEXSOL_BRAND;
