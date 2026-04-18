import AppShell from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { useState } from "react";
import { CheckCircle2, Upload, Star } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { matchApi, issuesApi, type VolunteerMatch } from "@/services/api";
import { Skeleton } from "@/components/ui/skeleton";

// Fix Leaflet default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export default function Discover() {
  const queryClient = useQueryClient();
  const [selectedMatch, setSelectedMatch] = useState<VolunteerMatch | null>(null);
  const [resolving, setResolving] = useState(false);
  const [rating, setRating] = useState(5);
  const [proofFile, setProofFile] = useState<File | null>(null);

  const { data: matches = [], isLoading } = useQuery<VolunteerMatch[]>({
    queryKey: ["match", "nearby"],
    queryFn: () => matchApi.getNearbyIssues(25, 20),
  });

  const selected = selectedMatch ?? matches[0] ?? null;

  const resolveMutation = useMutation({
    mutationFn: (issueId: number) => issuesApi.resolve(issueId, proofFile ?? undefined),
    onSuccess: () => {
      toast.success("Issue marked resolved · +50 XP");
      setResolving(false);
      setProofFile(null);
      queryClient.invalidateQueries({ queryKey: ["match", "nearby"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mapCenter: [number, number] = selected
    ? [selected.issue.latitude, selected.issue.longitude]
    : [18.52, 73.86];

  return (
    <AppShell role="volunteer">
      <h1 className="font-display text-4xl mb-2">Discover</h1>
      <p className="text-muted-foreground mb-6">Map of nearby issues matched to your skills.</p>

      <div className="grid lg:grid-cols-[1fr_400px] gap-6">
        <Card className="overflow-hidden soft-card border-0 h-[600px]">
          {isLoading ? (
            <Skeleton className="h-full w-full rounded-none" />
          ) : (
            <MapContainer center={mapCenter} zoom={12} className="h-full w-full">
              <TileLayer
                attribution='&copy; OpenStreetMap'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {matches.map(m => (
                <Marker
                  key={m.issue.id}
                  position={[m.issue.latitude, m.issue.longitude]}
                  eventHandlers={{ click: () => { setSelectedMatch(m); setResolving(false); } }}
                >
                  <Popup>
                    <b>{m.issue.title}</b><br />{m.issue.category}<br />
                    {m.distance_km} km · score {m.skill_match_score}
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          )}
        </Card>

        <div className="space-y-4">
          {isLoading ? (
            <Skeleton className="h-96 rounded-xl" />
          ) : !selected ? (
            <Card className="p-8 soft-card border-0 text-center text-muted-foreground">
              No nearby issues found. Update your location in profile settings.
            </Card>
          ) : (
            <Card className="overflow-hidden soft-card border-0">
              {selected.issue.image_url
                ? <img src={selected.issue.image_url} alt="" className="w-full h-48 object-cover" />
                : <div className="w-full h-48 bg-muted flex items-center justify-center text-muted-foreground">{selected.issue.category}</div>
              }
              <div className="p-5">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-display text-xl">{selected.issue.title}</h3>
                  <Badge variant="secondary">{selected.issue.category}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-1">
                  📍 {selected.issue.address || selected.issue.city} · {selected.distance_km} km
                </p>
                <p className="text-sm text-muted-foreground mb-4">{selected.issue.description}</p>

                {selected.issue.required_skills && (
                  <div className="flex flex-wrap gap-1 mb-4">
                    {selected.issue.required_skills.split(",").map(k => (
                      <Badge key={k} variant="outline" className="text-xs">#{k.trim()}</Badge>
                    ))}
                  </div>
                )}

                {!resolving ? (
                  <Button className="w-full gap-2" onClick={() => setResolving(true)}>
                    <CheckCircle2 className="w-4 h-4" /> Begin resolution
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <label className="border-2 border-dashed border-border rounded-xl p-5 text-center text-sm text-muted-foreground hover:bg-muted/40 transition-smooth cursor-pointer block">
                      <Upload className="w-5 h-5 mx-auto mb-1" />
                      {proofFile ? proofFile.name : "Upload after photo"}
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => setProofFile(e.target.files?.[0] ?? null)} />
                    </label>
                    <Textarea placeholder="Resolution notes..." rows={2} />
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Rate the citizen</p>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map(n => (
                          <button key={n} onClick={() => setRating(n)}>
                            <Star className={`w-5 h-5 ${n <= rating ? "fill-accent text-accent" : "text-muted-foreground"}`} />
                          </button>
                        ))}
                      </div>
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => resolveMutation.mutate(selected.issue.id)}
                      disabled={resolveMutation.isPending}
                    >
                      {resolveMutation.isPending ? "Submitting…" : "Mark as resolved"}
                    </Button>
                    <Button className="w-full" variant="ghost" onClick={() => setResolving(false)}>Cancel</Button>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}