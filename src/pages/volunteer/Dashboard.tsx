import AppShell from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MOCK_LEADERBOARD } from "@/lib/mockData";
import { Trophy, Zap, Star, MapPin, ArrowRight, Clock, Map, Check } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { dispatchApi, usersApi, matchApi } from "@/services/api";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export default function VolunteerDashboard() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [activeDispatchId, setActiveDispatchId] = useState<number | null>(null);

  const { data: me } = useQuery({
    queryKey: ["users", "me"],
    queryFn: usersApi.me,
  });

  const { data: activeIssue, isLoading: activeLoading } = useQuery({
    queryKey: ["volunteer", "active-issue"],
    queryFn: dispatchApi.getActiveIssue,
  });

  const { data: pendingDispatches = [] } = useQuery({
    queryKey: ["volunteer", "pending-dispatches"],
    queryFn: dispatchApi.getPending,
    refetchInterval: 5000, // Short poll for Uber-ping
  });

  const { data: matched = [] } = useQuery({
    queryKey: ["match", "nearby"],
    queryFn: () => matchApi.getNearbyIssues(25, 3),
  });

  const acceptMutation = useMutation({
    mutationFn: dispatchApi.accept,
    onSuccess: () => {
      toast.success("Issue accepted! It's now yours to resolve.");
      queryClient.invalidateQueries({ queryKey: ["volunteer"] });
      setActiveDispatchId(null);
    },
    onError: (e: Error) => {
      toast.error(e.message || "Failed to accept issue. Someone else might have grabbed it.");
      queryClient.invalidateQueries({ queryKey: ["volunteer"] });
      setActiveDispatchId(null);
    }
  });

  // Check if we need to show a ping
  const activePing = pendingDispatches.find(d => d.id === activeDispatchId) || pendingDispatches[0];

  useEffect(() => {
    if (pendingDispatches.length > 0 && !activeDispatchId && !activeIssue) {
        // Only ping if they don't already have an active issue
        setActiveDispatchId(pendingDispatches[0].id);
    } else if (pendingDispatches.length === 0) {
        setActiveDispatchId(null);
    }
  }, [pendingDispatches, activeDispatchId, activeIssue]);

  return (
    <AppShell role="volunteer">
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-8 bg-gradient-volunteer border-0 shadow-card relative overflow-hidden min-h-[220px]">
            <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-card text-xs font-semibold flex items-center gap-1">
              <Zap className="w-3 h-3 text-accent" /> {me?.total_resolved ? me.total_resolved * 50 : 0} XP
            </div>
            <p className="text-sm uppercase tracking-widest text-primary/70 mb-2">Active issue</p>
            {activeLoading ? (
              <div className="space-y-3 mt-4">
                <Skeleton className="h-8 w-2/3" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            ) : activeIssue ? (
              <>
                <h2 className="font-display text-3xl mb-2">{activeIssue.title}</h2>
                <p className="text-foreground/75 mb-4">📍 {activeIssue.address || activeIssue.city || "Location not specified"}</p>
                <div className="flex gap-2 mt-auto">
                  <Link to="/volunteer/discover"><Button>Open & resolve <ArrowRight className="w-4 h-4 ml-1" /></Button></Link>
                </div>
              </>
            ) : (
              <>
                <h2 className="font-display text-2xl mb-2 text-foreground/50">No active issues.</h2>
                <p className="text-foreground/75 mb-4">You're on standby. We'll ping you when your skills are needed nearby.</p>
                <div className="flex gap-2 mt-auto">
                  <Link to="/volunteer/discover"><Button variant="outline"><Map className="w-4 h-4 mr-2" />Browse map</Button></Link>
                </div>
              </>
            )}
          </Card>

          <div className="grid grid-cols-3 gap-4">
            {[
              { l: "Resolved", v: me?.total_resolved || 0, i: Star, t: "bg-pastel-green" },
              { l: "Active", v: activeIssue ? 1 : 0, i: Zap, t: "bg-accent-soft" },
              { l: "Impact Score", v: me?.total_resolved ? "4.8" : "New", i: Trophy, t: "bg-pastel-pink" }, // Mock rating for now as we didn't add it to user profile fetch properly
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
              {matched.length === 0 && <p className="text-sm text-muted-foreground">No matches found nearby.</p>}
              {matched.map(m => (
                <Card key={m.issue.id} className="p-4 flex gap-4 items-center soft-card border-0">
                  {m.issue.image_url ? (
                    <img src={m.issue.image_url} alt="" className="w-16 h-16 rounded-xl object-cover" />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-secondary flex items-center justify-center">
                        <MapPin className="text-muted-foreground w-6 h-6" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{m.issue.title}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" />{m.issue.city || "Nearby"}</p>
                  </div>
                  <Badge variant="secondary">{m.issue.category}</Badge>
                  <Button size="sm" variant="outline" onClick={() => navigate('/volunteer/discover')}>View</Button>
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

      {/* Uber-style Dispatch Ping Modal */}
      <Dialog open={!!activePing && !activeIssue} onOpenChange={(open) => {
          if (!open && activePing) {
              // User closed modal without accepting/declining. Treat as ignore for now (will auto expire)
              setActiveDispatchId(null);
          }
      }}>
        <DialogContent className="sm:max-w-md border-0 bg-gradient-volunteer text-foreground shadow-2xl">
          <DialogHeader>
            <div className="mx-auto w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center mb-4 animate-pulse">
                <Zap className="w-6 h-6 text-accent" />
            </div>
            <DialogTitle className="text-center font-display text-2xl">New Issue Matched!</DialogTitle>
            <DialogDescription className="text-center text-foreground/80">
              Your skills are a perfect match for a nearby issue.
            </DialogDescription>
          </DialogHeader>
          
          {activePing && (
              <div className="bg-card/40 rounded-xl p-4 mt-4 backdrop-blur-sm border border-border/40">
                  <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-lg">{activePing.issue.title}</h3>
                      <Badge className="bg-accent text-accent-foreground border-0">{Math.round(activePing.score * 100)}% Match</Badge>
                  </div>
                  <div className="space-y-2 text-sm text-foreground/80">
                      <p className="flex items-center gap-2"><MapPin className="w-4 h-4" /> {activePing.issue.address || activePing.issue.city}</p>
                      <p className="flex items-center gap-2"><Clock className="w-4 h-4" /> Expires quickly (race condition)</p>
                  </div>
              </div>
          )}

          <div className="flex gap-3 mt-6">
            <Button 
                variant="outline" 
                className="flex-1 bg-background/50 border-border/50 hover:bg-background/80"
                onClick={() => setActiveDispatchId(null)}
            >
                Ignore
            </Button>
            <Button 
                className="flex-1 bg-foreground text-background hover:bg-foreground/90 gap-2"
                onClick={() => activePing && acceptMutation.mutate(activePing.id)}
                disabled={acceptMutation.isPending}
            >
                {acceptMutation.isPending ? "Accepting..." : <><Check className="w-4 h-4" /> Accept Job</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
