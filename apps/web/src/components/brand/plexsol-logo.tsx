import { cn } from "@/lib/utils";

type PlexsolLogoProps = {
  className?: string;
  /**
   * Dual-surface logo policy:
   * - `official` — `/brand/plexsol_logo.png` (orange + white on black) for dark surfaces.
   * - `light` — `/brand/plexsol_logo_light.png` derived from the official asset
   *   (transparent bg, charcoal wordmark) for the light SaaS shell.
   */
  variant?: "light" | "official";
  /**
   * Compact lockup: crops the light asset to the orange emblem only
   * (used in collapsed sidebar / tight mobile chrome).
   */
  compact?: boolean;
};

/**
 * Plexsol brand mark — always rendered from the official raster asset.
 */
export function PlexsolLogo({
  className,
  variant = "light",
  compact = false,
}: PlexsolLogoProps) {
  const src =
    variant === "official"
      ? "/brand/plexsol_logo.png"
      : "/brand/plexsol_logo_light.png";

  if (variant === "light" && compact) {
    return (
      <img
        src={src}
        alt="Plexsol"
        className={cn(
          "h-9 w-9 object-cover object-left",
          className,
        )}
      />
    );
  }

  return (
    <img
      src={src}
      alt="Plexsol"
      className={cn(
        compact ? "h-9 w-auto" : "h-12 w-auto",
        "object-contain object-left",
        className,
      )}
    />
  );
}
