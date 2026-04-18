import { Link, useLocation, useNavigate } from "react-router-dom";
import { ReactNode } from "react";
import { WeaveLogo } from "@/components/WeaveLogo";
import { Button } from "@/components/ui/button";
import { Bell, LogOut, LayoutDashboard, PlusCircle, ListChecks, Map, Users, Trophy, ShieldCheck } from "lucide-react";
import { useAuthStore } from "@/store/AuthStore";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/services/api";

type Role = UserRole;

const NAV: Record<Role, { to: string; label: string; icon: any }[]> = {
  citizen: [
    { to: "/citizen", label: "Dashboard", icon: LayoutDashboard },
    { to: "/citizen/raise", label: "Raise Issue", icon: PlusCircle },
    { to: "/citizen/activity", label: "Activity Log", icon: ListChecks },
  ],
  volunteer: [
    { to: "/volunteer", label: "Dashboard", icon: LayoutDashboard },
    { to: "/volunteer/discover", label: "Discover", icon: Map },
    { to: "/volunteer/leaderboard", label: "Leaderboard", icon: Trophy },
  ],
  ngo: [
    { to: "/ngo", label: "Dashboard", icon: LayoutDashboard },
    { to: "/ngo/members", label: "Members", icon: Users },
    { to: "/ngo/approvals", label: "Approvals", icon: ShieldCheck },
    { to: "/ngo/activity", label: "Activity", icon: ListChecks },
  ],
};

export default function AppShell({ children, role }: { children: ReactNode; role: Role }) {
  const { token, profile, logout } = useAuthStore();
  const nav = useNavigate();
  const loc = useLocation();
  const items = NAV[role];

  const displayName = profile?.full_name ?? token?.full_name ?? "Guest";
  const orgName = profile?.org_name ?? null;

  const handleLogout = () => { logout(); nav("/"); };

  return (
    <div className="min-h-screen flex w-full bg-background">
      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-sidebar">
        <div className="p-5 border-b border-sidebar-border">
          <WeaveLogo />
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {items.map((it) => {
            const Active = loc.pathname === it.to;
            const Icon = it.icon;
            return (
              <Link
                key={it.to}
                to={it.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-smooth",
                  Active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-soft"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60"
                )}
              >
                <Icon className="w-4 h-4" />
                {it.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={handleLogout}>
            <LogOut className="w-4 h-4" /> Sign out
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border bg-card/60 backdrop-blur flex items-center justify-between px-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Welcome back</p>
            <h2 className="font-display text-xl font-semibold leading-tight">
              {displayName}
              {role === "ngo" && orgName ? <span className="text-muted-foreground font-sans text-base font-normal"> · {orgName}</span> : null}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-accent" />
            </Button>
            <div className="w-9 h-9 rounded-full bg-gradient-accent flex items-center justify-center text-sm font-semibold">
              {displayName[0]?.toUpperCase() ?? "?"}
            </div>
          </div>
        </header>
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}