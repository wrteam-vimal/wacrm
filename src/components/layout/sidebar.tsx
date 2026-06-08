"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useTotalUnread } from "@/hooks/use-total-unread";
import { useTheme } from "@/hooks/use-theme";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Crown,
  GitBranch,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Radio,
  Settings,
  Shield,
  User,
  UserCog,
  Users,
  UsersRound,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AccountRole } from "@/lib/auth/roles";

// Per-role chip metadata used in the sidebar's account strip + the
// Members tab roster. Keeping this near both consumers in a single
// place avoids drift between the two surfaces — when a designer
// wants to recolour "agent" rows, this is the one diff.
const ROLE_CHIP: Record<
  AccountRole,
  { icon: typeof Crown; label: string; className: string }
> = {
  owner: {
    icon: Crown,
    label: "Owner",
    // Amber: scarce, immutable, "the boss" — gets visual emphasis.
    className:
      "border-amber-500/40 bg-amber-500/10 text-amber-300",
  },
  admin: {
    icon: Shield,
    label: "Admin",
    // Primary-tinted: significant but not as scarce as owner.
    className:
      "border-primary/40 bg-primary/10 text-primary",
  },
  agent: {
    icon: UserCog,
    label: "Agent",
    // Neutral slate: the operational default.
    className:
      "border-slate-700 bg-slate-800 text-slate-300",
  },
  viewer: {
    icon: User,
    label: "Viewer",
    // Muted slate: read-only role; visually quieter than agent.
    className:
      "border-slate-800 bg-slate-900 text-slate-500",
  },
};
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NavItem {
  id: string;
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  beta?: boolean;
}

const ALL_MENU_ITEMS: NavItem[] = [
  { id: "dashboard", href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "inbox", href: "/inbox", label: "Inbox", icon: MessageSquare },
  { id: "contacts", href: "/contacts", label: "Contacts", icon: Users },
  { id: "pipelines", href: "/pipelines", label: "Pipelines", icon: GitBranch },
  { id: "broadcasts", href: "/broadcasts", label: "Broadcasts", icon: Radio },
  { id: "automations", href: "/automations", label: "Automations", icon: Zap },
  { id: "flows", href: "/flows", label: "Flows", icon: Workflow, beta: true },
  { id: "settings", href: "/settings", label: "Settings", icon: Settings },
];

interface SidebarProps {
  /** Controlled on mobile by the Header's hamburger button. Ignored on lg+. */
  open?: boolean;
  onClose?: () => void;
  isCollapsed?: boolean;
}

// Same flag key the Members tab and Settings page use. Flip per
// profile via Supabase Studio to dogfood the multi-user surface.
const ACCOUNT_SHARING_FLAG = "account_sharing";

export function Sidebar({ open = false, onClose, isCollapsed = false }: SidebarProps) {
  const pathname = usePathname();
  const { profile, profileLoading, account, accountRole, signOut, permissions } = useAuth();
  const totalUnread = useTotalUnread();
  const { showLogo, showTitle, logoUrl, titleText } = useTheme();


  const [orderedItems, setOrderedItems] = useState<NavItem[]>(ALL_MENU_ITEMS);

  useEffect(() => {
    const handleOrderChange = () => {
      if (profile?.id) {
        const stored = localStorage.getItem(`wacrm-menu-order-${profile.id}`);
        if (stored) {
          try {
            const order = JSON.parse(stored) as string[];
            const sorted = [...ALL_MENU_ITEMS].sort((a, b) => {
              const indexA = order.indexOf(a.id);
              const indexB = order.indexOf(b.id);
              if (indexA === -1 && indexB === -1) return 0;
              if (indexA === -1) return 1;
              if (indexB === -1) return -1;
              return indexA - indexB;
            });
            setOrderedItems(sorted);
          } catch (err) {
            console.error("Failed to parse menu order:", err);
          }
        }
      }
    };

    handleOrderChange();
    window.addEventListener("wacrm-menu-order-changed", handleOrderChange);
    return () => {
      window.removeEventListener("wacrm-menu-order-changed", handleOrderChange);
    };
  }, [profile?.id]);
  // Match the settings page's check: only treat the flag as enabled
  // once the profile has finished loading. Without this, the strip
  // would briefly flash absent during the initial profile fetch
  // (when `profile` is null and the boolean coerces to false), then
  // pop in once the row resolves — visible as a layout jump in the
  // sidebar footer.
  const accountSharingEnabled =
    !profileLoading &&
    !!profile?.beta_features?.includes(ACCOUNT_SHARING_FLAG);

  // Close the drawer when route changes — users opened it to navigate,
  // so once they pick a destination the drawer should get out of the way.
  useEffect(() => {
    onClose?.();
    // Only pathname drives this — onClose identity doesn't need to re-run it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Lock body scroll and allow Escape to close while the drawer is open on
  // mobile. No-ops on desktop because the sidebar isn't positioned there.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop — only exists on mobile and only when open. Clicking
          it closes the drawer. Hidden from lg+ since the sidebar is
          part of the main flex row there. */}
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-30 bg-slate-950/70 backdrop-blur-sm transition-opacity lg:hidden",
          open
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        )}
      />

      <TooltipProvider delay={200}>
        <aside
          className={cn(
            // Mobile: fixed drawer that slides in from the left.
            "fixed inset-y-0 left-0 z-40 flex h-full w-64 flex-col border-r border-slate-800 bg-slate-900",
            "transition-[transform,width] duration-300 ease-in-out will-change-transform",
            open ? "translate-x-0" : "-translate-x-full",
            // Desktop: static, always visible — reset all the mobile framing.
            "lg:static lg:z-0 lg:translate-x-0",
            isCollapsed ? "lg:w-16" : "lg:w-60"
          )}
          aria-label="Primary"
        >
          {/* Logo row. On mobile we put a close button here; on desktop the
              close button is hidden since the sidebar is always-visible. */}
          <div className={cn(
            "flex h-14 shrink-0 items-center border-b border-slate-800 transition-all duration-300",
            isCollapsed ? "justify-center px-2" : "justify-between gap-2 px-4"
          )}>
            {(showLogo || showTitle) && (
              <Link href="/dashboard" className="flex items-center gap-2 min-w-0">
                {showLogo && (
                  logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logoUrl || undefined}
                      alt="Logo"
                      className="h-8 w-8 object-contain rounded-lg shrink-0"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shrink-0">
                      <MessageSquare className="h-4 w-4" />
                    </div>
                  )
                )}
                {!isCollapsed && showTitle && (
                  <span className="truncate text-sm font-semibold text-white">
                    {titleText}
                  </span>
                )}
              </Link>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close menu"
              className="flex h-9 w-9 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
            {/* Main navigation */}
            <nav className="flex-1 overflow-y-auto px-3 py-4">
              <ul className="flex flex-col gap-1">
                {orderedItems.map((item) => {
                  const key = item.id as keyof typeof permissions;
                  if (permissions && permissions[key] === false) return null;

                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/dashboard" && pathname.startsWith(item.href));

                  const showUnreadDot =
                    item.href === "/inbox" && totalUnread > 0 && !isActive;

                  const linkContent = (
                    <div className="relative flex items-center justify-center">
                      <item.icon className="h-4 w-4 shrink-0" />
                      {isCollapsed && showUnreadDot && (
                        <span
                          aria-label={`${totalUnread} unread conversation${totalUnread === 1 ? "" : "s"}`}
                          className="absolute -top-1.5 -right-1.5 flex h-2.5 w-2.5"
                        >
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
                        </span>
                      )}
                    </div>
                  );

                  const linkElement = (
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all lg:py-2",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-slate-400 hover:bg-slate-800 hover:text-white",
                        isCollapsed && "lg:justify-center lg:px-2"
                      )}
                    >
                      {isCollapsed ? (
                        linkContent
                      ) : (
                        <>
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span className="flex-1">{item.label}</span>
                          {item.beta && (
                            <span
                              aria-label="Beta feature"
                              className="rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-300"
                            >
                              Beta
                            </span>
                          )}
                          {showUnreadDot && (
                            <span
                              aria-label={`${totalUnread} unread conversation${totalUnread === 1 ? "" : "s"}`}
                              className="relative flex h-2 w-2"
                            >
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                            </span>
                          )}
                        </>
                      )}
                    </Link>
                  );

                  return (
                    <li key={item.href}>
                      {isCollapsed ? (
                        <Tooltip>
                          <TooltipTrigger render={linkElement}>
                            {linkContent}
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            {item.label}
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        linkElement
                      )}
                    </li>
                  );
                })}
              </ul>
            </nav>

            {/* User section */}
            <div className="shrink-0 border-t border-slate-800 p-3">
              {/* Account name display — only surfaced when the user is
              opted into the account_sharing beta flag. For solo
              users (the default) the account is named after them,
              so showing it here would just duplicate the user name
              below. Once the flag is on the user is at minimum
              aware of which shared account they're acting in. */}
              {accountSharingEnabled && account?.name && !isCollapsed && (
                <div className="mb-2 flex items-center gap-2 px-3 text-xs text-slate-500">
                  <UsersRound className="size-3.5 shrink-0" />
                  {/* `title=` exposes the full name on hover when it
                  gets truncated (long account names + narrow
                  sidebars). Cheap a11y win. */}
                  <span className="truncate" title={account.name}>
                    {account.name}
                  </span>
                  {accountRole ? (
                    // Always render the chip — owners used to be
                    // invisible here, which made them indistinguishable
                    // from admins at a glance. Now everyone sees their
                    // role (with a colour cue) regardless of tier.
                    (() => {
                      const meta = ROLE_CHIP[accountRole];
                      const Icon = meta.icon;
                      return (
                        <span
                          className={`ml-auto inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${meta.className}`}
                        >
                          <Icon className="size-3" />
                          {meta.label}
                        </span>
                      );
                    })()
                  ) : null}
                </div>
              )}
              <DropdownMenu>
                {isCollapsed ? (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <DropdownMenuTrigger className="flex w-full items-center justify-center rounded-lg px-1 py-2 text-left transition-colors hover:bg-slate-800/60 focus:bg-slate-800/60 focus:outline-none data-popup-open:bg-slate-800/60">
                          <Avatar className="size-8 shrink-0">
                            {profile?.avatar_url ? (
                              <AvatarImage
                                src={profile.avatar_url}
                                alt={profile.full_name ?? "Avatar"}
                              />
                            ) : null}
                            <AvatarFallback className="bg-primary/10 text-sm font-medium text-primary">
                              {profile?.full_name?.charAt(0)?.toUpperCase() ??
                                profile?.email?.charAt(0)?.toUpperCase() ??
                                "U"}
                            </AvatarFallback>
                          </Avatar>
                        </DropdownMenuTrigger>
                      }
                    />
                    <TooltipContent side="right">
                      <div className="text-xs font-semibold">{profile?.full_name ?? "User"}</div>
                      <div className="text-[10px] text-slate-400">{profile?.email ?? ""}</div>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-slate-800/60 focus:bg-slate-800/60 focus:outline-none data-popup-open:bg-slate-800/60">
                    <Avatar className="size-8 shrink-0">
                      {profile?.avatar_url ? (
                        <AvatarImage
                          src={profile.avatar_url}
                          alt={profile.full_name ?? "Avatar"}
                        />
                      ) : null}
                      <AvatarFallback className="bg-primary/10 text-sm font-medium text-primary">
                        {profile?.full_name?.charAt(0)?.toUpperCase() ??
                          profile?.email?.charAt(0)?.toUpperCase() ??
                          "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">
                        {profile?.full_name ?? "User"}
                      </p>
                      <p className="truncate text-xs text-slate-400">
                        {profile?.email ?? ""}
                      </p>
                    </div>
                  </DropdownMenuTrigger>
                )}
                <DropdownMenuContent
                  align="end"
                  side="top"
                  sideOffset={6}
                  className="min-w-56 bg-slate-900 text-slate-100 ring-slate-700"
                >
                  <DropdownMenuItem
                    render={
                      <Link
                        href="/settings/profile"
                        onClick={onClose}
                        className="text-slate-200 focus:bg-slate-800 focus:text-white"
                      />
                    }
                  >
                    <User className="size-4" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    render={
                      <Link
                        href="/settings/whatsapp"
                        onClick={onClose}
                        className="text-slate-200 focus:bg-slate-800 focus:text-white"
                      />
                    }
                  >
                    <Settings className="size-4" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-slate-800" />
                  <DropdownMenuItem
                    onClick={signOut}
                    className="text-slate-200 focus:bg-slate-800 focus:text-white"
                  >
                    <LogOut className="size-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
        </aside>
      </TooltipProvider>
    </>
  );
}
