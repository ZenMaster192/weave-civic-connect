// src/pages/VolunteerProfile.tsx
import { useState, useRef } from "react";
import AppShell from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/store/AuthStore";
import { usersApi } from "@/services/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SKILLS } from "@/lib/skillInference";
import { toast } from "sonner";
import {
  User,
  Mail,
  MapPin,
  Pencil,
  Check,
  X,
  Camera,
  Loader2,
  Zap,
  Star,
  Trophy,
  ShieldCheck,
  Building2,
  CheckCircle2,
  TrendingUp,
  Award,
  Phone,
} from "lucide-react";

const VOLUNTEER_TIERS = [
  { name: "Newcomer", minXP: 0, color: "bg-slate-400" },
  { name: "Helper", minXP: 100, color: "bg-emerald-400" },
  { name: "Resolver", minXP: 400, color: "bg-blue-400" },
  { name: "Catalyst", minXP: 1000, color: "bg-violet-500" },
  { name: "Luminary", minXP: 2000, color: "bg-amber-400" },
];

function getTier(xp: number) {
  let t = VOLUNTEER_TIERS[0];
  for (const tier of VOLUNTEER_TIERS) {
    if (xp >= tier.minXP) t = tier;
  }
  return t;
}

// XP = total_resolved * 50 (rough estimate for display)
const xpFor = (resolved: number) => resolved * 50;

type AadhaarStep = "idle" | "input" | "otp" | "verified";

export default function VolunteerProfile() {
  const { token, profile: cachedProfile, setProfile } = useAuthStore();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", "me"],
    queryFn: usersApi.me,
    initialData: cachedProfile ?? undefined,
    enabled: !!token,
  });

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof usersApi.updateMe>[0]) =>
      usersApi.updateMe(data),
    onSuccess: (updated) => {
      setProfile(updated);
      qc.invalidateQueries({ queryKey: ["profile", "me"] });
      toast.success("Profile updated ✓");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Inline field editing
  const [editing, setEditing] = useState<string | null>(null);
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});

  const startEdit = (key: string) => {
    setEditing(key);
    setDraftValues((prev) => ({
      ...prev,
      [key]: (profile as unknown as Record<string, string | undefined>)?.[key] ?? "",
    }));
  };

  const saveField = (key: string) => {
    updateMutation.mutate({ [key]: draftValues[key] } as Parameters<typeof usersApi.updateMe>[0]);
    setEditing(null);
  };

  // Skills editing
  const [editingSkills, setEditingSkills] = useState(false);
  const [draftSkills, setDraftSkills] = useState<string[]>([]);

  const openSkillEdit = () => {
    setDraftSkills(profile?.skills ? profile.skills.split(",").map((s) => s.trim()) : []);
    setEditingSkills(true);
  };

  const toggleDraftSkill = (s: string) =>
    setDraftSkills((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );

  const saveSkills = () => {
    updateMutation.mutate({ skills: draftSkills.join(",") });
    setEditingSkills(false);
  };

  // Aadhaar verification UI state (frontend only — no real API)
  const [aadhaarStep, setAadhaarStep] = useState<AadhaarStep>("idle");
  const [aadhaarNumber, setAadhaarNumber] = useState("");
  const [aadhaarOtp, setAadhaarOtp] = useState("");

  const handleAadhaarVerify = () => {
    if (aadhaarNumber.replace(/\s/g, "").length !== 12) {
      toast.error("Enter a valid 12-digit Aadhaar number.");
      return;
    }
    setAadhaarStep("otp");
    toast.info("OTP sent to mobile number linked with Aadhaar.");
  };

  const handleAadhaarOtpSubmit = () => {
    if (aadhaarOtp.length < 6) {
      toast.error("Enter the 6-digit OTP.");
      return;
    }
    setAadhaarStep("verified");
    toast.success("Aadhaar verified! Trust badge added. ✓");
  };

  const xp = xpFor(profile?.total_resolved ?? 0);
  const tier = getTier(xp);
  const nextTier = VOLUNTEER_TIERS[VOLUNTEER_TIERS.indexOf(tier) + 1];
  const progress = nextTier
    ? Math.min(((xp - tier.minXP) / (nextTier.minXP - tier.minXP)) * 100, 100)
    : 100;

  const currentSkills = profile?.skills
    ? profile.skills.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  if (isLoading) {
    return (
      <AppShell role="volunteer">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell role="volunteer">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* ── Hero ── */}
        <Card className="border-0 shadow-card overflow-hidden">
          <div className="h-28 bg-gradient-volunteer relative" />
          <div className="px-8 pb-8 relative">
            <div className="relative -mt-12 mb-4 w-fit">
              <div className="w-24 h-24 rounded-2xl bg-card border-4 border-background shadow-lg flex items-center justify-center text-3xl font-display font-bold text-primary">
                {profile?.full_name?.charAt(0).toUpperCase() ?? "?"}
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow hover:bg-primary/90 transition-colors"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" />
            </div>

            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <h1 className="font-display text-3xl font-semibold">{profile?.full_name}</h1>
                <p className="text-muted-foreground text-sm mt-0.5">{profile?.email}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge className={`${tier.color} border-0 text-white`}>
                    <Zap className="w-3 h-3 mr-1" />
                    {tier.name}
                  </Badge>
                  {aadhaarStep === "verified" && (
                    <Badge variant="secondary" className="gap-1 bg-emerald-50 text-emerald-700 border-emerald-200">
                      <ShieldCheck className="w-3 h-3" /> Aadhaar Verified
                    </Badge>
                  )}
                  {profile?.org_name && (
                    <Badge variant="outline" className="gap-1">
                      <Building2 className="w-3 h-3" /> {profile.org_name}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex gap-6 text-center">
                <div>
                  <p className="text-3xl font-display font-bold text-primary">{xp}</p>
                  <p className="text-xs text-muted-foreground">Total XP</p>
                </div>
                <div>
                  <p className="text-3xl font-display font-bold">{profile?.total_resolved ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Resolved</p>
                </div>
              </div>
            </div>

            {nextTier && (
              <div className="mt-5">
                <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                  <span className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> Progress to {nextTier.name}
                  </span>
                  <span>{xp} / {nextTier.minXP} XP</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-700"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* ── Personal info ── */}
        <Card className="border-0 shadow-card p-6">
          <h2 className="font-display text-xl mb-4 flex items-center gap-2">
            <User className="w-4 h-4 text-primary" /> Personal Information
          </h2>
          <div className="space-y-0">
            {[
              { key: "full_name", label: "Full Name", icon: User },
              { key: "email", label: "Email", icon: Mail, type: "email" },
              { key: "city", label: "Location", icon: MapPin },
              { key: "bio", label: "About / Bio", icon: User },
            ].map(({ key, label, icon: Icon, type }) => {
              const value = (profile as unknown as Record<string, string | undefined>)?.[key] ?? "";
              const isEditingThis = editing === key;
              return (
                <div
                  key={key}
                  className="flex items-center gap-4 py-3.5 border-b border-border/60 last:border-0 group"
                >
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <Label className="text-xs text-muted-foreground mb-0.5 block">{label}</Label>
                    {isEditingThis ? (
                      <Input
                        autoFocus
                        type={type ?? "text"}
                        value={draftValues[key] ?? ""}
                        onChange={(e) => setDraftValues((p) => ({ ...p, [key]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveField(key);
                          if (e.key === "Escape") setEditing(null);
                        }}
                        className="h-8 text-sm mt-0.5"
                      />
                    ) : (
                      <p className="text-sm font-medium truncate">
                        {value || <span className="text-muted-foreground italic">Not set</span>}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    {isEditingThis ? (
                      <>
                        <Button size="icon" variant="ghost" className="w-8 h-8 text-emerald-600 hover:bg-emerald-50" onClick={() => saveField(key)} disabled={updateMutation.isPending}>
                          {updateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        </Button>
                        <Button size="icon" variant="ghost" className="w-8 h-8" onClick={() => setEditing(null)}>
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    ) : (
                      <Button size="icon" variant="ghost" className="w-8 h-8 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => startEdit(key)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* ── Skills ── */}
        <Card className="border-0 shadow-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl flex items-center gap-2">
              <Star className="w-4 h-4 text-primary" /> Skills
            </h2>
            {!editingSkills && (
              <Button size="sm" variant="outline" onClick={openSkillEdit} className="gap-1.5">
                <Pencil className="w-3.5 h-3.5" /> Edit skills
              </Button>
            )}
          </div>

          {editingSkills ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 max-h-48 overflow-auto p-3 rounded-xl bg-muted/40">
                {SKILLS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleDraftSkill(s)}
                    className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
                      draftSkills.includes(s)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card hover:bg-secondary border-border"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={saveSkills} disabled={updateMutation.isPending} className="gap-1.5">
                  {updateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Save
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditingSkills(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {currentSkills.length > 0
                ? currentSkills.map((s) => (
                    <Badge key={s} variant="secondary" className="px-3 py-1 text-xs">{s}</Badge>
                  ))
                : <p className="text-sm text-muted-foreground italic">No skills added yet. Click "Edit skills" to add some.</p>
              }
            </div>
          )}
        </Card>

        {/* ── Aadhaar Verification ── */}
        <Card className="border-0 shadow-card p-6">
          <h2 className="font-display text-xl mb-1 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" /> Identity Verification
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Verify your Aadhaar to earn a trust badge visible on all your resolved issues.
          </p>

          {aadhaarStep === "verified" ? (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-emerald-800 dark:text-emerald-400">Aadhaar Verified</p>
                <p className="text-xs text-emerald-600">Your identity has been verified. Trust badge is active.</p>
              </div>
            </div>
          ) : aadhaarStep === "idle" ? (
            <Button onClick={() => setAadhaarStep("input")} variant="outline" className="gap-2">
              <ShieldCheck className="w-4 h-4" /> Verify Aadhaar
            </Button>
          ) : aadhaarStep === "input" ? (
            <div className="space-y-3 max-w-sm">
              <div>
                <Label>Aadhaar Number</Label>
                <Input
                  placeholder="XXXX XXXX XXXX"
                  value={aadhaarNumber}
                  onChange={(e) => {
                    // Auto-format with spaces
                    const raw = e.target.value.replace(/\D/g, "").slice(0, 12);
                    const formatted = raw.match(/.{1,4}/g)?.join(" ") ?? raw;
                    setAadhaarNumber(formatted);
                  }}
                  maxLength={14}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAadhaarVerify} size="sm">Send OTP to mobile</Button>
                <Button variant="outline" size="sm" onClick={() => setAadhaarStep("idle")}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 max-w-sm">
              <p className="text-sm text-muted-foreground">
                <Phone className="w-3.5 h-3.5 inline mr-1" />
                OTP sent to your Aadhaar-linked mobile number.
              </p>
              <div>
                <Label>Enter 6-digit OTP</Label>
                <Input
                  placeholder="••••••"
                  maxLength={6}
                  value={aadhaarOtp}
                  onChange={(e) => setAadhaarOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAadhaarOtpSubmit} size="sm">Verify</Button>
                <Button variant="outline" size="sm" onClick={() => { setAadhaarStep("idle"); setAadhaarOtp(""); }}>Cancel</Button>
              </div>
            </div>
          )}
        </Card>

        {/* ── Badges ── */}
        <Card className="border-0 shadow-card p-6 pb-8">
          <h2 className="font-display text-xl mb-4 flex items-center gap-2">
            <Award className="w-4 h-4 text-primary" /> Badges & Achievements
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: "First Resolve", earned: (profile?.total_resolved ?? 0) >= 1, icon: "🏁" },
              { label: "10 Resolves", earned: (profile?.total_resolved ?? 0) >= 10, icon: "🌱" },
              { label: "50 Resolves", earned: (profile?.total_resolved ?? 0) >= 50, icon: "🔥" },
              { label: "Aadhaar Verified", earned: aadhaarStep === "verified", icon: "🛡️" },
              { label: "Skill Master", earned: currentSkills.length >= 5, icon: "🎯" },
              { label: "Early Adopter", earned: true, icon: "⭐" },
            ].map((badge) => (
              <div
                key={badge.label}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                  badge.earned ? "border-primary/30 bg-primary/5" : "border-border bg-muted/30 opacity-40"
                }`}
              >
                <span className="text-2xl">{badge.icon}</span>
                <div>
                  <p className="text-sm font-medium leading-tight">{badge.label}</p>
                  <p className="text-xs text-muted-foreground">{badge.earned ? "Earned" : "Locked"}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}