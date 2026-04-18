import AppShell from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X } from "lucide-react";

const REQUESTS = [
  { name: "Anish Reddy", skills: ["Plumbing", "Construction"], xp: 0, distance: "1.2 km" },
  { name: "Meera Iyer", skills: ["Teaching", "Community Outreach"], xp: 220, distance: "3.4 km" },
  { name: "Vikram Joshi", skills: ["Electrical", "IT Support"], xp: 540, distance: "0.8 km" },
];

export default function Approvals() {
  return (
    <AppShell role="ngo">
      <h1 className="font-display text-4xl mb-2">Volunteer approvals</h1>
      <p className="text-muted-foreground mb-6">Independent volunteers requesting affiliation with your NGO.</p>

      <div className="space-y-4">
        {REQUESTS.map(r => (
          <Card key={r.name} className="p-5 soft-card border-0 flex flex-wrap items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-accent flex items-center justify-center font-display font-bold">
              {r.name.split(" ").map(n => n[0]).join("")}
            </div>
            <div className="flex-1 min-w-[200px]">
              <h3 className="font-display text-lg">{r.name}</h3>
              <p className="text-xs text-muted-foreground">{r.distance} away · {r.xp} XP</p>
              <div className="flex gap-1 mt-2 flex-wrap">
                {r.skills.map(s => <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>)}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-1"><X className="w-4 h-4" /> Decline</Button>
              <Button size="sm" className="gap-1"><Check className="w-4 h-4" /> Approve</Button>
            </div>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
