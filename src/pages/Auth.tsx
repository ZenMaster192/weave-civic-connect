import { useRef, useState, useEffect, KeyboardEvent } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { WeaveLogo } from "@/components/WeaveLogo";
import { SKILLS } from "@/lib/mockData";
import {
  ArrowLeft,
  ShieldCheck,
  Mail,
  Phone,
  Upload,
  RefreshCw,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { authApi, usersApi, type UserRole } from "@/services/api";
import { useAuthStore } from "@/store/AuthStore";

type Role = UserRole;

const ROLE_META: Record<
  Role,
  { title: string; devanagari: string; bg: string; tagline: string }
> = {
  citizen: {
    title: "Citizen",
    devanagari: "नागरिक",
    bg: "bg-gradient-citizen",
    tagline: "Report. Track. Resolve.",
  },
  volunteer: {
    title: "Volunteer",
    devanagari: "स्वयंसेवक",
    bg: "bg-gradient-volunteer",
    tagline: "Use your skills. Earn XP.",
  },
  ngo: {
    title: "NGO",
    devanagari: "संस्था",
    bg: "bg-gradient-ngo",
    tagline: "Coordinate. Supervise. Scale.",
  },
};

const API_BASE = import.meta.env.VITE_API_URL ?? "";

// ── OTP digit input ────────────────────────────────────────────────────────
function OtpInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const refs = Array.from({ length: 6 }, () => useRef<HTMLInputElement>(null));

  const digits = value.padEnd(6, "").split("").slice(0, 6);

  const focus = (i: number) => refs[i]?.current?.focus();

  const handleChange = (i: number, raw: string) => {
    const ch = raw.replace(/\D/g, "").slice(-1);
    const next = digits.map((d, idx) => (idx === i ? ch : d)).join("").trimEnd();
    onChange(next);
    if (ch && i < 5) focus(i + 1);
  };

  const handleKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      onChange(digits.slice(0, i - 1).join(""));
      focus(i - 1);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted) {
      onChange(pasted);
      focus(Math.min(pasted.length, 5));
      e.preventDefault();
    }
  };

  return (
    <div className="flex gap-2 justify-center" onPaste={handlePaste}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={refs[i]}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          disabled={disabled}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKey(i, e)}
          onFocus={(e) => e.target.select()}
          className={`
            w-11 h-13 text-center text-xl font-bold rounded-xl border-2 bg-background
            transition-all outline-none focus:border-primary focus:ring-2 focus:ring-primary/20
            disabled:opacity-50 disabled:cursor-not-allowed
            ${d ? "border-primary/60 text-foreground" : "border-border text-muted-foreground"}
          `}
        />
      ))}
    </div>
  );
}

// ── Resend countdown ───────────────────────────────────────────────────────
function useResendCooldown(seconds = 60) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    if (remaining <= 0) return;
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining]);

  const reset = () => setRemaining(seconds);
  return { remaining, canResend: remaining <= 0, reset };
}

// ═══════════════════════════════════════════════════════════════════════════
// Auth page
// ═══════════════════════════════════════════════════════════════════════════

export default function Auth() {
  const { role } = useParams<{ role: Role }>();
  const nav = useNavigate();
  const r: Role = (role as Role) || "citizen";
  const meta = ROLE_META[r];

  const { setAuth, setProfile } = useAuthStore();

  // ── step state ─────────────────────────────────────────────────────────
  const [step, setStep] = useState<"form" | "otp" | "id">("form");

  // ── signup fields ──────────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [orgName, setOrgName] = useState("");
  const [city, setCity] = useState("");

  // ── login fields ───────────────────────────────────────────────────────
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // ── OTP ────────────────────────────────────────────────────────────────
  const [otp, setOtp] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);
  const { remaining, canResend, reset: resetCooldown } = useResendCooldown(60);

  const toggleSkill = (s: string) =>
    setSkills((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );

  // ── Mutations ──────────────────────────────────────────────────────────
  const registerMutation = useMutation({
    mutationFn: () =>
      authApi.register({
        email,
        password,
        full_name: name,
        role: r,
        skills: skills.length ? skills.join(",") : undefined,
        org_name: orgName || undefined,
        city: city || undefined,
      }),
    onSuccess: (token) => {
      setAuth(token);
      if (r === "ngo") {
        toast.success("Account created. Pending NGO approval.");
        nav("/ngo");
      } else {
        setStep("otp");
        toast.success(
          "Account created! Check your email for the verification code."
        );
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const loginMutation = useMutation({
    mutationFn: () => authApi.login(loginEmail, loginPassword),
    onSuccess: async (token) => {
      setAuth(token);
      try {
        const profile = await usersApi.me();
        setProfile(profile);
      } catch (_) {}
      toast.success("Signed in as " + token.full_name);
      nav("/" + token.role);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Real OTP verification against backend
  const verifyOtpMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/api/auth/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Verification failed.");
      return data;
    },
    onSuccess: () => {
      setOtpVerified(true);
      toast.success("Email verified! ✓");
      // Short pause so the success state is visible, then advance
      setTimeout(() => setStep("id"), 800);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Resend OTP
  const resendMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/api/auth/resend-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Could not resend code.");
      return data;
    },
    onSuccess: () => {
      resetCooldown();
      setOtp("");
      toast.success("New code sent — check your inbox.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Handlers ───────────────────────────────────────────────────────────
  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password)
      return toast.error("Name, email and password are required");
    if (r === "volunteer" && skills.length === 0)
      return toast.error("Pick at least one skill");
    if (r === "ngo" && !orgName)
      return toast.error("Organization name is required");
    registerMutation.mutate();
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword)
      return toast.error("Email and password are required");
    loginMutation.mutate();
  };

  const handleOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length < 6) return toast.error("Enter the full 6-digit code.");
    verifyOtpMutation.mutate();
  };

  const handleId = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Identity stored. Welcome to Weave!");
    nav(r === "volunteer" ? "/volunteer" : "/citizen");
  };

  // Auto-submit when all 6 digits are entered
  useEffect(() => {
    if (otp.length === 6 && step === "otp" && !verifyOtpMutation.isPending && !otpVerified) {
      verifyOtpMutation.mutate();
    }
  }, [otp]);

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex">
      {/* Left visual panel */}
      <div
        className={`hidden lg:flex w-1/2 ${meta.bg} relative p-12 flex-col justify-between`}
      >
        <WeaveLogo />
        <div className="max-w-md">
          <p className="font-display text-2xl text-primary/70 mb-2">
            {meta.devanagari}
          </p>
          <h1 className="font-display text-5xl font-semibold leading-tight mb-4">
            Step into Weave as a {meta.title}.
          </h1>
          <p className="text-foreground/75 leading-relaxed">{meta.tagline}</p>
        </div>
        <p className="text-xs text-foreground/60">
          © Weave · A civic fabric for everyday repair.
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col">
        <div className="p-6 flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-smooth"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <div className="lg:hidden">
            <WeaveLogo />
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center px-6 pb-12">
          <Card className="w-full max-w-md p-8 soft-card border-0">
            {/* ── STEP 1: Registration / Login form ── */}
            {step === "form" && (
              <>
                <Badge variant="secondary" className="mb-3">
                  {meta.title} access
                </Badge>
                <h2 className="font-display text-3xl mb-1">Join the weave</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Create your account or sign in.
                </p>

                <Tabs defaultValue="signup">
                  <TabsList className="grid grid-cols-2 w-full mb-6">
                    <TabsTrigger value="signup">Sign up</TabsTrigger>
                    <TabsTrigger value="login">Sign in</TabsTrigger>
                  </TabsList>

                  {/* ── Sign up ── */}
                  <TabsContent value="signup">
                    <form onSubmit={handleSignup} className="space-y-4">
                      <div>
                        <Label htmlFor="name">Full name</Label>
                        <Input
                          id="name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="e.g. Anjali Mehta"
                        />
                      </div>

                      {r === "ngo" && (
                        <div>
                          <Label htmlFor="org">Organization name</Label>
                          <Input
                            id="org"
                            value={orgName}
                            onChange={(e) => setOrgName(e.target.value)}
                            placeholder="e.g. Green Pune Collective"
                          />
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>City</Label>
                          <Input
                            placeholder="Pune"
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label>Age</Label>
                          <Input type="number" placeholder="28" />
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@example.com"
                        />
                      </div>

                      <div>
                        <Label htmlFor="phone">Phone</Label>
                        <Input id="phone" type="tel" placeholder="+91 ..." />
                      </div>

                      <div>
                        <Label htmlFor="pw">Password</Label>
                        <Input
                          id="pw"
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                        />
                      </div>

                      {r === "volunteer" && (
                        <div>
                          <Label className="mb-2 block">Pick your skills</Label>
                          <div className="flex flex-wrap gap-2 max-h-40 overflow-auto p-2 rounded-lg bg-muted/40">
                            {SKILLS.map((s) => (
                              <button
                                type="button"
                                key={s}
                                onClick={() => toggleSkill(s)}
                                className={`px-3 py-1 text-xs rounded-full border transition-smooth ${
                                  skills.includes(s)
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-card hover:bg-secondary border-border"
                                }`}
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                          <Input
                            className="mt-3"
                            placeholder="Profession (optional)"
                          />
                        </div>
                      )}

                      {r === "ngo" && (
                        <>
                          <div>
                            <Label>Establishment year</Label>
                            <Input placeholder="2018" />
                          </div>
                          <div>
                            <Label>Member count</Label>
                            <Input type="number" placeholder="42" />
                          </div>
                          <div>
                            <Label>Registration certificate</Label>
                            <div className="mt-2 border-2 border-dashed border-border rounded-xl p-5 text-center text-sm text-muted-foreground hover:bg-muted/40 transition-smooth cursor-pointer">
                              <Upload className="w-5 h-5 mx-auto mb-1" />
                              Click to upload PDF / image
                            </div>
                          </div>
                          <div className="rounded-xl bg-secondary/60 p-3 text-xs text-secondary-foreground flex gap-2">
                            <ShieldCheck className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            NGO accounts require manual approval before going
                            live.
                          </div>
                        </>
                      )}

                      <Button
                        type="submit"
                        className="w-full"
                        size="lg"
                        disabled={registerMutation.isPending}
                      >
                        {registerMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Creating account…
                          </>
                        ) : (
                          <>
                            Continue · email OTP{" "}
                            <Mail className="w-4 h-4 ml-1" />
                          </>
                        )}
                      </Button>
                    </form>
                  </TabsContent>

                  {/* ── Sign in ── */}
                  <TabsContent value="login">
                    <form className="space-y-4" onSubmit={handleLogin}>
                      <div>
                        <Label>Email</Label>
                        <Input
                          type="email"
                          placeholder="you@example.com"
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Password</Label>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                        />
                      </div>
                      <Button
                        className="w-full"
                        size="lg"
                        disabled={loginMutation.isPending}
                      >
                        {loginMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Signing in…
                          </>
                        ) : (
                          `Sign in as ${meta.title}`
                        )}
                      </Button>
                      <p className="text-xs text-center text-muted-foreground">
                        Seeded demo: anjali@example.com / ravi@example.com /
                        sara@greenpune.org — password: password123
                      </p>
                    </form>
                  </TabsContent>
                </Tabs>
              </>
            )}

            {/* ── STEP 2: Email OTP verification ── */}
            {step === "otp" && (
              <form onSubmit={handleOtpSubmit} className="space-y-6">
                <div>
                  <Badge variant="secondary" className="mb-3">
                    Step 2 of {r === "ngo" ? "2" : "3"}
                  </Badge>
                  <h2 className="font-display text-3xl mb-1">
                    Verify your email
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    We sent a 6-digit code to{" "}
                    <span className="font-medium text-foreground">{email}</span>
                    . It expires in 10 minutes.
                  </p>
                </div>

                {/* OTP digit boxes */}
                <OtpInput
                  value={otp}
                  onChange={setOtp}
                  disabled={verifyOtpMutation.isPending || otpVerified}
                />

                {/* Status feedback */}
                {verifyOtpMutation.isPending && (
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Verifying…
                  </div>
                )}
                {otpVerified && (
                  <div className="flex items-center justify-center gap-2 text-sm text-emerald-600 font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    Email verified!
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={
                    otp.length < 6 ||
                    verifyOtpMutation.isPending ||
                    otpVerified
                  }
                >
                  {verifyOtpMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Verifying…
                    </>
                  ) : otpVerified ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Verified
                    </>
                  ) : (
                    "Verify code"
                  )}
                </Button>

                {/* Resend */}
                <div className="text-center">
                  {canResend ? (
                    <button
                      type="button"
                      onClick={() => resendMutation.mutate()}
                      disabled={resendMutation.isPending}
                      className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline disabled:opacity-50"
                    >
                      {resendMutation.isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                      Resend code
                    </button>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Resend available in{" "}
                      <span className="tabular-nums font-medium">
                        {remaining}s
                      </span>
                    </p>
                  )}
                </div>

                {/* Dev helper */}
                {import.meta.env.DEV && (
                  <p className="text-[11px] text-center text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-3 py-2">
                    <strong>Dev mode:</strong> OTP is printed to the backend
                    console (EMAIL_ENABLED=false). Check your{" "}
                    <code className="font-mono">uvicorn</code> terminal.
                  </p>
                )}
              </form>
            )}

            {/* ── STEP 3: Identity check ── */}
            {step === "id" && (
              <form onSubmit={handleId} className="space-y-4">
                <Badge variant="secondary">Step 3 of 3</Badge>
                <h2 className="font-display text-3xl">Identity check</h2>
                <p className="text-sm text-muted-foreground">
                  Your National ID is hashed before storage and verified by an
                  admin.
                </p>
                <div>
                  <Label>National ID number</Label>
                  <Input placeholder="XXXX-XXXX-XXXX" />
                </div>
                <div className="rounded-xl bg-secondary/60 p-3 text-xs text-secondary-foreground flex gap-2">
                  <Phone className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  Phone OTP would be sent to your linked mobile in production.
                </div>
                {r === "volunteer" && (
                  <div className="rounded-xl bg-pastel-pink/40 p-3 text-xs flex gap-2 items-start">
                    <Checkbox id="ngo-affil" defaultChecked />
                    <label htmlFor="ngo-affil" className="cursor-pointer">
                      I'd like to affiliate with a nearby NGO. We'll suggest
                      options on your dashboard.
                    </label>
                  </div>
                )}
                <Button type="submit" className="w-full" size="lg">
                  Finish & enter Weave
                </Button>
              </form>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}