import AppShell from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, MapPin, Sparkles, ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";

const steps = ["Capture media", "Smart processing", "Issue details", "Submit"];

export default function RaiseIssue() {
  const [step, setStep] = useState(0);
  const [keywords, setKeywords] = useState<string[]>([]);
  const nav = useNavigate();

  const next = () => {
    if (step === 0) {
      setTimeout(() => {
        setKeywords(["pothole", "road safety", "scooter", "school zone"]);
        setStep(2);
        toast.success("EXIF parsed · category: Road Repair");
      }, 800);
      setStep(1);
    } else if (step < steps.length - 1) setStep(step + 1);
    else {
      toast.success("Issue submitted! ISSUE_CREATED event fired.");
      nav("/citizen/activity");
    }
  };

  return (
    <AppShell role="citizen">
      <div className="max-w-3xl mx-auto">
        <h1 className="font-display text-4xl mb-2">Raise an issue</h1>
        <p className="text-muted-foreground mb-8">Four quick steps. We do the heavy lifting.</p>

        {/* Stepper */}
        <div className="flex items-center gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-smooth ${
                i < step ? "bg-primary text-primary-foreground" : i === step ? "bg-accent text-accent-foreground shadow-glow" : "bg-muted text-muted-foreground"
              }`}>
                {i < step ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              <span className={`text-xs hidden md:inline ${i === step ? "font-medium" : "text-muted-foreground"}`}>{s}</span>
              {i < steps.length - 1 && <div className={`flex-1 h-px ${i < step ? "bg-primary" : "bg-border"}`} />}
            </div>
          ))}
        </div>

        <Card className="p-8 soft-card border-0">
          {step === 0 && (
            <div className="text-center py-10">
              <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-citizen flex items-center justify-center mb-4">
                <Camera className="w-10 h-10 text-primary" />
              </div>
              <h3 className="font-display text-2xl mb-2">Capture or upload</h3>
              <p className="text-muted-foreground text-sm mb-6">EXIF metadata will pull GPS automatically.</p>
              <div className="border-2 border-dashed border-border rounded-2xl p-10 hover:bg-muted/40 cursor-pointer transition-smooth" onClick={next}>
                <p className="text-sm text-muted-foreground">Tap to take photo · Drop file</p>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="text-center py-16">
              <Sparkles className="w-12 h-12 text-accent mx-auto mb-4 animate-float" />
              <h3 className="font-display text-2xl mb-2">Smart processing…</h3>
              <p className="text-muted-foreground text-sm">Extracting EXIF · classifying · embedding for matching</p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <Label>Title</Label>
                <Input defaultValue="Pothole near school entrance" />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea rows={4} defaultValue="Large pothole that's grown over the past month. Several scooters have skidded." />
              </div>
              <div>
                <Label className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Location</Label>
                <Input defaultValue="Aundh Main Rd, Pune (auto-pinned)" />
              </div>
              <div>
                <Label>AI-generated tags</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {keywords.map(k => <Badge key={k} variant="secondary">#{k}</Badge>)}
                </div>
              </div>
              <div className="rounded-xl bg-pastel-blue/40 p-3 text-xs">
                Category detected: <b>Road Repair</b> · Embedding stored in vector index.
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="text-center py-10">
              <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-volunteer flex items-center justify-center mb-4">
                <Check className="w-10 h-10 text-primary" />
              </div>
              <h3 className="font-display text-2xl mb-2">Ready to submit</h3>
              <p className="text-muted-foreground text-sm">Triggers <code className="text-xs bg-muted px-1.5 py-0.5 rounded">ISSUE_CREATED</code> · matches to nearby skilled volunteers.</p>
            </div>
          )}

          <div className="flex justify-between mt-8">
            <Button variant="ghost" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0 || step === 1}>Back</Button>
            <Button onClick={next} disabled={step === 1} className="gap-2">
              {step === steps.length - 1 ? "Submit issue" : "Continue"} <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
