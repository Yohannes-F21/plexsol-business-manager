import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  CreditCard,
  Users,
  FolderKanban,
  Wrench,
  Banknote,
  Receipt,
  Bell,
  BarChart3,
  Settings,
  Menu,
  X,
  LogOut,
  ChevronDown,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { PlexsolLogo } from "@/components/brand/plexsol-logo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

const primaryNavItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/subscriptions", label: "Subscriptions", icon: CreditCard },
  { to: "/clients", label: "Clients", icon: Users },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/maintenance", label: "Maintenance", icon: Wrench },
  { to: "/payments", label: "Payments", icon: Banknote },
  { to: "/expenses", label: "Expenses", icon: Receipt },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/reports", label: "Reports", icon: BarChart3 },
] as const;

const settingsNavItem = {
  to: "/settings",
  label: "Settings",
  icon: Settings,
} as const;

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
};

function navLinkClassName(isActive: boolean, collapsed: boolean) {
  return cn(
    "group flex items-center rounded-[10px] text-sm font-medium leading-5 transition-colors duration-150",
    collapsed ? "justify-center px-0 py-3" : "gap-3 px-3 py-3",
    isActive
      ? "bg-primary-subtle text-primary hover:bg-primary-subtle hover:text-primary"
      : "text-muted-foreground hover:bg-hover-surface hover:text-foreground",
  );
}

function NavItems({
  items,
  collapsed = false,
  onNavigate,
}: {
  items: readonly NavItem[];
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav
      aria-label="Primary"
      className={cn("flex flex-1 flex-col gap-1", collapsed ? "px-2" : "px-3")}
    >
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end ?? false}
          title={collapsed ? label : undefined}
          onClick={onNavigate}
          className={({ isActive }) => navLinkClassName(isActive, collapsed)}
        >
          {({ isActive }) => (
            <>
              <Icon
                className={cn(
                  "size-5 shrink-0",
                  isActive ? "text-primary" : "text-current",
                )}
                strokeWidth={1.75}
                aria-hidden="true"
              />
              {!collapsed ? <span>{label}</span> : null}
              {collapsed ? <span className="sr-only">{label}</span> : null}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

function SettingsNavLink({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const Icon = settingsNavItem.icon;

  return (
    <div className={cn(collapsed ? "px-2" : "px-3")}>
      <NavLink
        to={settingsNavItem.to}
        title={collapsed ? settingsNavItem.label : undefined}
        onClick={onNavigate}
        className={({ isActive }) => navLinkClassName(isActive, collapsed)}
      >
        {({ isActive }) => (
          <>
            <Icon
              className={cn(
                "size-5 shrink-0",
                isActive ? "text-primary" : "text-current",
              )}
              strokeWidth={1.75}
              aria-hidden="true"
            />
            {!collapsed ? <span>{settingsNavItem.label}</span> : null}
            {collapsed ? (
              <span className="sr-only">{settingsNavItem.label}</span>
            ) : null}
          </>
        )}
      </NavLink>
    </div>
  );
}

function ProfileBlock({
  compact = false,
  collapsed = false,
}: {
  compact?: boolean;
  collapsed?: boolean;
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const initials = (user?.name ?? "U")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const onLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  if (compact || collapsed) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary-subtle text-sm font-semibold text-primary transition-colors duration-150 hover:bg-primary-border/60"
            aria-label="Profile menu"
          >
            {initials}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 rounded-[10px]">
          <DropdownMenuLabel>
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-foreground">
                {user?.name}
              </span>
              <span className="text-xs text-muted-foreground">{user?.email}</span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => navigate("/settings")}>
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void onLogout()}>
            <LogOut className="mr-2 size-5" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className="px-3 py-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-[10px] px-2 py-2 text-left transition-colors duration-150 hover:bg-hover-surface"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-sm font-semibold text-primary">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium leading-5 text-foreground">
                {user?.name ?? "User"}
              </p>
              <p className="truncate text-xs leading-[18px] text-muted-foreground">
                {user?.email}
              </p>
            </div>
            <ChevronDown
              className="size-5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56 rounded-[10px]">
          <DropdownMenuLabel>Signed in</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => navigate("/settings")}>
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void onLogout()}>
            <LogOut className="mr-2 size-5" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function SidebarAccent() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[300px] overflow-hidden"
    >
      {/* Extracted from Plexsol sidebar reference — layered peach→orange arcs */}
      <img
        src="/brand/sidebar-accent.png"
        alt=""
        className="absolute bottom-0 right-0 h-[300px] w-full max-w-none select-none object-cover object-right-bottom"
        draggable={false}
      />
    </div>
  );
}

function SidebarChrome({
  collapsed,
  onNavigate,
  onToggleCollapse,
  showCollapseToggle,
  onCloseMobile,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
  onToggleCollapse?: () => void;
  showCollapseToggle?: boolean;
  onCloseMobile?: () => void;
}) {
  return (
    <>
      <div
        className={cn(
          "relative z-10 flex h-[72px] shrink-0 items-center",
          collapsed ? "justify-center px-2" : "justify-between gap-2 px-5",
        )}
      >
        {collapsed ? (
          <PlexsolLogo variant="light" compact className="h-10 w-10" />
        ) : (
          <PlexsolLogo variant="light" className="h-12 max-w-[200px]" />
        )}
        {onCloseMobile ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={onCloseMobile}
            aria-label="Close navigation"
          >
            <X className="size-5" />
          </Button>
        ) : null}
        {showCollapseToggle && onToggleCollapse ? (
          <Button
            variant="ghost"
            size="icon"
            className={cn("shrink-0", collapsed && "hidden")}
            onClick={onToggleCollapse}
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="size-5" />
          </Button>
        ) : null}
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pb-2 pt-8">
        <NavItems
          items={primaryNavItems}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
      </div>

      <div className="relative z-10 mt-auto flex flex-col border-t border-border/70 pt-2">
        {showCollapseToggle && onToggleCollapse && collapsed ? (
          <div className="px-2 pb-1">
            <Button
              variant="ghost"
              size="icon"
              className="w-full"
              onClick={onToggleCollapse}
              aria-label="Expand sidebar"
            >
              <PanelLeft className="size-5" />
            </Button>
          </div>
        ) : null}
        <SettingsNavLink collapsed={collapsed} onNavigate={onNavigate} />
        <div className={cn(collapsed && "flex justify-center px-2 py-3")}>
          <ProfileBlock collapsed={collapsed} />
        </div>
      </div>

      <SidebarAccent />
    </>
  );
}

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileOpen]);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop / large tablet sidebar */}
      <aside
        className={cn(
          "relative sticky top-0 hidden h-screen shrink-0 flex-col overflow-hidden border-r border-border bg-card transition-[width] duration-200 lg:flex",
          collapsed ? "w-[72px]" : "w-64",
        )}
      >
        <SidebarChrome
          collapsed={collapsed}
          showCollapseToggle
          onToggleCollapse={() => setCollapsed((value) => !value)}
        />
      </aside>

      {/* Mobile / tablet drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40 transition-opacity duration-150"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 flex h-full w-[min(100%,288px)] flex-col overflow-hidden border-r border-border bg-card shadow-[var(--shadow-dialog)]">
            <SidebarChrome
              collapsed={false}
              onNavigate={() => setMobileOpen(false)}
              onCloseMobile={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top chrome */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border bg-card/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-card/80 lg:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Menu className="size-5" />
            </Button>
            <PlexsolLogo variant="light" className="h-8 max-w-[140px]" />
          </div>
          <ProfileBlock compact />
        </header>

        {/* Desktop top header — aligns with sidebar brand row */}
        <header className="sticky top-0 z-30 hidden h-16 shrink-0 items-center justify-end gap-2 border-b border-border bg-card px-6 xl:px-8 lg:flex">
          <Button
            variant="ghost"
            size="icon"
            asChild
            aria-label="Notifications"
            className="relative"
          >
            <NavLink to="/notifications" className="relative">
              <Bell className="size-5" strokeWidth={1.75} />
              <span className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-primary" />
            </NavLink>
          </Button>
          <ProfileBlock compact />
        </header>

        <main className="flex-1 overflow-auto p-5 sm:p-6 md:p-8 lg:p-8 xl:p-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
