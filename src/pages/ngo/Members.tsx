import AppShell from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ngoApi } from "@/services/api";
import { useQuery } from "@tanstack/react-query";
import { MOCK_NGO_MEMBERS } from "@/lib/mockData";
import { Trophy } from "lucide-react";

const TIER_BG: Record<string, string> = {
  Seed: "bg-pastel-green",
  Thread: "bg-pastel-blue",
  Weaver: "bg-accent-soft",
  Catalyst: "bg-pastel-pink",
  Luminary: "bg-gradient-accent",
};
import { useState } from "react";

export default function Members() {
  const { data: members = [], isLoading } = useQuery({
    queryKey: ["ngo-members"],
    queryFn: () => ngoApi.getMembers() 
  });

  if (isLoading) return <div className="p-10 text-center">Loading team...</div>;

  return (
    <AppShell role="ngo">
      <h1 className="font-display text-4xl mb-2">Members</h1>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {members.map((m, i) => (
          <Card key={i} className="p-6 soft-card border-0">
             <div className="w-14 h-14 rounded-2xl bg-pastel-blue flex items-center justify-center font-bold text-lg mb-4">
              {m.volunteer_name[0]}
            </div>
            <h3 className="font-display text-xl">{m.volunteer_name}</h3>
            <p className="text-xs text-muted-foreground mb-3">Field Volunteer</p>
            <Badge variant="secondary" className="text-xs mb-4">
              {m.total_resolved} Resolved
            </Badge>
            <Button variant="outline" size="sm" className="w-full">Assign issue</Button>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}