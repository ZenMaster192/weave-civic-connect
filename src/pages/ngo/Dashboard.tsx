import AppShell from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Building2, Users, AlertCircle, CheckCircle2, ArrowRight, Bell, Star, Trophy, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ngoApi, usersApi, type Issue, type NGOMemberStats } from "@/services/api";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useState } from "react";

export default function NgoDashboard() {
  const queryClient = useQueryClient();
  const [assignIssue, setAssignIssue] = useState<Issue | null>(null);
  const [selectedVolunteerForAssign, setSelectedVolunteerForAssign] = useState<number | null>(null);

  const { data: me } = useQuery({ queryKey: ["users", "me"], queryFn: usersApi.me });
  const city = me?.city || undefined;

  const { data: statsData } = useQuery({
      queryKey: ["ngo", "stats"],
      queryFn: ngoApi.getStats,
  });

  const { data: members = [] } = useQuery({
      queryKey: ["ngo", "members", city],
      queryFn: () => ngoApi.getMembers(city),
  });

  const { data: unassigned = [], isLoading: unassignedLoading } = useQuery({
      queryKey: ["ngo", "unassigned", city],
      queryFn: () => ngoApi.getUnassigned(city),
  });

  const { data: requests = [] } = useQuery({
      queryKey: ["ngo", "requests"],
      queryFn: ngoApi.getRequests,
  });

  const { data: discovery = [], isLoading: discoveryLoading } = useQuery({
      queryKey: ["ngo", "discover", city],
      queryFn: () => ngoApi.discoverVolunteers(city),
  });

  const forceAssignMutation = useMutation({
      mutationFn: ({ issueId, volunteerId }: { issueId: number, volunteerId: number }) => 
          ngoApi.forceAssignMember(issueId, volunteerId),
      onSuccess: () => {
          toast.success("Issue forcefully assigned!");
          setAssignIssue(null);
          setSelectedVolunteerForAssign(null);
          queryClient.invalidateQueries({ queryKey: ["ngo", "unassigned"] });
      },
      onError: (e: Error) => toast.error(e.message)
  });

  const inviteMutation = useMutation({
      mutationFn: ngoApi.inviteVolunteer,
      onSuccess: () => {
          toast.success("Invitation sent!");
      },
      onError: (e: Error) => toast.error(e.message)
  });

  const stats = [
    { l: "Resolved today", v: statsData?.resolved || 0, i: CheckCircle2, t: "bg-pastel-green" },
    { l: "Ongoing", v: statsData?.in_progress || 0, i: AlertCircle, t: "bg-pastel-pink" },
    { l: "Members", v: members.length, i: Users, t: "bg-pastel-blue" },
    { l: "Pending requests", v: requests.length, i: Building2, t: "bg-accent-soft" },
  ];

  return (
    <AppShell role="ngo">
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-8 bg-gradient-ngo border-0 shadow-card">
            <p className="text-sm uppercase tracking-widest text-primary/70 mb-2">Today at a glance</p>
            <h2 className="font-display text-4xl mb-3">Your team is <span className="text-primary">on the ground.</span></h2>
            <p className="text-foreground/75 max-w-md mb-6">Approve volunteers, assign issues, and watch impact unfold.</p>
            <div className="flex gap-3">
              <Link to="/ngo/approvals"><Button>Review approvals <ArrowRight className="w-4 h-4 ml-1" /></Button></Link>
              <Link to="/ngo/members"><Button variant="outline">Manage team</Button></Link>
            </div>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map(s => {
              const Icon = s.i;
              return (
                <Card key={s.l} className="p-5 soft-card border-0">
                  <div className={`w-10 h-10 rounded-xl ${s.t} flex items-center justify-center mb-3`}>
                    <Icon className="w-5 h-5 text-foreground/70" />
                  </div>
                  <p className="text-3xl font-display font-semibold">{s.v}</p>
                  <p className="text-xs text-muted-foreground">{s.l}</p>
                </Card>
              );
            })}
          </div>

          <div>
            <h3 className="font-display text-xl mb-3 mt-8">Unassigned nearby issues</h3>
            <div className="space-y-3">
              {unassignedLoading ? (
                  Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
              ) : unassigned.length === 0 ? (
                  <p className="text-muted-foreground">No unassigned issues in your area.</p>
              ) : unassigned.map(i => (
                <Card key={i.id} onClick={() => setAssignIssue(i)} className="p-4 flex gap-4 items-center soft-card border-0 cursor-pointer hover:shadow-lg transition-shadow">
                    {i.image_url ? (
                      <img src={i.image_url} alt="" className="w-16 h-16 rounded-xl object-cover" />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-secondary flex items-center justify-center">
                          <AlertCircle className="text-muted-foreground w-6 h-6" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{i.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{i.address || i.city}</p>
                    </div>
                    <Badge variant="secondary">{i.category}</Badge>
                    <Button size="sm">Assign</Button>
                </Card>
              ))}
            </div>
            
            <Dialog open={!!assignIssue} onOpenChange={(o) => { if (!o) setAssignIssue(null) }}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle className="font-display text-2xl">{assignIssue?.title}</DialogTitle>
                    </DialogHeader>
                    {assignIssue && (
                        <div className="space-y-4 text-sm mt-4">
                            {assignIssue.image_url && <img src={assignIssue.image_url} alt={assignIssue.title} className="w-full h-48 object-cover rounded-xl" />}
                            <div className="flex justify-between items-center">
                                <Badge variant="secondary" className="capitalize">{assignIssue.category}</Badge>
                                <p className="text-xs text-muted-foreground">📍 {assignIssue.address || assignIssue.city}</p>
                            </div>
                            <p className="text-muted-foreground">{assignIssue.description}</p>
                            
                            <div className="border-t border-border pt-4">
                                <h4 className="font-medium mb-3">Force Assign to Member</h4>
                                {members.length === 0 ? (
                                    <p className="text-muted-foreground">You have no active members.</p>
                                ) : (
                                    <div className="space-y-2">
                                        <select 
                                            className="w-full p-2 rounded-md border border-border bg-background"
                                            value={selectedVolunteerForAssign || ""}
                                            onChange={(e) => setSelectedVolunteerForAssign(Number(e.target.value))}
                                        >
                                            <option value="">Select a member...</option>
                                            {members.map(m => (
                                                <option key={m.volunteer_id} value={m.volunteer_id}>
                                                    {m.volunteer_name} ({m.total_resolved} resolved)
                                                </option>
                                            ))}
                                        </select>
                                        <Button 
                                            className="w-full"
                                            disabled={!selectedVolunteerForAssign || forceAssignMutation.isPending}
                                            onClick={() => forceAssignMutation.mutate({ issueId: assignIssue.id, volunteerId: selectedVolunteerForAssign! })}
                                        >
                                            {forceAssignMutation.isPending ? "Assigning..." : "Force Assign"}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="bg-card rounded-xl p-5 border border-border/40 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Search className="w-5 h-5 text-primary" />
              <h3 className="font-display text-xl">Discover Volunteers</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-4">Top-performing independent volunteers nearby</p>
            
            <div className="space-y-3">
                {discoveryLoading ? (
                     Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)
                ) : discovery.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No independent volunteers found nearby.</p>
                ) : discovery.map(v => (
                    <div key={v.volunteer_id} className="flex flex-col gap-2 p-3 bg-secondary/50 rounded-lg">
                        <div className="flex justify-between items-start">
                            <p className="font-medium text-sm">{v.volunteer_name}</p>
                            <Badge className="bg-pastel-pink text-foreground border-0 text-[10px]"><Star className="w-3 h-3 inline mr-1 fill-accent text-accent"/>{v.impact_score.toFixed(1)}</Badge>
                        </div>
                        <div className="flex justify-between items-center">
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Trophy className="w-3 h-3" /> {v.total_resolved} resolved
                            </p>
                            <Button 
                                size="sm" 
                                variant="outline" 
                                className="h-7 text-xs px-2"
                                onClick={() => inviteMutation.mutate(v.volunteer_id)}
                                disabled={inviteMutation.isPending}
                            >
                                Pitch invite
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
