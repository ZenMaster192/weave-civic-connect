import AppShell from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { ngoApi } from "@/services/api";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Issue } from "@/services/api";

export default function NgoActivity() {
  const { data: activity = [], isLoading } = useQuery({
    queryKey: ["ngo-activity"],
    queryFn: ngoApi.getMembersActivity
  });
  const [selected, setSelected] = useState<Issue | null>(null);

  return (
    <AppShell role="ngo">
      <h1 className="font-display text-4xl mb-2">NGO activity log</h1>
      <p className="text-muted-foreground mb-6">All issues handled by your members, with two-way feedback.</p>

      <div className="space-y-4">
        {isLoading ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />) : null}
        {activity.map(i => (
          <Card key={i.id} onClick={() => setSelected(i)} className="p-5 soft-card border-0 grid md:grid-cols-[100px_1fr_auto] gap-4 items-center cursor-pointer hover:shadow-md transition-shadow">
            <img src={i.image_url} alt="" className="w-full md:w-24 h-24 rounded-xl object-cover" />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-display text-lg">{i.title}</h3>
                <Badge variant="secondary" className="capitalize text-xs">{i.status.replace("_", " ")}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mb-2">{i.address || i.city} · raised by {i.reporter_name}</p>
              {i.resolver_name && <p className="text-sm">👷 {i.resolver_name}</p>}
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <p>Created {new Date(i.created_at).toLocaleDateString()}</p>
              {i.resolved_at && <p>Resolved {new Date(i.resolved_at).toLocaleDateString()}</p>}
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">{selected?.title}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className={`grid ${selected.proof_url ? "grid-cols-2" : "grid-cols-1"} gap-2 rounded-xl overflow-hidden max-h-64`}>
                <img src={selected.image_url} alt={selected.title} className="w-full h-full object-cover" />
                {selected.proof_url && <img src={selected.proof_url} alt="Proof" className="w-full h-full object-cover" />}
              </div>
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="capitalize">{selected.status.replace("_", " ")}</Badge>
                <p className="text-xs text-muted-foreground">Created {new Date(selected.created_at).toLocaleDateString()}</p>
              </div>
              <p className="text-sm text-muted-foreground">{selected.description}</p>
              <p className="text-sm">📍 {selected.address || selected.city}</p>
              <p className="text-sm text-muted-foreground">Raised by <span className="font-medium text-foreground">{selected.reporter_name}</span></p>
              {selected.resolver_name && (
                <p className="text-sm">👷 Resolved by <span className="font-medium">{selected.resolver_name}</span></p>
              )}
              {selected.resolved_at && (
                <p className="text-xs text-muted-foreground">Resolved on {new Date(selected.resolved_at).toLocaleDateString()}</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}