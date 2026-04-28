// src/pages/Auth.tsx

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
import {InputOTP, InputOTPGroup, InputOTPSlot} from "@/components/ui/input-otp";
import { SKILLS } from "@/lib/skillInference";
import {
  ArrowLeft, ShieldCheck, Mail, Phone,
  Upload, RefreshCw, CheckCircle2, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { authApi, usersApi, type UserRole } from "@/services/api";
import { useAuthStore } from "@/store/AuthStore";

type Role = UserRole;

const ROLE_META: Record<Role, { title: string; devanagari: string; bg: string; tagline: string }> = {
  citizen:   { title: "Citizen",   devanagari: "नागरिक",    bg: "bg-gradient-citizen",   tagline: "Report. Track. Resolve." },
  volunteer: { title: "Volunteer", devanagari: "स्वयंसेवक", bg: "bg-gradient-volunteer", tagline: "Use your skills. Earn XP." },
  ngo:       { title: "NGO",       devanagari: "संस्था",    bg: "bg-gradient-ngo",       tagline: "Coordinate. Supervise. Scale." },
};


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

export default function Auth() {
  const { role } = useParams<{ role: Role }>();
  const nav = useNavigate();
  const r: Role = (role as Role) || "citizen";
  const meta = ROLE_META[r];
  const { setAuth, setProfile } = useAuthStore();

  const [step, setStep] = useState<"form" | "otp" | "id">("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [orgName, setOrgName] = useState("");
  const [city, setCity] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const { remaining, canResend, reset: resetCooldown } = useResendCooldown(60);

  const toggleSkill = (s: string) =>
    setSkills((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);

  const registerMutation = useMutation({
    mutationFn: () => authApi.register({
      email, password, full_name: name, role: r,
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
        toast.success("Account created! Check your uvicorn terminal for the OTP code.");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const loginMutation = useMutation({
    mutationFn: () => authApi.login(loginEmail, loginPassword),
    onSuccess: async (token) => {
      setAuth(token);
      try { const profile = await usersApi.me(); setProfile(profile); } catch (_) {}
      toast.success("Signed in as " + token.full_name);
      nav("/" + token.role);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const verifyOtpMutation = useMutation({
    mutationFn: () => authApi.verifyEmail(email, otp),
    onSuccess: () => {
      setOtpVerified(true);
      toast.success("Email verified! ✓");
      if (r === "volunteer" && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => {} // silent fail — user can update from profile later
        );
      }
      setTimeout(() => setStep("id"), 800);
    },
    onError: (e: Error) => toast.error(e.message),
  });      

  const resendMutation = useMutation({
    mutationFn: () => authApi.resendOtp(email),
    onSuccess: () => { resetCooldown(); setOtp(""); toast.success("New code sent — check your uvicorn terminal."); },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) return toast.error("Name, email and password are required");
    if (r === "volunteer" && skills.length === 0) return toast.error("Pick at least one skill");
    if (r === "ngo" && !orgName) return toast.error("Organization name is required");
    registerMutation.mutate();
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) return toast.error("Email and password are required");
    loginMutation.mutate();
  };

  const handleOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length < 6) return toast.error("Enter the full 6-digit code.");
    verifyOtpMutation.mutate();
  };

const handleId = async (e: React.FormEvent) => {
    e.preventDefault();
    // If we captured GPS, save it to the volunteer's profile before navigating
    if (r === "volunteer" && gpsCoords) {
      try {
        await usersApi.updateMe({ latitude: gpsCoords.lat, longitude: gpsCoords.lng });
      } catch (_) { /* non-fatal — they can set it from profile page */ }
    }
    toast.success("Identity stored. Welcome to Weave!");
    nav(r === "volunteer" ? "/volunteer" : "/citizen");
  };
  
  useEffect(() => {
    if (otp.length === 6 && step === "otp" && !verifyOtpMutation.isPending && !otpVerified) {
      verifyOtpMutation.mutate();
    }
  }, [otp]);

  return (
    <div className="min-h-screen flex">
      <div className={`hidden lg:flex w-1/2 ${meta.bg} relative p-12 flex-col justify-between`}>
        <WeaveLogo />
        <div className="max-w-md">
          <p className="font-display text-2xl text-primary/70 mb-2">{meta.devanagari}</p>
          <h1 className="font-display text-5xl font-semibold leading-tight mb-4">Step into Weave as a {meta.title}.</h1>
          <p className="text-foreground/75 leading-relaxed">{meta.tagline}</p>
        </div>
        <p className="text-xs text-foreground/60">© Weave · A civic fabric for everyday repair.</p>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="p-6 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-smooth">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <div className="lg:hidden"><WeaveLogo /></div>
        </div>

        <div className="flex-1 flex items-center justify-center px-6 pb-12">
          <Card className="w-full max-w-md p-8 soft-card border-0">

            {step === "form" && (
              <>
                <Badge variant="secondary" className="mb-3">{meta.title} access</Badge>
                <h2 className="font-display text-3xl mb-1">Join the weave</h2>
                <p className="text-sm text-muted-foreground mb-6">Create your account or sign in.</p>

                <Tabs defaultValue="signup">
                  <TabsList className="grid grid-cols-2 w-full mb-6">
                    <TabsTrigger value="signup">Sign up</TabsTrigger>
                    <TabsTrigger value="login">Sign in</TabsTrigger>
                  </TabsList>

                  <TabsContent value="signup">
                    <form onSubmit={handleSignup} className="space-y-4">
                      {r === "ngo" ? (
                        <>
                          <div>
                            <Label htmlFor="org">Organization name</Label>
                            <Input id="org" value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="e.g. Green Bhubaneswar Collective" />
                          </div>
                          <div>
                            <Label htmlFor="email">Organisation Email</Label>
                            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                          </div>                          
                          <div>
                            <Label>City</Label>
                            <Input placeholder="Bhubaneswar" value={city} onChange={(e) => setCity(e.target.value)} />
                          </div>
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
                              <Upload className="w-5 h-5 mx-auto mb-1" />Click to upload PDF / image
                            </div>
                          </div>
                          <div>
                            <Label htmlFor="name">Name of representative</Label>
                            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dishashree Swain" />
                          </div>
                          <div>
                            <Label>Age of representative</Label>
                            <Input type="number" placeholder="28" />
                          </div>
                          <div>
                            <Label htmlFor="phone">Phone</Label>
                            <Input id="phone" type="tel" placeholder="+91 ..." />
                          </div>
                          <div>
                            <Label htmlFor="pw">Password</Label>
                            <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                          </div>
                          <div className="rounded-xl bg-secondary/60 p-3 text-xs text-secondary-foreground flex gap-2">
                            <ShieldCheck className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            NGO accounts require manual approval before going live.
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <Label htmlFor="name">Full name</Label>
                            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dishashree Swain" />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div><Label>City</Label><Input placeholder="Bhubaneswar" value={city} onChange={(e) => setCity(e.target.value)} /></div>
                            <div><Label>Age</Label><Input type="number" placeholder="28" /></div>
                          </div>
                          <div>
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                          </div>
                          <div>
                            <Label htmlFor="phone">Phone</Label>
                            <Input id="phone" type="tel" placeholder="+91 ..." />
                          </div>
                          <div>
                            <Label htmlFor="pw">Password</Label>
                            <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                          </div>

                          {r === "volunteer" && (
                            <div>
                              <Label className="mb-2 block">Pick your skills</Label>
                              <div className="flex flex-wrap gap-2 max-h-40 overflow-auto p-2 rounded-lg bg-muted/40">
                                {SKILLS.map((s) => (
                                  <button type="button" key={s} onClick={() => toggleSkill(s)}
                                    className={`px-3 py-1 text-xs rounded-full border transition-smooth ${skills.includes(s) ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-secondary border-border"}`}>
                                    {s}
                                  </button>
                                ))}
                              </div>
                              <Input className="mt-3" placeholder="Profession (optional)" />
                            </div>
                          )}
                        </>
                      )}
                      <Button type="submit" className="w-full" size="lg" disabled={registerMutation.isPending}>
                        {registerMutation.isPending
                          ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating account…</>
                          : <>Continue · email OTP <Mail className="w-4 h-4 ml-1" /></>}
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="login">
                    <form className="space-y-4" onSubmit={handleLogin}>
                      <div><Label>Email</Label><Input type="email" placeholder="you@example.com" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} /></div>
                      <div><Label>Password</Label><Input type="password" placeholder="••••••••" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} /></div>
                      <Button className="w-full" size="lg" disabled={loginMutation.isPending}>
                        {loginMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Signing in…</> : `Sign in as ${meta.title}`}
                      </Button>
                      <p className="text-xs text-center text-muted-foreground">
                        Seeded demo: anjali@example.com / ravi@example.com / sara@greenbbsr.org — password: password123
                      </p>
                    </form>
                  </TabsContent>
                </Tabs>
              </>
            )}

            {step === "otp" && (
              <form onSubmit={handleOtpSubmit} className="space-y-6">
                <div>
                  <Badge variant="secondary" className="mb-3">Step 2 of 3</Badge>
                  <h2 className="font-display text-3xl mb-1">Verify your email</h2>
                  <p className="text-sm text-muted-foreground">
                    A 6-digit code was sent to <span className="font-medium text-foreground">{email}</span>.
                    Check your <span className="font-medium text-foreground">uvicorn terminal</span> for the code.
                  </p>
                </div>

                <div className="flex justify-center py-4">
                <InputOTP
                  maxLength={6}
                  value={otp}
                  onChange={setOtp}
                  disabled={verifyOtpMutation.isPending || otpVerified}
                >
                  <InputOTPGroup className="gap-2">
                    <InputOTPSlot index={0} className="w-12 h-12 text-xl rounded-md border-2" />
                    <InputOTPSlot index={1} className="w-12 h-12 text-xl rounded-md border-2" />
                    <InputOTPSlot index={2} className="w-12 h-12 text-xl rounded-md border-2" />
                    <InputOTPSlot index={3} className="w-12 h-12 text-xl rounded-md border-2" />
                    <InputOTPSlot index={4} className="w-12 h-12 text-xl rounded-md border-2" />
                    <InputOTPSlot index={5} className="w-12 h-12 text-xl rounded-md border-2" />
                  </InputOTPGroup>
                </InputOTP>
              </div>

                {verifyOtpMutation.isPending && (
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />Verifying…
                  </div>
                )}
                {otpVerified && (
                  <div className="flex items-center justify-center gap-2 text-sm text-emerald-600 font-medium">
                    <CheckCircle2 className="w-4 h-4" />Email verified!
                  </div>
                )}

                <Button type="submit" className="w-full" size="lg"
                  disabled={otp.length < 6 || verifyOtpMutation.isPending || otpVerified}>
                  {verifyOtpMutation.isPending
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying…</>
                    : otpVerified
                      ? <><CheckCircle2 className="w-4 h-4 mr-2" />Verified</>
                      : "Verify code"}
                </Button>

                <div className="text-center">
                  {canResend
                    ? <button type="button" onClick={() => resendMutation.mutate()} disabled={resendMutation.isPending}
                        className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline disabled:opacity-50">
                        {resendMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                        Resend code
                      </button>
                    : <p className="text-xs text-muted-foreground">Resend available in <span className="tabular-nums font-medium">{remaining}s</span></p>
                  }
                </div>

                <div className="rounded-lg px-3 py-2 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 text-[11px] text-center">
                  <strong>Dev mode:</strong> look for <code className="font-mono">&gt;&gt;&gt; OTP CODE: XXXXXX &lt;&lt;&lt;</code> in your uvicorn terminal.
                </div>
              </form>
            )}

            {step === "id" && (
              <form onSubmit={handleId} className="space-y-4">
                <Badge variant="secondary">Step 3 of 3</Badge>
                <h2 className="font-display text-3xl">Identity check</h2>
                <p className="text-sm text-muted-foreground">Your National ID is hashed before storage and verified by an admin.</p>
                <div><Label>National ID number</Label><Input placeholder="XXXX-XXXX-XXXX" /></div>
                <div className="rounded-xl bg-secondary/60 p-3 text-xs text-secondary-foreground flex gap-2">
                  <Phone className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  Phone OTP would be sent to your linked mobile in production.
                </div>
                {r === "volunteer" && (
                  <div className="rounded-xl bg-pastel-pink/40 p-3 text-xs flex gap-2 items-start">
                    <Checkbox id="ngo-affil" defaultChecked />
                    <label htmlFor="ngo-affil" className="cursor-pointer">
                      I'd like to affiliate with a nearby NGO. We'll suggest options on your dashboard.
                    </label>
                  </div>
                )}
                <Button type="submit" className="w-full" size="lg">Finish & enter Weave</Button>
              </form>
            )}

          </Card>
        </div>
      </div>
    </div>
  );
}