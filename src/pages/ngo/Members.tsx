import AppShell from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MOCK_NGO_MEMBERS } from "@/lib/mockData";
import { Trophy } from "lucide-react";

const TIER_BG: Record<string, string> = {
  Seed: "bg-pastel-green",
  Thread: "bg-pastel-blue",
  Weaver: "bg-accent-soft",
  Catalyst: "bg-pastel-pink",
  Luminary: "bg-gradient-accent",
};

export default function Members() {
  const sorted = [...MOCK_NGO_MEMBERS].sort((a, b) => b.xp - a.xp);
  return (
    <AppShell role="ngo">
      <h1 className="font-display text-4xl mb-2">Members</h1>
      <p className="text-muted-foreground mb-6">Sorted by XP. Click a card to assign work.</p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sorted.map((m, i) => (
          <Card key={m.name} className="p-6 soft-card border-0 relative overflow-hidden">
            {i === 0 && <div className="absolute top-3 right-3"><Trophy className="w-4 h-4 text-accent" /></div>}
            <div className={`w-14 h-14 rounded-2xl ${TIER_BG[m.tier]} flex items-center justify-center font-display font-bold text-lg mb-4`}>
              {m.avatar}
            </div>
            <h3 className="font-display text-xl">{m.name}</h3>
            <p className="text-xs text-muted-foreground mb-3">{m.role}</p>
            <div className="flex items-center gap-2 mb-4">
              <Badge variant="secondary" className="text-xs">{m.tier}</Badge>
              <span className="text-xs text-muted-foreground">{m.xp} XP</span>
            </div>
            <Button variant="outline" size="sm" className="w-full">Assign issue</Button>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
