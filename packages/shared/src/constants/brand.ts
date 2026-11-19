/** Plexsol brand tokens for shared UI / docs references. */
export const PLEXSOL_BRAND = {
  name: "Plexsol",
  productName: "Plexsol Business Manager",
  colors: {
    orange: "#F15A24",
    charcoal: "#1A1A1A",
    black: "#0B0B0B",
    white: "#FFFFFF",
    offWhite: "#F7F7F5",
    muted: "#6B7280",
    border: "#E5E7EB",
  },
} as const;

export type PlexsolBrand = typeof PLEXSOL_BRAND;
