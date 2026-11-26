                               "use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  PlusCircle,
  History,
  Users,
  Trophy,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";                                                                                                                  
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

interface AuthUser {
  userId: string;
  name: string;
  email: string;
  role: string;
}

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/games/new", label: "New Game", icon: PlusCircle },
  { href: "/games", label: "Game History", icon: History },
  { href: "/players", label: "Players", icon: Users },
];

function getInitials(name?: string): string {
  if (!name) return "PG";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) setUser(data.user);
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const isRouteActive = (href: string) => {
    if (href === "/") return pathname === "/";
    if (href === "/games") {
      return pathname === "/games" || (pathname.startsWith("/games/") && pathname !== "/games/new");
    }
    return pathname.startsWith(href);
  };

  const pageTitle = (() => {
    if (pathname === "/") return "Dashboard";
    if (pathname === "/games/new") return "Create New Game";
    if (pathname.endsWith("/results")) return "Game Results";
    if (pathname.startsWith("/games/")) return "Active Game Session";
    if (pathname === "/games") return "Game History";
    if (pathname.startsWith("/players/")) return "Player Profile";
    if (pathname === "/players") return "Player Management";
    return "PackScore Pro";
  })();

  const SidebarBody = (
    <div className="flex h-full flex-col bg-card">
      {/* Brand */}
      <div className="flex h-16 items-center justify-between px-5 border-b">
        <Link
          href="/"
          onClick={() => setMobileOpen(false)}
          className="flex items-center gap-2.5"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Trophy className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-tight leading-none">
              PackScore Pro
            </span>
            <span className="text-[11px] text-muted-foreground mt-0.5">
              Score &amp; Prize Manager
            </span>
          </div>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden h-8 w-8"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-3">
        <p className="px-3 pb-1.5 pt-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Navigation
        </p>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isRouteActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Account Footer */}
      <div className="p-3 border-t">
        <div className="flex items-center justify-between gap-2 rounded-md p-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar className="h-8 w-8 border">
              <AvatarFallback className="bg-secondary text-xs font-semibold">
                {getInitials(user?.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium leading-none">
                {user?.name || "Host"}
              </p>
              <p className="truncate text-xs text-muted-foreground mt-1">
                {user?.email || ""}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
            title="Sign Out"
            aria-label="Sign Out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-[100dvh] bg-background overflow-x-clip">
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:w-64 lg:flex-col border-r bg-card no-print">
        <div className="h-full overflow-y-auto">{SidebarBody}</div>
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden no-print">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-10 w-72 max-w-[82vw] h-full shadow-xl">
            {SidebarBody}
          </div>
        </div>
      )}

      {/* Main Content Column */}
      <div className="flex min-h-[100dvh] flex-1 flex-col min-w-0 lg:pl-64">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 flex h-14 sm:h-16 items-center justify-between gap-3 border-b bg-card/95 backdrop-blur px-3 sm:px-6 lg:px-8 no-print">
          <div className="flex items-center gap-2.5 min-w-0">
            <Button
              variant="outline"
              size="icon"
              className="lg:hidden h-9 w-9 shrink-0"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-4 w-4" />
            </Button>
            <span className="truncate text-sm sm:text-base font-semibold text-foreground">
              {pageTitle}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button asChild size="sm" className="h-9 px-3">
              <Link href="/games/new">
                <PlusCircle className="mr-1.5 h-4 w-4" />
                <span>New Game</span>
              </Link>
            </Button>
          </div>
        </header>

        {/* Page Container (extra bottom padding on mobile for bottom nav bar) */}
        <main className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 pb-24 lg:pb-8">
          {children}
        </main>

        <Separator className="hidden lg:block no-print" />
        <footer className="hidden lg:block py-4 px-6 text-center text-xs text-muted-foreground no-print">
          PackScore Pro &bull; Pack Game Score &amp; Prize Distribution Platform
        </footer>

        {/* Mobile Bottom Tab Bar (auto-hidden when mobile keyboard is open) */}
        <nav
          aria-label="Mobile Navigation"
          className="mobile-bottom-nav fixed bottom-0 inset-x-0 z-40 border-t bg-card/95 backdrop-blur pb-[env(safe-area-inset-bottom)] lg:hidden no-print"
        >
          <div className="grid grid-cols-4 h-16 max-w-lg mx-auto">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isRouteActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                    active ? "text-primary font-semibold" : "text-muted-foreground"
                  )}
                >
                  <Icon className={cn("h-5 w-5", active && "stroke-[2.5]")} />
                  <span className="truncate">{item.label.replace("Game ", "")}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
