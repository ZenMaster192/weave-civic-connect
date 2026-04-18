import AppShell from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MOCK_ISSUES } from "@/lib/mockData";
import { Star } from "lucide-react";

export default function NgoActivity() {
  return (
    <AppShell role="ngo">
      <h1 className="font-display text-4xl mb-2">NGO activity log</h1>
      <p className="text-muted-foreground mb-6">All issues handled by your members, with two-way feedback.</p>

      <div className="space-y-4">
        {MOCK_ISSUES.map(i => (
          <Card key={i.id} className="p-5 soft-card border-0 grid md:grid-cols-[100px_1fr_auto] gap-4 items-center">
            <img src={i.beforeImage} alt="" className="w-full md:w-24 h-24 rounded-xl object-cover" />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-display text-lg">{i.title}</h3>
                <Badge variant="secondary" className="capitalize text-xs">{i.status.replace("_", " ")}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mb-2">{i.location} · raised by {i.citizen}</p>
              {i.volunteer && <p className="text-sm">👷 {i.volunteer}</p>}
              {i.rating && (
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">Citizen → <Star className="w-3 h-3 fill-accent text-accent" />{i.rating}</span>
                  <span className="flex items-center gap-1">Volunteer → <Star className="w-3 h-3 fill-accent text-accent" />4.8</span>
                </div>
              )}
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <p>Created {new Date(i.createdAt).toLocaleDateString()}</p>
              {i.resolvedAt && <p>Resolved {new Date(i.resolvedAt).toLocaleDateString()}</p>}
            </div>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
