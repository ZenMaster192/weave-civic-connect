import AppShell from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type Issue } from "@/services/api";
import { Star, MessageSquare, Loader2 } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { issuesApi, reviewApi } from "@/services/api";
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
  open: "bg-pastel-pink text-foreground",
  assigned: "bg-pastel-blue text-foreground",
  in_progress: "bg-accent-soft text-foreground",
  resolved: "bg-pastel-green text-foreground",
};

// We will fetch the actual review for a resolved issue, so extend Issue type locally
type UI_Issue = Issue;

const IssueCard = ({ issue }: { issue: UI_Issue }) => {
  const queryClient = useQueryClient();
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");

  const { data: review } = useQuery({
      queryKey: ["review", issue.id],
      queryFn: () => reviewApi.get(issue.id),
      enabled: issue.status === "resolved",
  });

  const submitReview = useMutation({
      mutationFn: () => reviewApi.submit(issue.id, rating, reviewText),
      onSuccess: () => {
          setReviewModalOpen(false);
          queryClient.invalidateQueries({ queryKey: ["review", issue.id] });
      }
  });

  return (
    <>
  <Card className="overflow-hidden soft-card border-0 cursor-pointer hover:shadow-lg transition-shadow">
    <div className="grid md:grid-cols-[180px_1fr] gap-0">
      <div className="relative h-44 md:h-full">
        <img src={issue.image_url} alt={issue.title} className="w-full h-full object-cover" />
        {issue.proof_url && (
          <div className="absolute inset-0 grid grid-cols-2">
            <img src={issue.image_url} className="w-full h-full object-cover" alt="" />
            <img src={issue.proof_url} className="w-full h-full object-cover border-l-2 border-card" alt="" />
          </div>
        )}
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <p className="text-xs text-muted-foreground">{issue.uid.slice(0,8)} · {new Date(issue.created_at).toLocaleDateString()}</p>
            <h3 className="font-display text-xl">{issue.title}</h3>
          </div>
          <Badge className={`${STATUS_COLOR[issue.status]} capitalize border-0`}>{issue.status.replace("_", " ")}</Badge>
        </div>
        <p className="text-sm text-muted-foreground mb-3">{issue.description}</p>
        <p className="text-xs text-muted-foreground mb-3">📍 {issue.address || issue.city}</p>

        {issue.status === "resolved" && (
          <div className="border-t border-border pt-3 mt-3 space-y-2">
            <p className="text-sm">Resolved by <span className="text-primary font-medium">{issue.resolver_name}</span></p>
            {review ? (
              <div className="flex items-center gap-1 text-sm">
                {[1,2,3,4,5].map(n => (
                  <Star key={n} className={`w-4 h-4 ${n <= review.rating ? "fill-accent text-accent" : "text-muted-foreground"}`} />
                ))}
                <span className="ml-2 text-muted-foreground italic">"{review.review_text}"</span>
              </div>
            ) : (
              <Button size="sm" onClick={() => setReviewModalOpen(true)} className="gap-2">
                  <Star className="w-4 h-4" /> Review Volunteer
              </Button>
            )}
          </div>
        )}

        {issue.status !== "resolved" && issue.resolver_name && (
          <p className="text-sm">👷 Assigned to <b>{issue.resolver_name}</b></p>
        )}
  </div>
    </div>
  </Card>

  <Dialog open={reviewModalOpen} onOpenChange={setReviewModalOpen}>
      <DialogContent>
          <DialogHeader>
              <DialogTitle className="font-display text-2xl">Rate the Resolution</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
              <div>
                  <p className="text-sm text-muted-foreground mb-2">How did the volunteer do?</p>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map(n => (
                        <button key={n} onClick={() => setRating(n)}>
                            <Star className={`w-8 h-8 ${n <= rating ? "fill-accent text-accent" : "text-muted-foreground"}`} />
                        </button>
                    ))}
                  </div>
              </div>
              <textarea 
                  className="w-full min-h-[100px] p-3 rounded-xl border border-border bg-background"
                  placeholder="Share your thoughts..."
                  value={reviewText}
                  onChange={e => setReviewText(e.target.value)}
              />
              <Button 
                  className="w-full" 
                  disabled={rating === 0 || !reviewText || submitReview.isPending}
                  onClick={() => submitReview.mutate()}
              >
                  {submitReview.isPending ? "Submitting..." : "Submit Review"}
              </Button>
          </div>
      </DialogContent>
  </Dialog>
  </>
)};


export default function ActivityLog() {
  const [tab, setTab] = useState("history");
  const { token } = useAuthStore();

  const { data: rawIssues = [], isLoading } = useQuery({
    queryKey: ["issues", "citizen", token?.user_id],
    queryFn: () => issuesApi.list({ reporter_id: token?.user_id }),
    enabled: !!token?.user_id,
  });

  // Normalise API Issue shape to the local Issue type used by IssueCard
  const sorted = [...rawIssues].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

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
