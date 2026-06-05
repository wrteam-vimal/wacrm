"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { ShieldAlert } from "lucide-react";
import type { UserPermissions } from "@/lib/auth/permissions";

// Route to permission key mapping helper
function getRequiredPermission(pathname: string): keyof UserPermissions | null {
  if (pathname === "/dashboard") return "dashboard";
  if (pathname.startsWith("/inbox")) return "inbox";
  if (pathname.startsWith("/contacts")) return "contacts";
  if (pathname.startsWith("/pipelines")) return "pipelines";
  if (pathname.startsWith("/broadcasts")) return "broadcasts";
  if (pathname.startsWith("/automations")) return "automations";
  if (pathname.startsWith("/flows")) return "flows";
  if (pathname === "/settings/profile") return "settings_profile";
  if (pathname === "/settings/whatsapp") return "settings_whatsapp";
  if (pathname === "/settings/templates") return "settings_templates";
  if (pathname === "/settings/tags") return "settings_tags";
  if (pathname === "/settings/appearance") return "settings_appearance";
  if (pathname === "/settings/seo") return "settings_seo";
  return null;
}

function PermissionDenied() {
  return (
    <div className="flex h-[calc(100vh-140px)] flex-col items-center justify-center text-center px-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 text-red-500 mb-6 border border-red-500/20">
        <ShieldAlert className="h-8 w-8" />
      </div>
      <h2 className="text-xl font-bold text-white mb-2">Permission not available</h2>
      <p className="text-sm text-slate-400 max-w-md">
        You do not have access to this page. Please contact your account administrator if you believe this is an error.
      </p>
    </div>
  );
}

// Auth-gated dashboard shell. Extracted from the layout so the layout
// itself can stay a server component and export metadata (noindex) —
// client components can't export Next's metadata object.

function DashboardShellInner({ children }: { children: React.ReactNode }) {
  const { user, loading, permissions } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Sidebar drawer state — only used on mobile. On lg+ the sidebar is
  // always visible and this stays at `false` (ignored by the component).
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  // Determine page access privileges
  const requiredPermission = getRequiredPermission(pathname);
  let hasAccess = !requiredPermission || (permissions && permissions[requiredPermission] !== false);
  if (pathname.startsWith("/settings/roles")) {
    hasAccess = !!(permissions?.manage_roles || permissions?.manage_users);
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      <Sidebar open={sidebarOpen} onClose={closeSidebar} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onOpenSidebar={() => setSidebarOpen(true)} />
        {/* Thinner horizontal padding on mobile so cards have room to breathe. */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {hasAccess ? children : <PermissionDenied />}
        </main>
      </div>
    </div>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <DashboardShellInner>{children}</DashboardShellInner>
    </AuthProvider>
  );
}
