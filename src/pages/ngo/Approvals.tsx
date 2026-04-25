import { useState } from "react";
import AppShell from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Phone, MapPin, Zap } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ngoApi } from "@/services/api";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

type Volunteer = {
  name: string;
  skills: string[];
  xp: number;
  distance: string;
  phone: string;
  city: string;
  avatar: string;
};

export default function Approvals() {
  const queryClient = useQueryClient();
  const [selectedReqId, setSelectedReqId] = useState<number | null>(null);

  const { data: requests = [], isLoading } = useQuery({
      queryKey: ["ngo", "requests"],
      queryFn: ngoApi.getRequests,
  });

  const pending = requests.filter(r => r.status === "PENDING" && r.initiated_by === "VOLUNTEER");

  const approveMutation = useMutation({
      mutationFn: ngoApi.approveRequest,
      onSuccess: () => {
          toast.success("Volunteer approved and added to team.");
          setSelectedReqId(null);
          queryClient.invalidateQueries({ queryKey: ["ngo"] });
      },
      onError: (e: Error) => toast.error(e.message)
  });

  // Since we don't have a decline API yet, we'll just mock it and hide it locally for demo purposes, 
  // or you could add a reject endpoint. Let's just mock hiding it for now.
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(new Set());

  const visiblePending = pending.filter(r => !hiddenIds.has(r.id));

  return (
    <AppShell role="ngo">
      <h1 className="font-display text-4xl mb-2">Volunteer approvals</h1>
      <p className="text-muted-foreground mb-6">
        Independent volunteers requesting affiliation · {visiblePending.length} pending
      </p>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
           {Array.from({length: 3}).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : visiblePending.length === 0 ? (
        <Card className="p-10 soft-card border-0 text-center text-muted-foreground">
          <Check className="w-8 h-8 mx-auto mb-3 text-primary/40" />
          <p className="font-medium">All caught up — no pending requests.</p>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visiblePending.map(req => {
            const initials = req.volunteer_name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase();
            
            return (
            <Dialog key={req.id} open={selectedReqId === req.id} onOpenChange={open => setSelectedReqId(open ? req.id : null)}>
              <DialogTrigger asChild>
                <Card className="p-5 soft-card border-0 cursor-pointer hover:shadow-lg transition-shadow">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-accent flex items-center justify-center font-display font-bold text-sm">
                      {initials}
                    </div>
                    <div>
                      <h3 className="font-display text-lg leading-tight">{req.volunteer_name}</h3>
                      <p className="text-xs text-muted-foreground">Applied {new Date(req.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button
                      variant="outline" size="sm" className="flex-1 gap-1"
                      onClick={e => { e.stopPropagation(); setHiddenIds(prev => new Set([...prev, req.id])); setSelectedReqId(null); }}
                    >
                      <X className="w-3.5 h-3.5" /> Decline
                    </Button>
                    <Button
                      size="sm" className="flex-1 gap-1"
                      disabled={approveMutation.isPending}
                      onClick={e => { e.stopPropagation(); approveMutation.mutate(req.id); }}
                    >
                      <Check className="w-3.5 h-3.5" /> Approve
                    </Button>
                  </div>
                </Card>
              </DialogTrigger>

              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="font-display text-2xl">{req.volunteer_name}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-accent flex items-center justify-center font-display font-bold text-xl">
                    {initials}
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Zap className="w-4 h-4" /> Requested to join your NGO
                    </div>
                  </div>
                  
                  <div className="flex gap-3 pt-2">
                    <Button variant="outline" className="flex-1 gap-1" onClick={() => {setHiddenIds(prev => new Set([...prev, req.id])); setSelectedReqId(null)}}>
                      <X className="w-4 h-4" /> Decline
                    </Button>
                    <Button className="flex-1 gap-1" disabled={approveMutation.isPending} onClick={() => approveMutation.mutate(req.id)}>
                      <Check className="w-4 h-4" /> Approve & add to team
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}