import AppShell from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Issue } from "@/lib/mockData";
import { Star, MessageSquare, Loader2 } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { issuesApi } from "@/services/api";
import { useAuthStore } from "@/store/AuthStore";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const STATUS_COLOR: Record<string, string> = {
  unresolved: "bg-pastel-pink text-foreground",
  assigned: "bg-pastel-blue text-foreground",
  in_progress: "bg-accent-soft text-foreground",
  resolved: "bg-pastel-green text-foreground",
};

const IssueCard = ({ issue }: { issue: Issue }) => (
  <Dialog>
  <DialogTrigger asChild>
  <Card className="overflow-hidden soft-card border-0 cursor-pointer hover:shadow-lg transition-shadow">
    <div className="grid md:grid-cols-[180px_1fr] gap-0">
      <div className="relative h-44 md:h-full">
        <img src={issue.beforeImage} alt={issue.title} className="w-full h-full object-cover" />
        {issue.afterImage && (
          <div className="absolute inset-0 grid grid-cols-2">
            <img src={issue.beforeImage} className="w-full h-full object-cover" alt="" />
            <img src={issue.afterImage} className="w-full h-full object-cover border-l-2 border-card" alt="" />
          </div>
        )}
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <p className="text-xs text-muted-foreground">{issue.id} · {new Date(issue.createdAt).toLocaleDateString()}</p>
            <h3 className="font-display text-xl">{issue.title}</h3>
          </div>
          <Badge className={`${STATUS_COLOR[issue.status]} capitalize border-0`}>{issue.status.replace("_", " ")}</Badge>
        </div>
        <p className="text-sm text-muted-foreground mb-3">{issue.description}</p>
        <p className="text-xs text-muted-foreground mb-3">📍 {issue.location}</p>

        {issue.status === "resolved" && (
          <div className="border-t border-border pt-3 mt-3 space-y-2">
            <p className="text-sm">Resolved by <button className="text-primary font-medium hover:underline">{issue.volunteer}</button></p>
            {issue.rating && (
              <div className="flex items-center gap-1 text-sm">
                {[1,2,3,4,5].map(n => (
                  <Star key={n} className={`w-4 h-4 ${n <= (issue.rating || 0) ? "fill-accent text-accent" : "text-muted-foreground"}`} />
                ))}
                <span className="ml-2 text-muted-foreground italic">"{issue.review}"</span>
                <Button variant="ghost" size="sm" className="ml-auto gap-1"><MessageSquare className="w-3 h-3" /> Edit review</Button>
              </div>
            )}
          </div>
        )}

        {issue.status !== "resolved" && issue.volunteer && (
          <p className="text-sm">👷 Assigned to <b>{issue.volunteer}</b></p>
        )}
  </div>
    </div>
  </Card>
  </DialogTrigger>
<DialogContent className="max-w-3xl">
    <DialogHeader>
      <DialogTitle className="font-display text-2xl">{issue.title}</DialogTitle>
    </DialogHeader>
    <div className="space-y-3 text-sm">
      {issue.beforeImage && (
        <img src={issue.beforeImage} alt={issue.title} className="w-full h-48 object-cover rounded-xl" />
      )}
      
      <Badge variant="secondary" className="capitalize">{issue.category}</Badge>
      
      <p className="text-xs text-muted-foreground"> 
        Description: <span className="text-sm text-muted-foreground">{issue.description}</span>
      </p>
      
      <p className="text-xs text-muted-foreground"> Location: {issue.location}</p>
      
      <p className="text-xs text-muted-foreground">
        Status: <span className="font-medium capitalize">{issue.status.replace("_", " ")}</span>
      </p>
      
      <p className="text-xs text-muted-foreground">
        Raised on {new Date(issue.createdAt).toLocaleDateString()}
      </p>

      {/* Kept these Activity-specific details but updated their styling to match */}
      {issue.volunteer && (
        <p className="text-xs text-muted-foreground"> 
          Assigned to: <span className="font-medium">{issue.volunteer}</span>
        </p>
      )}
      {issue.resolvedAt && (
        <p className="text-xs text-muted-foreground">
          Resolved on {new Date(issue.resolvedAt).toLocaleDateString()}
        </p>
      )}
    </div>
  </DialogContent>
  </Dialog>
);

export default function ActivityLog() {
  const [tab, setTab] = useState("history");
  const { token } = useAuthStore();

  const { data: rawIssues = [], isLoading } = useQuery({
    queryKey: ["issues", "citizen", token?.user_id],
    queryFn: () => issuesApi.list({ reporter_id: token?.user_id }),
    enabled: !!token?.user_id,
  });

  // Normalise API Issue shape to the local Issue type used by IssueCard
  const sorted = [...rawIssues]
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    .map((i) => ({
      id: String(i.id),
      title: i.title,
      description: i.description,
      category: i.category,
      keywords: [],
      location: i.address ?? i.city ?? "",
      lat: i.latitude,
      lng: i.longitude,
      beforeImage: i.image_url ?? "",
      status: i.status as any,
      citizen: "",
      createdAt: i.created_at,
      resolvedAt: i.resolved_at,
    }));

  const ongoing = sorted.filter(i => i.status !== "resolved");
  const resolved = sorted.filter(i => i.status === "resolved");

  return (
    <AppShell role="citizen">
      <h1 className="font-display text-4xl mb-2">Activity log</h1>
      <p className="text-muted-foreground mb-6">Every issue you've raised, in one timeline.</p>

{isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-2xl" />)}
        </div>
      )}
      <Tabs value={tab} onValueChange={setTab} className={isLoading ? "hidden" : ""}>
        <TabsList className="mb-6">
          <TabsTrigger value="history">Issue history</TabsTrigger>
          <TabsTrigger value="ongoing">Ongoing ({ongoing.length})</TabsTrigger>
          <TabsTrigger value="resolved">Resolved ({resolved.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="history" className="space-y-4">
          {sorted.map(i => <IssueCard key={i.id} issue={i} />)}
        </TabsContent>
        <TabsContent value="ongoing" className="space-y-4">
          {ongoing.map(i => <IssueCard key={i.id} issue={i} />)}
        </TabsContent>
        <TabsContent value="resolved" className="space-y-4">
          {resolved.map(i => <IssueCard key={i.id} issue={i} />)}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
