import AppShell from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { PlusCircle, AlertCircle, CheckCircle2, Clock, Bell } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { issuesApi, type Issue } from "@/services/api";
import { useAuthStore } from "@/store/AuthStore";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function CitizenDashboard() {
  const { token } = useAuthStore();

  const { data: issues = [], isLoading } = useQuery<Issue[]>({
    queryKey: ["issues", "citizen", token?.user_id],
    queryFn: () => issuesApi.list({ reporter_id: token?.user_id }),
    enabled: !!token?.user_id,
  });

  const stats = [
    { label: "Open issues", value: issues.filter(i => i.status !== "resolved").length, icon: AlertCircle, tint: "bg-pastel-pink" },
    { label: "Resolved", value: issues.filter(i => i.status === "resolved").length, icon: CheckCircle2, tint: "bg-pastel-green" },
    { label: "In progress", value: issues.filter(i => i.status === "in_progress").length, icon: Clock, tint: "bg-pastel-blue" },
  ];

  return (
    <AppShell role="citizen">
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-8 bg-gradient-citizen border-0 shadow-card">
            <p className="text-sm uppercase tracking-widest text-primary/70 mb-2">Make today count</p>
            <h2 className="font-display text-4xl mb-3">See something? <span className="text-primary">Weave it in.</span></h2>
            <p className="text-foreground/75 max-w-md mb-6">Snap a photo, drop a pin, and let the right volunteer find you.</p>
            <Link to="/citizen/raise">
              <Button size="lg" className="gap-2"><PlusCircle className="w-4 h-4" />Raise an issue</Button>
            </Link>
          </Card>

          <div className="grid grid-cols-3 gap-4">
            {stats.map(s => {
              const Icon = s.icon;
              return (
                <Card key={s.label} className="p-5 soft-card border-0">
                  <div className={`w-10 h-10 rounded-xl ${s.tint} flex items-center justify-center mb-3`}>
                    <Icon className="w-5 h-5 text-foreground/70" />
                  </div>
                  <p className="text-3xl font-display font-semibold">{s.value}</p>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                </Card>
              );
            })}
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-xl">Recent activity</h3>
              <Link to="/citizen/activity" className="text-sm text-primary hover:underline">View all →</Link>
            </div>
            <div className="space-y-3">
              {isLoading
                ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
                : issues.slice(0, 3).map(i => (
                  <Dialog key={i.id}>
                  <DialogTrigger asChild>
                  <Card className="p-4 flex gap-4 items-center soft-card border-0 cursor-pointer hover:shadow-lg transition-shadow">
                    {i.image_url
                      ? <img src={i.image_url} alt={i.title} className="w-16 h-16 rounded-xl object-cover" />
                      : <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center text-xs text-muted-foreground">{i.category}</div>
                    }
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{i.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{i.address || i.city}</p>
                    </div>
                    <Badge variant={i.status === "resolved" ? "default" : "secondary"} className="capitalize">
                      {i.status.replace("_", " ")}
                    </Badge>
                  </Card>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl">
                    <DialogHeader>
                      <DialogTitle className="font-display text-2xl">{i.title}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 text-sm">
                      {i.image_url && (
                        <img src={i.image_url} alt={i.title} className="w-full h-48 object-cover rounded-xl" />
                      )}
                      <Badge variant="secondary" className="capitalize">{i.category}</Badge>
                      <p className="text-xs text-muted-foreground"> 
                        Description: <span className="text-sm text-muted-foreground">{i.description}</span></p>
                      <p className="text-xs text-muted-foreground"> Location: {i.address ?? i.city}</p>
                      <p className="text-xs text-muted-foreground">
                        Status: <span className="font-medium capitalize">{i.status.replace("_", " ")}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Raised on {new Date(i.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </DialogContent>
                  </Dialog>
                ))
              }
            </div>
          </div>
        </div>

        <aside className="space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Bell className="w-4 h-4 text-primary" />
            <h3 className="font-display text-xl">Notifications</h3>
          </div>
          {[
            { t: "Volunteer assigned", d: "A volunteer picked up your issue.", c: "bg-pastel-green" },
            { t: "Issue resolved", d: "One of your issues has been fixed.", c: "bg-pastel-blue" },
            { t: "Update", d: "Your streetlight issue is awaiting a volunteer.", c: "bg-pastel-pink" },
          ].map((n, i) => (
            <Link to="/citizen/activity" key={i}>
              <Card className="p-4 soft-card border-0 hover:bg-muted/40 cursor-pointer">
                <div className="flex gap-3">
                  <div className={`w-2 h-2 rounded-full mt-2 ${n.c}`} />
                  <div>
                    <p className="text-sm font-medium">{n.t}</p>
                    <p className="text-xs text-muted-foreground">{n.d}</p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </aside>
      </div>
    </AppShell>
  );
}