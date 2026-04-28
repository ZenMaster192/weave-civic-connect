import { Link, useLocation, useNavigate } from "react-router-dom";
import { ReactNode, useState } from "react";
import { WeaveLogo } from "@/components/WeaveLogo";
import { Button } from "@/components/ui/button";
import { Bell, LogOut, LayoutDashboard, PlusCircle, ListChecks, Map, Users, Trophy, ShieldCheck } from "lucide-react";
import { useAuthStore } from "@/store/AuthStore";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/services/api";
import { systemApi } from "@/services/api";
import { useQuery } from "@tanstack/react-query";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

function BellDropdown() {
  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: systemApi.getNotifications,
    refetchInterval: 10000 // Poll every 10s
  });

  const [open, setOpen] = useState(false);
  const hasUnread = notifications.some(n => !n.read);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {hasUnread && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.length === 0 && <p className="text-xs p-4 text-center text-muted-foreground">No new alerts</p>}
        {notifications.map(n => (
          <DropdownMenuItem key={n.id} className="flex gap-3 items-start py-2">
            <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.color}`} />
            <div>
              <p className="text-sm font-medium">{n.title}</p>
              <p className="text-xs text-muted-foreground">{n.desc}</p>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

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
          <BellDropdown />
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
            <BellDropdown />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-9 h-9 rounded-full bg-gradient-accent flex items-center justify-center text-sm font-semibold hover:shadow-glow transition-smooth outline-none">
                  {displayName[0]?.toUpperCase() ?? "?"}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 p-2">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1 p-1">
                    <p className="text-sm font-medium leading-none">{displayName}</p>
                    <p className="text-xs leading-none text-muted-foreground">{profile?.email || token?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="capitalize py-2 cursor-pointer">
                  <Link to={`/${role}/profile`}>
                    <Users className="mr-2 h-4 w-4" /> {role} Account
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:bg-destructive focus:text-destructive-foreground cursor-pointer py-2 rounded-lg">
                  <LogOut className="mr-2 h-4 w-4" /> Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}