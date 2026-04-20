// src/pages/NgoProfile.tsx
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
  Building2,
  Mail,
  MapPin,
  Pencil,
  Check,
  X,
  Camera,
  Loader2,
  Users,
  ShieldCheck,
  Clock,
  CheckCircle2,
  Upload,
  FileText,
  Globe,
  Star,
  TrendingUp,
} from "lucide-react";

type NGOTier = "Emerging" | "Active" | "Impact" | "Elite";

function getNGOTier(resolved: number): NGOTier {
  if (resolved >= 200) return "Elite";
  if (resolved >= 75) return "Impact";
  if (resolved >= 20) return "Active";
  return "Emerging";
}

const NGO_TIER_META: Record<NGOTier, { color: string; description: string }> = {
  Emerging: { color: "bg-slate-400", description: "Getting started in civic action" },
  Active: { color: "bg-emerald-500", description: "Consistently resolving local issues" },
  Impact: { color: "bg-blue-500", description: "Significant community impact" },
  Elite: { color: "bg-amber-500", description: "Top-tier civic organisation" },
};

export default function NgoProfile() {
  const { token, profile: cachedProfile, setProfile } = useAuthStore();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);

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

  // Inline editing
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

  const tier = getNGOTier(profile?.total_resolved ?? 0);
  const tierMeta = NGO_TIER_META[tier];

  // Document upload (UI only — no real upload in frontend-only mode)
  const [uploadedDocs, setUploadedDocs] = useState<string[]>([]);

  const handleDocUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length) {
      setUploadedDocs((prev) => [...prev, ...files.map((f) => f.name)]);
      toast.success(`${files.length} document(s) queued for upload.`);
    }
  };

  if (isLoading) {
    return (
      <AppShell role="ngo">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  const statusColors: Record<string, string> = {
    approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    rejected: "bg-red-50 text-red-700 border-red-200",
  };
  const ngoStatus = profile?.ngo_status ?? "pending";
  const statusColor = statusColors[ngoStatus] ?? statusColors.pending;

  return (
    <AppShell role="ngo">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* ── Hero ── */}
        <Card className="border-0 shadow-card overflow-hidden">
          <div className="h-28 bg-gradient-ngo relative" />
          <div className="px-8 pb-8 relative">
            {/* Logo avatar */}
            <div className="relative -mt-12 mb-4 w-fit">
              <div className="w-24 h-24 rounded-2xl bg-card border-4 border-background shadow-lg flex items-center justify-center">
                <Building2 className="w-10 h-10 text-primary" />
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
                  {profile?.org_name ?? profile?.full_name}
                </h1>
                <p className="text-muted-foreground text-sm mt-0.5">
                  Managed by {profile?.full_name}
                </p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge className={`${tierMeta.color} border-0 text-white`}>
                    <Star className="w-3 h-3 mr-1" />
                    {tier}
                  </Badge>
                  <span
                    className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium ${statusColor}`}
                  >
                    {ngoStatus === "approved" ? (
                      <CheckCircle2 className="w-3 h-3" />
                    ) : ngoStatus === "pending" ? (
                      <Clock className="w-3 h-3" />
                    ) : (
                      <X className="w-3 h-3" />
                    )}
                    {ngoStatus.charAt(0).toUpperCase() + ngoStatus.slice(1)}
                  </span>
                </div>
              </div>

              <div className="flex gap-6 text-center">
                <div>
                  <p className="text-3xl font-display font-bold text-primary">
                    {profile?.total_resolved ?? 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Issues resolved</p>
                </div>
              </div>
            </div>

            <p className="text-sm text-muted-foreground mt-3 italic">{tierMeta.description}</p>
          </div>
        </Card>

        {/* ── Verification status notice ── */}
        {ngoStatus === "pending" && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
            <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-400 text-sm">
                Verification pending
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
                Your NGO account is under review. You'll receive an email once approved. This usually takes 1–3 business days.
              </p>
            </div>
          </div>
        )}

        {/* ── Organisation details ── */}
        <Card className="border-0 shadow-card p-6">
          <h2 className="font-display text-xl mb-4 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" /> Organisation Details
          </h2>
          <div className="space-y-0">
            {[
              { key: "org_name", label: "Organisation Name", icon: Building2 },
              { key: "full_name", label: "Contact Person (Admin)", icon: Users },
              { key: "email", label: "Email Address", icon: Mail, type: "email" },
              { key: "city", label: "City / Location", icon: MapPin },
              { key: "bio", label: "About the NGO", icon: Globe },
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
                        onChange={(e) =>
                          setDraftValues((p) => ({ ...p, [key]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveField(key);
                          if (e.key === "Escape") setEditing(null);
                        }}
                        className="h-8 text-sm mt-0.5"
                      />
                    ) : (
                      <p className="text-sm font-medium truncate">
                        {value || (
                          <span className="text-muted-foreground italic">Not set</span>
                        )}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    {isEditingThis ? (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="w-8 h-8 text-emerald-600 hover:bg-emerald-50"
                          onClick={() => saveField(key)}
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
                          className="w-8 h-8"
                          onClick={() => setEditing(null)}
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="w-8 h-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => startEdit(key)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* ── Documents ── */}
        <Card className="border-0 shadow-card p-6">
          <h2 className="font-display text-xl mb-1 flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" /> Verification Documents
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Upload registration certificates, proof of establishment, or government-issued NGO ID.
          </p>

          {uploadedDocs.length > 0 && (
            <div className="space-y-2 mb-4">
              {uploadedDocs.map((name, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border"
                >
                  <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <p className="text-sm flex-1 truncate">{name}</p>
                  <Badge variant="secondary" className="text-xs">Queued</Badge>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => docRef.current?.click()}
            className="w-full border-2 border-dashed border-border rounded-xl p-6 text-center text-sm text-muted-foreground hover:bg-muted/40 hover:border-primary/40 transition-all group cursor-pointer"
          >
            <Upload className="w-6 h-6 mx-auto mb-2 group-hover:text-primary transition-colors" />
            <span className="block font-medium group-hover:text-foreground transition-colors">
              Click to upload documents
            </span>
            <span className="text-xs">PDF, JPG, PNG up to 10MB each</span>
          </button>
          <input
            ref={docRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png"
            className="hidden"
            onChange={handleDocUpload}
          />
        </Card>

        {/* ── Impact stats ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pb-6">
          {[
            { label: "Tier", value: tier, icon: "🏅" },
            { label: "Resolved", value: profile?.total_resolved ?? 0, icon: "✅" },
            { label: "Status", value: ngoStatus.charAt(0).toUpperCase() + ngoStatus.slice(1), icon: ngoStatus === "approved" ? "🛡️" : "⏳" },
            { label: "Since", value: profile?.created_at ? new Date(profile.created_at).getFullYear() : "—", icon: "📅" },
          ].map((s) => (
            <Card key={s.label} className="p-5 border-0 shadow-card text-center">
              <p className="text-2xl mb-1">{s.icon}</p>
              <p className="font-display text-lg font-semibold leading-tight">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}