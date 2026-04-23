import AppShell from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MOCK_ISSUES, MOCK_NGO_MEMBERS } from "@/lib/mockData";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Building2, Users, AlertCircle, CheckCircle2, ArrowRight, Bell } from "lucide-react";
import { Link } from "react-router-dom";

export default function NgoDashboard() {
  const stats = [
    { l: "Resolved today", v: 4, i: CheckCircle2, t: "bg-pastel-green" },
    { l: "Ongoing", v: 12, i: AlertCircle, t: "bg-pastel-pink" },
    { l: "Members", v: MOCK_NGO_MEMBERS.length, i: Users, t: "bg-pastel-blue" },
    { l: "Pending requests", v: 3, i: Building2, t: "bg-accent-soft" },
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
            <h3 className="font-display text-xl mb-3">Unassigned nearby issues</h3>
            <div className="space-y-3">
              {MOCK_ISSUES.filter(i => i.status === "unresolved").map(i => (
                <Dialog key={i.id}>
                  <DialogTrigger asChild>
                    <Card className="p-4 flex gap-4 items-center soft-card border-0 cursor-pointer hover:shadow-lg transition-shadow">
                      <img src={i.beforeImage} alt="" className="w-16 h-16 rounded-xl object-cover" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{i.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{i.location}</p>
                      </div>
                      <Badge variant="secondary">{i.category}</Badge>
                      <Button size="sm" onClick={e => e.stopPropagation()}>Assign</Button>
                    </Card>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle className="font-display text-2xl">{i.title}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 text-sm">
                      <img src={i.beforeImage} alt={i.title} className="w-full h-48 object-cover rounded-xl" />
                      <Badge variant="secondary" className="capitalize">{i.category}</Badge>
                      <p className="text-xs text-muted-foreground">Description: <span className="text-sm">{i.description}</span></p>
                      <p className="text-xs text-muted-foreground">📍 {i.location}</p>
                      <p className="text-xs text-muted-foreground">Status: <span className="font-medium capitalize">{i.status.replace("_", " ")}</span></p>
                      <p className="text-xs text-muted-foreground">Raised on {new Date(i.createdAt).toLocaleDateString()}</p>
                      <div className="flex gap-2 pt-2">
                        <Button className="flex-1">Assign to me</Button>
                        <Button variant="outline">Skip</Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              ))}
            </div>
          </div>
        </div>

        <aside className="space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Bell className="w-4 h-4 text-primary" />
            <h3 className="font-display text-xl">Notifications</h3>
          </div>
          {[
            "3 independent volunteers want to join",
            "Ravi resolved an issue in Koregaon Park",
            "New unresolved case in your area: Sahakar Nagar",
            "Member Priya hit Weaver tier",
          ].map((n, i) => (
            <Card key={i} className="p-4 soft-card border-0">
              <p className="text-sm">{n}</p>
            </Card>
          ))}
        </aside>
      </div>
    </AppShell>
  );
}
