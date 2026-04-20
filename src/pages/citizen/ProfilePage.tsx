// src/pages/CitizenProfile.tsx
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
import { toast } from "sonner";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Pencil,
  Check,
  X,
  Camera,
  Trophy,
  Star,
  Shield,
  Loader2,
  TrendingUp,
  Award,
} from "lucide-react";

const TIERS = [
  { name: "Observer", minIssues: 0, color: "bg-slate-400", textColor: "text-slate-700" },
  { name: "Reporter", minIssues: 3, color: "bg-emerald-400", textColor: "text-emerald-700" },
  { name: "Contributor", minIssues: 10, color: "bg-blue-400", textColor: "text-blue-700" },
  { name: "Change Maker", minIssues: 25, color: "bg-violet-500", textColor: "text-violet-700" },
  { name: "Civic Champion", minIssues: 50, color: "bg-amber-400", textColor: "text-amber-700" },
];

function getTier(resolved: number) {
  let tier = TIERS[0];
  for (const t of TIERS) {
    if (resolved >= t.minIssues) tier = t;
  }
  return tier;
}

type EditableField = {
  key: string;
  label: string;
  icon: React.ElementType;
  type?: string;
  placeholder?: string;
};

const FIELDS: EditableField[] = [
  { key: "full_name", label: "Full Name", icon: User, placeholder: "Your name" },
  { key: "email", label: "Email Address", icon: Mail, type: "email", placeholder: "you@example.com" },
  { key: "city", label: "City / Location", icon: MapPin, placeholder: "e.g. Pune" },
];

export default function CitizenProfile() {
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

  // Local edit state — only one field open at a time
  const [editing, setEditing] = useState<string | null>(null);
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});

  const startEdit = (key: string) => {
    setEditing(key);
    setDraftValues((prev) => ({
      ...prev,
      [key]: (profile as unknown as Record<string, string | undefined>)?.[key] ?? "",
    }));
  };

  const cancelEdit = () => setEditing(null);

  const saveField = (key: string) => {
    updateMutation.mutate({ [key]: draftValues[key] } as Parameters<typeof usersApi.updateMe>[0]);
    setEditing(null);
  };

  const tier = getTier(profile?.total_resolved ?? 0);
  const nextTier = TIERS[TIERS.indexOf(tier) + 1];
  const progressToNext = nextTier
    ? Math.min(((profile?.total_resolved ?? 0) / nextTier.minIssues) * 100, 100)
    : 100;

  if (isLoading) {
    return (
      <AppShell role="citizen">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell role="citizen">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* ── Hero card ── */}
        <Card className="border-0 shadow-card overflow-hidden">
          <div className="h-28 bg-gradient-citizen relative" />
          <div className="px-8 pb-8 relative">
            {/* Avatar */}
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
                <h1 className="font-display text-3xl font-semibold">
                  {profile?.full_name}
                </h1>
                <p className="text-muted-foreground text-sm mt-0.5">{profile?.email}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge className={`${tier.color} border-0 text-white`}>
                    <Trophy className="w-3 h-3 mr-1" />
                    {tier.name}
                  </Badge>
                  {profile?.is_email_verified && (
                    <Badge variant="secondary" className="gap-1">
                      <Shield className="w-3 h-3 text-emerald-500" /> Verified
                    </Badge>
                  )}
                </div>
              </div>

              <div className="text-right">
                <p className="text-4xl font-display font-bold text-primary">
                  {profile?.total_resolved ?? 0}
                </p>
                <p className="text-xs text-muted-foreground">issues resolved</p>
              </div>
            </div>

            {/* Tier progress */}
            {nextTier && (
              <div className="mt-5">
                <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                  <span className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> Progress to {nextTier.name}
                  </span>
                  <span>{profile?.total_resolved} / {nextTier.minIssues} issues</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-700"
                    style={{ width: `${progressToNext}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* ── Editable fields ── */}
        <Card className="border-0 shadow-card p-6 space-y-1">
          <h2 className="font-display text-xl mb-4 flex items-center gap-2">
            <User className="w-4 h-4 text-primary" /> Personal Information
          </h2>

          {FIELDS.map((field) => {
            const value = (profile as unknown as Record<string, string | undefined>)?.[field.key] ?? "";
            const isEditingThis = editing === field.key;
            const Icon = field.icon;

            return (
              <div
                key={field.key}
                className="flex items-center gap-4 py-3.5 border-b border-border/60 last:border-0 group"
              >
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                </div>

                <div className="flex-1 min-w-0">
                  <Label className="text-xs text-muted-foreground mb-0.5 block">
                    {field.label}
                  </Label>
                  {isEditingThis ? (
                    <Input
                      autoFocus
                      type={field.type ?? "text"}
                      value={draftValues[field.key] ?? ""}
                      onChange={(e) =>
                        setDraftValues((p) => ({ ...p, [field.key]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveField(field.key);
                        if (e.key === "Escape") cancelEdit();
                      }}
                      className="h-8 text-sm mt-0.5"
                      placeholder={field.placeholder}
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
                      <Button
                        size="icon"
                        variant="ghost"
                        className="w-8 h-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                        onClick={() => saveField(field.key)}
                        disabled={updateMutation.isPending}
                      >
                        {updateMutation.isPending ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="w-8 h-8 text-muted-foreground hover:text-foreground"
                        onClick={cancelEdit}
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="w-8 h-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => startEdit(field.key)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </Card>

        {/* ── Badges ── */}
        <Card className="border-0 shadow-card p-6">
          <h2 className="font-display text-xl mb-4 flex items-center gap-2">
            <Award className="w-4 h-4 text-primary" /> Badges
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: "First Issue", earned: (profile?.total_resolved ?? 0) >= 1, icon: "🏁" },
              { label: "10 Issues", earned: (profile?.total_resolved ?? 0) >= 10, icon: "🌱" },
              { label: "50 Issues", earned: (profile?.total_resolved ?? 0) >= 50, icon: "🔥" },
              { label: "100 Issues", earned: (profile?.total_resolved ?? 0) >= 100, icon: "🏆" },
              { label: "Verified Citizen", earned: !!profile?.is_email_verified, icon: "🛡️" },
              { label: "Early Adopter", earned: true, icon: "⭐" },
            ].map((badge) => (
              <div
                key={badge.label}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                  badge.earned
                    ? "border-primary/30 bg-primary/5"
                    : "border-border bg-muted/30 opacity-40"
                }`}
              >
                <span className="text-2xl">{badge.icon}</span>
                <div>
                  <p className="text-sm font-medium leading-tight">{badge.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {badge.earned ? "Earned" : "Locked"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* ── Stats ── */}
        <div className="grid grid-cols-3 gap-4 pb-6">
          {[
            { label: "Tier", value: tier.name, icon: "🎖️" },
            { label: "Resolved", value: profile?.total_resolved ?? 0, icon: "✅" },
            { label: "Member since", value: profile?.created_at ? new Date(profile.created_at).getFullYear() : "—", icon: "📅" },
          ].map((s) => (
            <Card key={s.label} className="p-5 border-0 shadow-card text-center">
              <p className="text-2xl mb-1">{s.icon}</p>
              <p className="font-display text-xl font-semibold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}