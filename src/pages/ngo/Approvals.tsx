import { useState } from "react";
import AppShell from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Phone, MapPin, Zap, Clock, History } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ngoApi } from "@/services/api";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";

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
  const [selectedReqId, setSelectedReqId] = useState<number | null>(null);
  const [pending, setPending] = useState(() => JSON.parse(localStorage.getItem("weave_pending") || '[]'));
  const [history, setHistory] = useState(() => JSON.parse(localStorage.getItem("weave_history") || '[]'));

  useEffect(() => {
    if (localStorage.getItem("weave_pending") === null) {
      const initial = [
        { id: 101, volunteer_name: "Arjun Patil", created_at: new Date().toISOString(), skills: "First Aid, Sanitation", phone: "+91 98765 43210", city: "Bhubaneswar", bio: "Engineering student eager to help." },
        { id: 102, volunteer_name: "Sneha Reddi", created_at: new Date().toISOString(), skills: "Teaching, Outreach", phone: "+91 87654 32109", city: "Cuttack", bio: "Social worker with 2 years experience." },
        { id: 103, volunteer_name: "Vikram Das", created_at: new Date().toISOString(), skills: "Road Repair, Construction", phone: "+91 76543 21098", city: "Puri", bio: "Retired contractor looking to give back." }
      ];
      setPending(initial);
      localStorage.setItem("weave_pending", JSON.stringify(initial));
    }
  }, []);

  const updateStorage = (newPending: any[], newHistory: any[]) => {
    setPending(newPending);
    setHistory(newHistory);
    localStorage.setItem("weave_pending", JSON.stringify(newPending));
    localStorage.setItem("weave_history", JSON.stringify(newHistory));
  };

  const handleApprove = (id: number, name: string) => {
    const item = pending.find((p: any) => p.id === id);
    const newHistory = [{ ...item, status: 'Approved', actionDate: new Date().toISOString() }, ...history];
    updateStorage(pending.filter((p: any) => p.id !== id), newHistory);
    toast.success(`Volunteer approved: ${name}`, { position: "bottom-right" });
    setSelectedReqId(null);
  };

  const handleDecline = (id: number) => {
    const item = pending.find((p: any) => p.id === id);
    const newHistory = [{ ...item, status: 'Rejected', actionDate: new Date().toISOString() }, ...history];
    updateStorage(pending.filter((p: any) => p.id !== id), newHistory);
    toast.error("Volunteer rejected", { position: "bottom-right" });
    setSelectedReqId(null);
  };

  return (
    <AppShell role="ngo">
      <h1 className="font-display text-4xl mb-2">Volunteer approvals</h1>
      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="pending" className="gap-2"><Clock className="w-4 h-4" /> Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="history" className="gap-2"><History className="w-4 h-4" /> Past Decisions ({history.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          {pending.length === 0 ? (
        <Card className="p-10 soft-card border-0 text-center text-muted-foreground">
          <Check className="w-8 h-8 mx-auto mb-3 text-primary/40" />
          <p className="font-medium">All caught up — no pending requests.</p>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {pending.map(req => {
            const initials = req.volunteer_name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase();
            return (
            <Dialog key={req.id} open={selectedReqId === req.id} onOpenChange={open => setSelectedReqId(open ? req.id : null)}>
              <DialogTrigger asChild>
                <Card className="p-5 soft-card border-0 cursor-pointer hover:shadow-lg transition-shadow">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-accent flex items-center justify-center font-display font-bold text-sm shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display text-lg leading-tight truncate">{req.volunteer_name}</h3>
                      <p className="text-xs text-muted-foreground truncate">{req.city}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); handleDecline(req.id); }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8 text-primary hover:bg-primary/10 hover:text-primary"
                        onClick={(e) => { e.stopPropagation(); handleApprove(req.id, req.volunteer_name); }}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              </DialogTrigger>

              <DialogContent className="max-w-md p-6">
                <DialogHeader className="mb-4">
                  <DialogTitle className="font-display text-2xl">{req.volunteer_name}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="w-4 h-4" /> {req.city}</div>
                    <div className="flex items-center gap-2 text-muted-foreground"><Phone className="w-4 h-4" /> {req.phone}</div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Skills</Label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {req.skills.split(',').map(s => <Badge key={s} variant="secondary" className="text-[10px]">{s.trim()}</Badge>)}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Bio</Label>
                    <p className="text-sm text-foreground/80 italic mt-1">"{req.bio}"</p>
                  </div>
                  <div className="flex gap-3 pt-4">
                    <Button variant="destructive" className="flex-1 gap-2" onClick={() => handleDecline(req.id)}><X className="w-4 h-4" /> Decline</Button>
                    <Button className="flex-1 gap-2" onClick={() => handleApprove(req.id, req.volunteer_name)}><Check className="w-4 h-4" /> Approve</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            );
          })}
        </div>
      )}
      </TabsContent>

<TabsContent value="history">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {history.map((req: any) => (
              <Dialog key={req.id + req.actionDate}>
                <DialogTrigger asChild>
                  <Card className="p-5 soft-card border-0 opacity-80 grayscale-[0.5] cursor-pointer hover:grayscale-0 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center font-display font-bold text-sm shrink-0">
                        {req.volunteer_name[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-display text-lg leading-tight truncate">{req.volunteer_name}</h3>
                        <div className="flex items-center gap-2">
                          <Badge variant={req.status === 'Approved' ? 'default' : 'destructive'} className="text-[9px] h-4">
                            {req.status}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">{new Date(req.actionDate).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                </DialogTrigger>
                <DialogContent className="max-w-md p-6">
                  <DialogHeader className="mb-4">
                    <DialogTitle className="font-display text-2xl">{req.volunteer_name}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="w-4 h-4" /> {req.city}</div>
                      <div className="flex items-center gap-2 text-muted-foreground"><Phone className="w-4 h-4" /> {req.phone}</div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Skills</Label>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {req.skills.split(',').map((s: string) => <Badge key={s} variant="secondary" className="text-[10px]">{s.trim()}</Badge>)}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Bio</Label>
                      <p className="text-sm text-foreground/80 italic mt-1">"{req.bio}"</p>
                    </div>
                    <div className={`mt-4 p-3 rounded-lg border flex items-center justify-between ${req.status === 'Approved' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                      <span className="text-xs font-semibold uppercase tracking-wider">Decision: {req.status}</span>
                      <span className="text-[10px] opacity-70">{new Date(req.actionDate).toLocaleString()}</span>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            ))}
            {history.length === 0 && <p className="text-sm text-muted-foreground p-4">No past decisions yet.</p>}
          </div>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}