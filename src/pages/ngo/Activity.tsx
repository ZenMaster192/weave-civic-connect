import AppShell from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { ngoApi } from "@/services/api";
import { Skeleton } from "@/components/ui/skeleton";

export default function NgoActivity() {
  const { data: activity = [], isLoading } = useQuery({
    queryKey: ["ngo-activity"],
    queryFn: ngoApi.getMembersActivity
  });

  return (
    <AppShell role="ngo">
      <h1 className="font-display text-4xl mb-2">NGO activity log</h1>
      <p className="text-muted-foreground mb-6">All issues handled by your members, with two-way feedback.</p>

      <div className="space-y-4">
        {isLoading ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />) : null}
        {activity.map(i => (
          <Card key={i.id} className="p-5 soft-card border-0 grid md:grid-cols-[100px_1fr_auto] gap-4 items-center">
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
    </AppShell>
  );
}
