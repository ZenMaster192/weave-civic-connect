import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { WeaveLogo } from "@/components/WeaveLogo";
import { SKILLS } from "@/lib/mockData"; // keep SKILLS constant only
import { ArrowLeft, ShieldCheck, Mail, Phone, Upload } from "lucide-react";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { authApi, usersApi, type UserRole } from "@/services/api";
import { useAuthStore } from "@/store/AuthStore";

type Role = UserRole;

const ROLE_META: Record<Role, { title: string; devanagari: string; bg: string; tagline: string }> = {
  citizen: { title: "Citizen", devanagari: "नागरिक", bg: "bg-gradient-citizen", tagline: "Report. Track. Resolve." },
  volunteer: { title: "Volunteer", devanagari: "स्वयंसेवक", bg: "bg-gradient-volunteer", tagline: "Use your skills. Earn XP." },
  ngo: { title: "NGO", devanagari: "संस्था", bg: "bg-gradient-ngo", tagline: "Coordinate. Supervise. Scale." },
};

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
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [orgName, setOrgName] = useState("");
  const [city, setCity] = useState("");

  const toggleSkill = (s: string) =>
    setSkills((prev) => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  // ── Mutations ────────────────────────────────────────────────
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
      // Proceed to OTP step (simulated — backend doesn't do OTP yet)
      if (r === "ngo") {
        toast.success("Account created. Pending NGO approval.");
        nav("/ngo");
      } else {
        setStep("otp");
        toast.success("Account created! (OTP step is a UI stub)");
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

  // ── Handlers ─────────────────────────────────────────────────
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

  // OTP + ID steps are UI stubs; on completion just navigate
  const handleOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setStep("id");
  };

  const handleId = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Identity stub stored. Welcome to Weave!");
    nav(r === "volunteer" ? "/volunteer" : "/citizen");
  };

  return (
    <div className="min-h-screen flex">
      {/* Left visual */}
      <div className={`hidden lg:flex w-1/2 ${meta.bg} relative p-12 flex-col justify-between`}>
        <WeaveLogo />
        <div className="max-w-md">
          <p className="font-display text-2xl text-primary/70 mb-2">{meta.devanagari}</p>
          <h1 className="font-display text-5xl font-semibold leading-tight mb-4">
            Step into Weave as a {meta.title}.
          </h1>
          <p className="text-foreground/75 leading-relaxed">{meta.tagline}</p>
        </div>
        <p className="text-xs text-foreground/60">© Weave · A civic fabric for everyday repair.</p>
      </div>

      {/* Right form */}
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
                      <div>
                        <Label htmlFor="name">Full name</Label>
                        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Anjali Mehta" />
                      </div>
                      {r === "ngo" && (
                        <div>
                          <Label htmlFor="org">Organization name</Label>
                          <Input id="org" value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="e.g. Green Pune Collective" />
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>City</Label>
                          <Input placeholder="Pune" value={city} onChange={(e) => setCity(e.target.value)} />
                        </div>
                        <div>
                          <Label>Age</Label>
                          <Input type="number" placeholder="28" />
                        </div>
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
                            {SKILLS.map(s => (
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
                          <Input className="mt-3" placeholder="Profession (optional)" />
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
                            NGO accounts require manual approval before going live.
                          </div>
                        </>
                      )}

                      <Button type="submit" className="w-full" size="lg" disabled={registerMutation.isPending}>
                        {registerMutation.isPending ? "Creating account…" : <>Continue · email OTP <Mail className="w-4 h-4 ml-1" /></>}
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="login">
                    <form className="space-y-4" onSubmit={handleLogin}>
                      <div>
                        <Label>Email</Label>
                        <Input type="email" placeholder="you@example.com" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
                      </div>
                      <div>
                        <Label>Password</Label>
                        <Input type="password" placeholder="••••••••" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
                      </div>
                      <Button className="w-full" size="lg" disabled={loginMutation.isPending}>
                        {loginMutation.isPending ? "Signing in…" : `Sign in as ${meta.title}`}
                      </Button>
                      <p className="text-xs text-center text-muted-foreground">
                        Seeded demo: anjali@example.com / ravi@example.com / sara@greenpune.org — password: password123
                      </p>
                    </form>
                  </TabsContent>
                </Tabs>
              </>
            )}

            {step === "otp" && (
              <form onSubmit={handleOtp} className="space-y-4">
                <Badge variant="secondary">Step 2 of {r === "ngo" ? "2" : "3"}</Badge>
                <h2 className="font-display text-3xl">Verify your email</h2>
                <p className="text-sm text-muted-foreground">We sent a 6-digit code to <b>{email}</b>. Use <b>123456</b> in this prototype.</p>
                <Input placeholder="6-digit code" maxLength={6} className="text-center tracking-[0.6em] text-lg" defaultValue="123456" />
                <Button type="submit" className="w-full" size="lg">Verify</Button>
              </form>
            )}

            {step === "id" && (
              <form onSubmit={handleId} className="space-y-4">
                <Badge variant="secondary">Step 3 of 3</Badge>
                <h2 className="font-display text-3xl">Identity check</h2>
                <p className="text-sm text-muted-foreground">
                  Your National ID is hashed before storage and verified by an admin (prototype stub — no real KYC).
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