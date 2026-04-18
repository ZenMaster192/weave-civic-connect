import AppShell from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MOCK_ISSUES, MOCK_LEADERBOARD, getSession } from "@/lib/mockData";
import { Trophy, Zap, Star, MapPin, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export default function VolunteerDashboard() {
  const session = getSession();
  const matched = MOCK_ISSUES.filter(i => i.status !== "resolved").slice(0, 3);
  const active = MOCK_ISSUES.find(i => i.status === "in_progress" && i.volunteer === session?.name) || MOCK_ISSUES[0];

  return (
    <AppShell role="volunteer">
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-8 bg-gradient-volunteer border-0 shadow-card relative overflow-hidden">
            <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-card text-xs font-semibold flex items-center gap-1">
              <Zap className="w-3 h-3 text-accent" /> {session?.xp || 1240} XP · {session?.tier || "Catalyst"}
            </div>
            <p className="text-sm uppercase tracking-widest text-primary/70 mb-2">Active issue</p>
            <h2 className="font-display text-3xl mb-2">{active.title}</h2>
            <p className="text-foreground/75 mb-4">📍 {active.location}</p>
            <div className="flex gap-2">
              <Link to="/volunteer/discover"><Button>Open & resolve <ArrowRight className="w-4 h-4 ml-1" /></Button></Link>
              <Button variant="outline">Reassign</Button>
            </div>
          </Card>

          <div className="grid grid-cols-3 gap-4">
            {[
              { l: "Resolved", v: 23, i: Star, t: "bg-pastel-green" },
              { l: "Active", v: 2, i: Zap, t: "bg-accent-soft" },
              { l: "Avg rating", v: "4.7", i: Trophy, t: "bg-pastel-pink" },
            ].map(s => {
              const Icon = s.i;
              return (
                <Card key={s.l} className="p-5 soft-card border-0">
                  <div className={`w-10 h-10 rounded-xl ${s.t} flex items-center justify-center mb-3`}>
                    <Icon className="w-5 h-5 text-foreground/70" />
                  </div>
                  <p className="text-3xl font-display font-semibold">{s.v}</p>
                  <p className="text-sm text-muted-foreground">{s.l}</p>
                </Card>
              );
            })}
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-xl">Matched for you</h3>
              <Link to="/volunteer/discover" className="text-sm text-primary hover:underline">Browse map →</Link>
            </div>
            <div className="space-y-3">
              {matched.map(i => (
                <Card key={i.id} className="p-4 flex gap-4 items-center soft-card border-0">
                  <img src={i.beforeImage} alt="" className="w-16 h-16 rounded-xl object-cover" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{i.title}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" />{i.location}</p>
                  </div>
                  <Badge variant="secondary">{i.category}</Badge>
                  <Button size="sm" variant="outline">Accept</Button>
                </Card>
              ))}
            </div>
          </div>
        </div>

        <aside className="space-y-3">
          <h3 className="font-display text-xl mb-1">Your standing</h3>
          <Card className="p-5 soft-card border-0">
            {MOCK_LEADERBOARD.slice(0, 5).map((u, i) => (
              <div key={u.name} className="flex items-center gap-3 py-2 border-b border-border/60 last:border-0">
                <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-xs font-bold">{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{u.name}</p>
                  <p className="text-xs text-muted-foreground">{u.tier} · {u.xp} XP · ⭐ {u.rating}</p>
                </div>
              </div>
            ))}
          </Card>
        </aside>
      </div>
    </AppShell>
  );
}
