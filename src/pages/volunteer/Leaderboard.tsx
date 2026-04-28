import AppShell from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Star } from "lucide-react";
import { systemApi } from "@/services/api";
import { useQuery } from "@tanstack/react-query";

const TIER_COLORS: Record<string, string> = {
  Seed: "bg-pastel-green text-foreground",
  Thread: "bg-pastel-blue text-foreground",
  Weaver: "bg-accent-soft text-foreground",
  Catalyst: "bg-pastel-pink text-foreground",
  Luminary: "bg-gradient-accent text-foreground",
};

export default function Leaderboard() {
  const { data: leaderboard = [], isLoading } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: systemApi.getLeaderboard
  });

  if (isLoading) return <div className="p-10 text-center">Calculating ranks...</div>;

  return (
    <AppShell role="volunteer">
      <h1 className="font-display text-4xl mb-2">Global leaderboard</h1>
      {/* ... keep TIERS section ... */}
      <Card className="soft-card border-0 overflow-hidden">
        {leaderboard.map((u, i) => (
          <div key={i} className="flex items-center gap-4 p-4 border-b border-border/60 last:border-0 hover:bg-muted/30">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-display font-bold bg-muted">
              {i + 1}
            </div>
            <div className="flex-1">
              <p className="font-medium">{u.name}</p>
              <p className="text-xs text-muted-foreground">{u.xp} XP</p>
            </div>
            <Badge className="bg-pastel-blue border-0">{u.tier}</Badge>
            <div className="flex items-center gap-1 text-sm font-bold">
              <Star className="w-4 h-4 fill-accent text-accent" /> {u.rating.toFixed(1)}
            </div>
          </div>
        ))}
      </Card>
    </AppShell>
  );
}