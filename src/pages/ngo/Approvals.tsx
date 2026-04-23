import { useState } from "react";
import AppShell from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Phone, MapPin, Zap } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { MOCK_NGO_MEMBERS } from "@/lib/mockData";

type Volunteer = {
  name: string;
  skills: string[];
  xp: number;
  distance: string;
  phone: string;
  city: string;
  avatar: string;
};

const INITIAL_REQUESTS: Volunteer[] = [
  { name: "Anish Reddy",  skills: ["Plumbing", "Construction"],          xp: 0,   distance: "1.2 km", phone: "+91 98200 11111", city: "Pune",  avatar: "AR" },
  { name: "Meera Iyer",   skills: ["Teaching", "Community Outreach"],    xp: 220, distance: "3.4 km", phone: "+91 98200 22222", city: "Pune",  avatar: "MI" },
  { name: "Vikram Joshi", skills: ["Electrical", "IT Support"],          xp: 540, distance: "0.8 km", phone: "+91 98200 33333", city: "Pune",  avatar: "VJ" },
];

export default function Approvals() {
  const [pending, setPending] = useState<Volunteer[]>(INITIAL_REQUESTS);
  const [members, setMembers] = useState(MOCK_NGO_MEMBERS);
  const [selected, setSelected] = useState<Volunteer | null>(null);

  const decline = (name: string) => {
    setPending(prev => prev.filter(v => v.name !== name));
    setSelected(null);
  };

  const approve = (vol: Volunteer) => {
    setPending(prev => prev.filter(v => v.name !== vol.name));
    setMembers(prev => [...prev, { name: vol.name, role: "Volunteer", xp: vol.xp, tier: "Seed", avatar: vol.avatar }]);
    setSelected(null);
  };

  return (
    <AppShell role="ngo">
      <h1 className="font-display text-4xl mb-2">Volunteer approvals</h1>
      <p className="text-muted-foreground mb-6">
        Independent volunteers requesting affiliation · {pending.length} pending
      </p>

      {pending.length === 0 && (
        <Card className="p-10 soft-card border-0 text-center text-muted-foreground">
          <Check className="w-8 h-8 mx-auto mb-3 text-primary/40" />
          <p className="font-medium">All caught up — no pending requests.</p>
        </Card>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {pending.map(vol => (
          <Dialog key={vol.name} open={selected?.name === vol.name} onOpenChange={open => setSelected(open ? vol : null)}>
            <DialogTrigger asChild>
              <Card className="p-5 soft-card border-0 cursor-pointer hover:shadow-lg transition-shadow">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-accent flex items-center justify-center font-display font-bold text-sm">
                    {vol.avatar}
                  </div>
                  <div>
                    <h3 className="font-display text-lg leading-tight">{vol.name}</h3>
                    <p className="text-xs text-muted-foreground">{vol.distance} · {vol.xp} XP</p>
                  </div>
                </div>
                <div className="flex gap-1 flex-wrap mb-4">
                  {vol.skills.map(s => <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>)}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline" size="sm" className="flex-1 gap-1"
                    onClick={e => { e.stopPropagation(); decline(vol.name); }}
                  >
                    <X className="w-3.5 h-3.5" /> Decline
                  </Button>
                  <Button
                    size="sm" className="flex-1 gap-1"
                    onClick={e => { e.stopPropagation(); approve(vol); }}
                  >
                    <Check className="w-3.5 h-3.5" /> Approve
                  </Button>
                </div>
              </Card>
            </DialogTrigger>

            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="font-display text-2xl">{vol.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-accent flex items-center justify-center font-display font-bold text-xl">
                  {vol.avatar}
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="w-4 h-4" /> {vol.phone}
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="w-4 h-4" /> {vol.city} · {vol.distance} away
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Zap className="w-4 h-4" /> {vol.xp} XP earned
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Skills</p>
                  <div className="flex flex-wrap gap-1.5">
                    {vol.skills.map(s => <Badge key={s} variant="secondary">{s}</Badge>)}
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <Button variant="outline" className="flex-1 gap-1" onClick={() => decline(vol.name)}>
                    <X className="w-4 h-4" /> Decline
                  </Button>
                  <Button className="flex-1 gap-1" onClick={() => approve(vol)}>
                    <Check className="w-4 h-4" /> Approve & add to team
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        ))}
      </div>
    </AppShell>
  );
}