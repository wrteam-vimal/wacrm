"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { ChevronLeft, ChevronRight, LogOut, Menu, Settings as SettingsIcon, User, RefreshCw } from "lucide-react";
import { toast } from "sonner";
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

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/inbox": "Inbox",
  "/contacts": "Contacts",
  "/pipelines": "Pipelines",
  "/broadcasts": "Broadcasts",
  "/automations": "Automations",
  "/settings": "Settings",
};

function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];
  const match = Object.entries(pageTitles).find(([path]) =>
    pathname.startsWith(path),
  );
  return match ? match[1] : "Dashboard";
}

interface HeaderProps {
  /** Wired to the shell's drawer state. Used only on mobile — the
   *  hamburger button is hidden on lg+. */
  onOpenSidebar?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Header({ onOpenSidebar, isCollapsed = false, onToggleCollapse }: HeaderProps) {
  const pathname = usePathname();
  const { profile, signOut, accountRole } = useAuth();
  const title = getPageTitle(pathname);

  const [clearingCache, setClearingCache] = useState(false);

  const handleClearCache = async () => {
    if (clearingCache) return;
    const confirm = window.confirm("Are you sure you want to clear system and client cache? This will purge Next.js server caches, clear your browser session state, and reload the application.");
    if (!confirm) return;

    setClearingCache(true);
    const toastId = toast.loading("Clearing system cache...");

    try {
      // 1. Clear server-side Next.js cache via API
      const res = await fetch("/api/cache/clear", {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Server cache clear failed");
      }

      // 2. Clear client-side sessionStorage
      sessionStorage.clear();

      // 3. Selectively clear client-side localStorage
      // We retain keys starting with "sb-" to prevent logging the user out.
      const keysToKeep = ["sb-"];
      const keysToRemove: string[] = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const shouldKeep = keysToKeep.some((prefix) => key.startsWith(prefix));
          if (!shouldKeep) {
            keysToRemove.push(key);
          }
        }
      }

      keysToRemove.forEach((key) => localStorage.removeItem(key));

      toast.success("Cache cleared successfully", { id: toastId });

      // 4. Force window reload to re-fetch/re-apply state
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err: any) {
      toast.error("Failed to clear cache", {
        id: toastId,
        description: err.message || "An unexpected error occurred",
      });
    } finally {
      setClearingCache(false);
    }
  };

  const initial =
    profile?.full_name?.charAt(0)?.toUpperCase() ??
    profile?.email?.charAt(0)?.toUpperCase() ??
    "U";

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-slate-800 bg-slate-950 px-4 lg:px-6">
      <div className="flex min-w-0 items-center gap-2">
        {/* Hamburger — mobile only. 44×44 hit target per Apple HIG. */}
        <button
          type="button"
          onClick={onOpenSidebar}
          aria-label="Open menu"
          className="flex h-10 w-10 items-center justify-center rounded-md text-slate-300 transition-colors hover:bg-slate-800 hover:text-white lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Collapse/Expand Sidebar — Desktop only */}
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="hidden h-10 w-10 items-center justify-center rounded-md text-slate-300 transition-colors hover:bg-slate-800 hover:text-white lg:flex"
        >
          {isCollapsed ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <ChevronLeft className="h-5 w-5" />
          )}
        </button>

        <h1 className="truncate text-base font-semibold text-white sm:text-lg">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-3">
        {/* System Cache clear — Desktop only, right side of the header */}
        {(accountRole === "owner" || accountRole === "admin") && (
          <button
            type="button"
            onClick={handleClearCache}
            disabled={clearingCache}
            className="hidden h-9 px-3 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold text-slate-400 border border-slate-800 hover:border-slate-700 hover:text-white hover:bg-slate-900 transition-all lg:flex disabled:opacity-50 select-none cursor-pointer"
            title="Purge Next.js cache and local storage, then reload"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${clearingCache ? "animate-spin text-primary" : ""}`} />
            {clearingCache ? "Clearing..." : "Clear Cache"}
          </button>
        )}

        <DropdownMenu>
        <DropdownMenuTrigger
          className="flex items-center gap-2 rounded-md px-1 py-1 transition-colors hover:bg-slate-800/70 focus:bg-slate-800/70 focus:outline-none data-popup-open:bg-slate-800/70 sm:gap-3 sm:pl-1 sm:pr-3"
          aria-label="Open account menu"
        >
          <Avatar className="size-8">
            {profile?.avatar_url ? (
              <AvatarImage
                src={profile.avatar_url}
                alt={profile.full_name ?? "Avatar"}
              />
            ) : null}
            <AvatarFallback className="bg-primary/10 text-sm font-medium text-primary">
              {initial}
            </AvatarFallback>
          </Avatar>
          <span className="hidden text-sm font-medium text-white sm:inline">
            {profile?.full_name ?? "User"}
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={6}
          className="min-w-56 bg-slate-900 text-slate-100 ring-slate-700"
        >
          <div className="px-2 py-1.5">
            <p className="truncate text-sm font-medium text-white">
              {profile?.full_name ?? "User"}
            </p>
            <p className="truncate text-xs text-slate-400">
              {profile?.email ?? ""}
            </p>
          </div>
          <DropdownMenuSeparator className="bg-slate-800" />
          <DropdownMenuItem
            render={
              <Link
                href="/settings/profile"
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
                className="text-slate-200 focus:bg-slate-800 focus:text-white"
              />
            }
          >
            <SettingsIcon className="size-4" />
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
    </header>
  );
}
