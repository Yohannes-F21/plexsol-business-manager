import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

type ClientsProjectsTabsProps = {
  active: "clients" | "projects";
};

const tabs = [
  { id: "clients" as const, label: "Clients", to: "/clients" },
  { id: "projects" as const, label: "Projects", to: "/projects" },
];

/** Visual section switcher — routes stay separate (/clients and /projects). */
export function ClientsProjectsTabs({ active }: ClientsProjectsTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Clients and projects"
      className="flex flex-wrap gap-1 border-b border-border"
    >
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <Link
            key={tab.id}
            to={tab.to}
            role="tab"
            aria-selected={selected}
            className={cn(
              "relative px-3 py-2.5 text-sm font-medium transition-colors duration-150",
              selected
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
            {selected ? (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
