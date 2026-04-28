import AppShell from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useRef, useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Camera, MapPin, Sparkles, ArrowRight, Check, Upload,
  X, Loader2, Navigation, AlertCircle, Brain, Eye, Send
} from "lucide-react";
import { toast } from "sonner";
import { inferSkills, CATEGORIES, SKILLS, type IssueCategory } from "@/lib/skillInference";
import { issuesApi, geocodeApi } from "@/services/api";
import MapPicker, { type LocationResult } from "@/components/MapPicker";

// ── Step metadata ──────────────────────────────────────────────
const STEPS = [
  { label: "Photo",    icon: Camera,    desc: "Capture or upload" },
  { label: "Location", icon: MapPin,    desc: "Pin the spot" },
  { label: "Details",  icon: Brain,     desc: "Describe the issue" },
  { label: "Submit",   icon: Send,      desc: "Review & send" },
];

// ── Skill color palette ────────────────────────────────────────
const SKILL_COLORS: Record<string, string> = {
  "Road Repair":        "bg-amber-100 text-amber-800 border-amber-200",
  "Construction":       "bg-orange-100 text-orange-800 border-orange-200",
  "Civil Engineering":  "bg-yellow-100 text-yellow-800 border-yellow-200",
  "Waste Management":   "bg-lime-100 text-lime-800 border-lime-200",
  "Sanitation":         "bg-green-100 text-green-800 border-green-200",
  "Community Outreach": "bg-teal-100 text-teal-800 border-teal-200",
  "Plumbing":           "bg-cyan-100 text-cyan-800 border-cyan-200",
  "Electrical":         "bg-blue-100 text-blue-800 border-blue-200",
  "Environmental":      "bg-emerald-100 text-emerald-800 border-emerald-200",
  "Animal Rescue":      "bg-purple-100 text-purple-800 border-purple-200",
  "Healthcare":         "bg-rose-100 text-rose-800 border-rose-200",
  "Fire Safety":        "bg-red-100 text-red-800 border-red-200",
};

function skillColor(s: string) {
  return SKILL_COLORS[s] ?? "bg-indigo-100 text-indigo-800 border-indigo-200";
}

// ── Component ──────────────────────────────────────────────────
export default function RaiseIssue() {
  const nav = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  // wizard state
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // photo
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // location
  const [locState, setLocState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [locError, setLocError] = useState("");

  // details
  const [title, setTitle]           = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory]     = useState<IssueCategory>("Road Repair");
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");

  // auto-infer skills whenever details or photo change
  useEffect(() => {
    if (title || description || category) {
      const inferred = inferSkills(title, description, category, photo?.name);
      setSkills((prev) => {
        // Merge: keep any user-added skills not in new inference, prepend new inferred
        const userAdded = prev.filter((s) => !SKILLS.includes(s as any));
        return [...new Set([...inferred, ...userAdded])];
      });
    }
  }, [title, description, category, photo]);

  // Auto-fetch GPS whenever step 1 becomes active
  useEffect(() => {
    if (step === 1) fetchLocation();
  }, [step]);

  // ── Photo handlers ─────────────────────────────────────────
  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file.");
      return;
    }
    setPhoto(file);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
    toast.success("Photo added! ✨");
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  // ── Geolocation ────────────────────────────────────────────
  const fetchLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      setLocError("Geolocation is not supported by your browser.");
      setLocState("error");
      return;
    }
    setLocState("loading");
    setLocError("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setLat(latitude);
        setLng(longitude);
        try {
          const geo = await geocodeApi.reverse(latitude, longitude);
          setAddress(geo.address ?? "");
          setCity(geo.city ?? "");
          setLocState("done");
          toast.success("Location pinned! 📍");
        } catch {
          // coords are still good even if reverse geocode fails
          setAddress(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
          setLocState("done");
          toast.info("Location pinned (reverse geocode unavailable).");
        }
      },
      (err) => {
        setLocError(`Location access denied: ${err.message}`);
        setLocState("error");
        toast.error("Could not fetch location. Please allow access.");
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }, []);

  // ── Navigation ─────────────────────────────────────────────
  const canNext = () => {
    if (step === 0) return !!photo;
    if (step === 1) return locState === "done";
    if (step === 2) return title.trim().length >= 5 && description.trim().length >= 10;
    return true;
  };

  const goNext = () => {
    if (!canNext()) {
      const msgs = [
        "Please add a photo first.",
        "Please pin your location first.",
        "Title (5+ chars) and description (10+ chars) are required.",
        "",
      ];
      toast.error(msgs[step]);
      return;
    }
    if (step < STEPS.length - 1) setStep(step + 1);
  };

  const goBack = () => { if (step > 0) setStep(step - 1); };

  // ── Submit ─────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!lat || !lng) { toast.error("Location is missing."); return; }
    setBusy(true);
    try {
      const issue = await issuesApi.create({
        title: title.trim(),
        description: description.trim(),
        category,
        latitude: lat,
        longitude: lng,
        address: address || undefined,
        city: city || undefined,
        required_skills: skills.join(","),
      });

      if (photo) {
        try { await issuesApi.uploadImage(issue.id, photo); }
        catch { toast.warning("Issue created but photo upload failed."); }
      }

      toast.success("Issue submitted! Volunteers are being matched. 🎉");
      nav("/citizen/activity");
    } catch (err: any) {
      const msg: string = err.message ?? "";
      if (
        msg.toLowerCase().includes("expired") ||
        msg.toLowerCase().includes("credentials") ||
        msg.toLowerCase().includes("401")
      ) {
        toast.error("Your session has expired. Please log in again.");
        setTimeout(() => nav("/auth/citizen"), 1500);
      } else {
        toast.error(msg || "Failed to submit issue. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────
  return (
    <AppShell role="citizen">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <p className="text-xs uppercase tracking-widest text-primary/60 mb-1">Civic Action</p>
          <h1 className="font-display text-4xl font-bold mb-1">Raise an Issue</h1>
          <p className="text-muted-foreground text-sm">Four quick steps — we handle the smart stuff.</p>
        </div>

        {/* Stepper */}
        <div className="flex items-center mb-10">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const done = i < step;
            const active = i === step;
            return (
              <div key={s.label} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={`
                      w-10 h-10 rounded-full flex items-center justify-center
                      text-sm font-semibold transition-all duration-300
                      ${done  ? "bg-primary text-primary-foreground shadow-glow scale-95"
                              : active ? "bg-accent text-accent-foreground ring-4 ring-accent/25 scale-110"
                              : "bg-muted text-muted-foreground"}
                    `}
                  >
                    {done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <span className={`text-[10px] font-medium hidden sm:block ${active ? "text-foreground" : "text-muted-foreground"}`}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 rounded transition-all duration-500 ${done ? "bg-primary" : "bg-border"}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Card */}
        <Card
          className="border-0 overflow-hidden"
          style={{
            boxShadow: "var(--shadow-card)",
            borderRadius: "var(--radius)",
          }}
        >
          {/* Step 0 — Photo */}
          {step === 0 && (
            <div key="step-0" className="p-8 step-panel">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-pastel-blue flex items-center justify-center">
                  <Camera className="w-5 h-5 text-blue-700" />
                </div>
                <div>
                  <h2 className="font-display text-2xl font-semibold">Capture the issue</h2>
                  <p className="text-sm text-muted-foreground">A photo helps volunteers understand quickly.</p>
                </div>
              </div>

              {preview ? (
                <div className="relative rounded-2xl overflow-hidden mb-4 group">
                  <img src={preview} alt="Preview" className="w-full h-64 object-cover" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                    <button
                      onClick={() => { setPhoto(null); setPreview(null); }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-full p-2 shadow-lg"
                    >
                      <X className="w-5 h-5 text-destructive" />
                    </button>
                  </div>
                  <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5">
                    <Check className="w-3 h-3 text-green-400" /> Photo ready
                  </div>
                </div>
              ) : (
                <div
                  onDrop={onDrop}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onClick={() => fileRef.current?.click()}
                  className={`
                    border-2 border-dashed rounded-2xl p-14 text-center cursor-pointer
                    transition-all duration-200 select-none
                    ${dragOver
                      ? "border-primary bg-primary/5 scale-[1.01]"
                      : "border-border hover:border-primary/50 hover:bg-muted/40"
                    }
                  `}
                >
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-citizen flex items-center justify-center mb-4">
                    <Upload className="w-7 h-7 text-blue-600" />
                  </div>
                  <p className="font-medium text-sm mb-1">
                    {dragOver ? "Drop to upload" : "Tap to take / upload photo"}
                  </p>
                  <p className="text-xs text-muted-foreground">PNG, JPG, WEBP — up to 10 MB</p>
                </div>
              )}

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />

              {!preview && (
                <p className="text-xs text-center text-muted-foreground mt-4">
                  🔒 Your photo is only shared with matched volunteers.
                </p>
              )}
            </div>
          )}

          {/* Step 1 — Location */}
          {step === 1 && (
            <div key="step-1" className="p-6 step-panel">
              {/* Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-pastel-green flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5 text-green-700" />
                </div>
                <div>
                  <h2 className="font-display text-2xl font-semibold">Pin the location</h2>
                  <p className="text-sm text-muted-foreground">Drag the marker or click anywhere on the map to adjust.</p>
                </div>
              </div>

              {/* GPS button row */}
              <div className="flex items-center gap-2 mb-3">
                <Button
                  size="sm"
                  variant={locState === "done" ? "outline" : "default"}
                  onClick={fetchLocation}
                  disabled={locState === "loading"}
                  className="gap-2 shrink-0"
                >
                  {locState === "loading"
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Locating…</>
                    : <><Navigation className="w-3.5 h-3.5" /> {locState === "done" ? "Re-fetch GPS" : "Use my location"}</>}
                </Button>
                {locState === "error" && (
                  <span className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> {locError}
                  </span>
                )}
              </div>

              {/* Interactive map — always visible */}
              <div className="rounded-2xl overflow-hidden border border-border shadow-soft mb-3">
                <MapPicker
                  initialLat={lat ?? undefined}
                  initialLng={lng ?? undefined}
                  onLocationChange={(r: LocationResult) => {
                    setLat(r.lat);
                    setLng(r.lng);
                    setAddress(r.address);
                    setCity(r.city);
                    setLocState("done");
                  }}
                />
              </div>

              {/* Address display / manual override */}
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Address</Label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Address auto-fills when you pin — or type manually"
                />
                <div className="flex gap-2">
                  <Input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="City"
                    className="max-w-[160px]"
                  />
                  {lat && lng && (
                    <span className="flex items-center text-xs text-muted-foreground font-mono bg-muted px-3 rounded-lg">
                      {lat.toFixed(5)}, {lng.toFixed(5)}
                    </span>
                  )}
                </div>
                {locState !== "done" && (
                  <p className="text-xs text-muted-foreground">
                    💡 You can also click on the map or drag the pin without using GPS.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Step 2 — Details */}
          {step === 2 && (
            <div key="step-2" className="p-8 space-y-5 step-panel">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-pastel-pink flex items-center justify-center">
                  <Brain className="w-5 h-5 text-rose-700" />
                </div>
                <div>
                  <h2 className="font-display text-2xl font-semibold">Describe the issue</h2>
                  <p className="text-sm text-muted-foreground">AI infers required skills in real-time.</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="issue-title">Issue title <span className="text-destructive">*</span></Label>
                <Input
                  id="issue-title"
                  placeholder="e.g. Pothole near school entrance"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={120}
                />
                <p className="text-xs text-muted-foreground text-right">{title.length}/120</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="issue-desc">Description <span className="text-destructive">*</span></Label>
                <Textarea
                  id="issue-desc"
                  rows={4}
                  placeholder="Describe what you see, how long it's been there, and any safety concerns…"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={800}
                />
                <p className="text-xs text-muted-foreground text-right">{description.length}/800</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="issue-cat">Category</Label>
                <select
                  id="issue-cat"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as IssueCategory)}
                  className="w-full h-10 rounded-[var(--radius)] border border-input bg-background px-3 text-sm
                    focus:outline-none focus:ring-2 focus:ring-ring transition-smooth"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* ── Skills — editable ───────────────────────────── */}
              <div className="rounded-xl border border-border/60 p-4 space-y-3 bg-muted/20">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-accent" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Skills required
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">AI-suggested · edit freely</span>
                </div>

                {/* Current skill badges with remove */}
                <div className="flex flex-wrap gap-2 min-h-[32px]">
                  {skills.length === 0 && (
                    <span className="text-xs text-muted-foreground italic">No skills yet — type below or use the dropdown.</span>
                  )}
                  {skills.map((s) => (
                    <span
                      key={s}
                      className={`inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-medium border ${skillColor(s)}`}
                    >
                      {s}
                      <button
                        type="button"
                        onClick={() => setSkills((prev) => prev.filter((x) => x !== s))}
                        className="rounded-full hover:bg-black/10 p-0.5 transition-colors"
                        aria-label={`Remove ${s}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>

                {/* Add from known list */}
                <div className="flex gap-2">
                  <select
                    className="flex-1 h-9 rounded-lg border border-input bg-background px-2.5 text-sm
                      focus:outline-none focus:ring-2 focus:ring-ring transition-smooth"
                    value=""
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val && !skills.includes(val)) setSkills((p) => [...p, val]);
                    }}
                  >
                    <option value="">+ Add a skill from list…</option>
                    {SKILLS.filter((s) => !skills.includes(s)).map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                {/* Add custom skill */}
                <div className="flex gap-2">
                  <Input
                    placeholder="Or type a custom skill…"
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const val = skillInput.trim();
                        if (val && !skills.includes(val)) setSkills((p) => [...p, val]);
                        setSkillInput("");
                      }
                    }}
                    className="flex-1 h-9 text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => {
                      const val = skillInput.trim();
                      if (val && !skills.includes(val)) setSkills((p) => [...p, val]);
                      setSkillInput("");
                    }}
                  >
                    Add
                  </Button>
                </div>

                <p className="text-[10px] text-muted-foreground">
                  These skills are used to match this issue with the right volunteers.
                </p>
              </div>
            </div>
          )}

          {/* Step 3 — Review & Submit */}
          {step === 3 && (
            <div key="step-3" className="p-8 space-y-5 step-panel">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-pastel-blue flex items-center justify-center">
                  <Eye className="w-5 h-5 text-blue-700" />
                </div>
                <div>
                  <h2 className="font-display text-2xl font-semibold">Review & submit</h2>
                  <p className="text-sm text-muted-foreground">Everything looks good? Let's weave it in.</p>
                </div>
              </div>

              {/* Photo thumbnail */}
              {preview && (
                <div className="flex items-center gap-4 p-3 rounded-xl bg-muted/40 border border-border/60">
                  <img src={preview} alt="Issue" className="w-16 h-16 rounded-xl object-cover" />
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Photo</p>
                    <p className="text-sm font-medium truncate max-w-[220px]">{photo?.name}</p>
                  </div>
                </div>
              )}

              {/* Location */}
              <div className="flex items-start gap-3 p-4 rounded-xl bg-pastel-green/20 border border-green-200">
                <MapPin className="w-4 h-4 text-green-700 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Location</p>
                  <p className="text-sm font-medium">{address || `${lat?.toFixed(5)}, ${lng?.toFixed(5)}`}</p>
                  {city && <p className="text-xs text-muted-foreground">{city}</p>}
                </div>
              </div>

              {/* Title / description */}
              <div className="p-4 rounded-xl bg-muted/30 border border-border/60 space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Issue</p>
                  <p className="font-semibold">{title}</p>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
                <Badge variant="secondary" className="capitalize">{category}</Badge>
              </div>

              {/* Skills */}
              <div className="p-4 rounded-xl bg-accent/10 border border-accent/20 space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-accent" />
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Skills required</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {skills.map((s) => (
                    <Badge key={s} variant="outline" className={`text-xs border ${skillColor(s)}`}>{s}</Badge>
                  ))}
                </div>
              </div>

              <div className="text-xs text-center text-muted-foreground pt-1">
                By submitting, this issue becomes visible to nearby volunteers matching the skill set above.
              </div>
            </div>
          )}

          {/* Footer nav */}
          <div className="flex items-center justify-between px-8 pb-8">
            <Button
              variant="ghost"
              onClick={goBack}
              disabled={step === 0 || busy}
              className="gap-2"
            >
              ← Back
            </Button>

            {step < STEPS.length - 1 ? (
              <Button
                onClick={goNext}
                disabled={!canNext() || busy}
                className="gap-2 px-7"
              >
                Continue <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={busy}
                className="gap-2 px-7 bg-primary hover:bg-primary/90"
              >
                {busy
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
                  : <><Send className="w-4 h-4" /> Submit issue</>
                }
              </Button>
            )}
          </div>
        </Card>

        {/* Progress dots (mobile-friendly) */}
        <div className="flex justify-center gap-2 mt-6">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-300 ${
                i === step ? "w-6 h-2 bg-primary" : i < step ? "w-2 h-2 bg-primary/40" : "w-2 h-2 bg-border"
              }`}
            />
          ))}
        </div>
      </div>
    </AppShell>
  );
}
