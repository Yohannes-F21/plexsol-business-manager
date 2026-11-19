import { cn } from "@/lib/utils";

type PlexsolLogoProps = {
  className?: string;
  showWordmark?: boolean;
};

/**
 * Light-surface brand mark for the app shell.
 * Official raster assets live in /public/brand for dark surfaces and favicons.
 */
export function PlexsolLogo({
  className,
  showWordmark = true,
}: PlexsolLogoProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span
        aria-hidden
        className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center"
      >
        <span className="absolute left-0 top-0 h-5 w-5 rounded-[4px] bg-primary" />
        <span className="absolute bottom-0 right-0 h-5 w-5 rounded-[4px] border-2 border-primary bg-card" />
      </span>
      {showWordmark ? (
        <span className="text-lg font-semibold tracking-tight text-foreground">
          plexsol
        </span>
      ) : null}
      <span className="sr-only">Plexsol</span>
    </div>
  );
}

export function PlexsolOfficialMark({ className }: { className?: string }) {
  return (
    <img
      src="/brand/plexsol-logo.png"
      alt="Plexsol Technologies"
      className={cn("h-10 w-auto object-contain", className)}
    />
  );
}
