import AppShell from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MOCK_LEADERBOARD, TIERS } from "@/lib/mockData";
import { Trophy, Star } from "lucide-react";

const TIER_COLORS: Record<string, string> = {
  Seed: "bg-pastel-green text-foreground",
  Thread: "bg-pastel-blue text-foreground",
  Weaver: "bg-accent-soft text-foreground",
  Catalyst: "bg-pastel-pink text-foreground",
  Luminary: "bg-gradient-accent text-foreground",
};

export default function Leaderboard() {
  return (
    <AppShell role="volunteer">
      <h1 className="font-display text-4xl mb-2">Global leaderboard</h1>
      <p className="text-muted-foreground mb-6">Ranked by Avg Rating × Total XP. Climb your tier.</p>

      <div className="grid md:grid-cols-5 gap-3 mb-8">
        {TIERS.map((t) => (
          <Card key={t} className="p-4 soft-card border-0 text-center">
            <Badge className={`${TIER_COLORS[t]} border-0 mb-2`}>{t}</Badge>
            <p className="text-xs text-muted-foreground">
              {t === "Seed" && "0–99 XP"}
              {t === "Thread" && "100–399 XP"}
              {t === "Weaver" && "400–999 XP"}
              {t === "Catalyst" && "1000–1999 XP"}
              {t === "Luminary" && "2000+ XP"}
            </p>
          </Card>
        ))}
      </div>

      <Card className="soft-card border-0 overflow-hidden">
        {MOCK_LEADERBOARD.map((u, i) => (
          <div key={u.name} className="flex items-center gap-4 p-4 border-b border-border/60 last:border-0 hover:bg-muted/30 transition-smooth">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-display font-bold ${
              i === 0 ? "bg-gradient-accent" : i === 1 ? "bg-secondary" : i === 2 ? "bg-pastel-pink" : "bg-muted"
            }`}>
              {i === 0 ? <Trophy className="w-5 h-5" /> : i + 1}
            </div>
            <div className="flex-1">
              <p className="font-medium">{u.name}</p>
              <p className="text-xs text-muted-foreground">{u.xp} XP</p>
            </div>
            <Badge className={`${TIER_COLORS[u.tier]} border-0`}>{u.tier}</Badge>
            <div className="flex items-center gap-1 text-sm">
              <Star className="w-4 h-4 fill-accent text-accent" /> {u.rating}
            </div>
          </div>
        ))}
      </Card>
    </AppShell>
  );
}
