import { cn } from "@/lib/utils";

type PlexsolLogoProps = {
  className?: string;
  /**
   * Dual-surface logo policy (DEF-P3-03):
   * - `official` — `/brand/plexsol_logo.png` for dark surfaces (login hero).
   * - `light` — orange mark + charcoal wordmark for light SaaS shell surfaces,
   *   matching the dashboard reference (PNG has a baked black background).
   */
  variant?: "light" | "official";
  compact?: boolean;
};

/**
 * Plexsol brand mark.
 * Official raster asset: `apps/web/public/brand/plexsol_logo.png`.
 */
export function PlexsolLogo({
  className,
  variant = "light",
  compact = false,
}: PlexsolLogoProps) {
  if (variant === "official") {
    return (
      <img
        src="/brand/plexsol_logo.png"
        alt="Plexsol"
        className={cn(
          compact ? "h-8 w-auto" : "h-10 w-auto",
          "object-contain",
          className,
        )}
      />
    );
  }

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span aria-hidden className="relative inline-flex h-8 w-8 shrink-0">
        <span className="absolute left-0 top-1 h-6 w-2.5 rounded-t-md rounded-b-sm bg-primary" />
        <span className="absolute right-0 top-0 h-5 w-5 rounded-full border-[5px] border-primary bg-transparent" />
      </span>
      {!compact ? (
        <span className="text-lg font-semibold tracking-tight text-foreground">
          plexsol
        </span>
      ) : null}
      <span className="sr-only">Plexsol</span>
    </div>
  );
}
