import { Link } from "react-router-dom";
import { Users, HandHeart, Building2, ArrowRight, MapPin, Sparkles, ShieldCheck } from "lucide-react";
import { WeaveLogo } from "@/components/WeaveLogo";

const ROLES = [
  {
    to: "/auth/citizen",
    title: "Citizen",
    devanagari: "नागरिक",
    desc: "Report civic issues in your neighborhood and follow them to resolution.",
    icon: Users,
    bg: "bg-gradient-citizen",
  },
  {
    to: "/auth/volunteer",
    title: "Volunteer",
    devanagari: "स्वयंसेवक",
    desc: "Pick up issues that match your skills and earn XP for every fix.",
    icon: HandHeart,
    bg: "bg-gradient-volunteer",
  },
  {
    to: "/auth/ngo",
    title: "NGO",
    devanagari: "संस्था",
    desc: "Coordinate volunteers, supervise impact, and grow your community reach.",
    icon: Building2,
    bg: "bg-gradient-ngo",
  },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Decorative gradient blobs */}
      <div className="absolute -top-32 -left-32 w-[480px] h-[480px] bg-pastel-green rounded-full blur-3xl opacity-50" />
      <div className="absolute top-40 -right-40 w-[520px] h-[520px] bg-pastel-pink rounded-full blur-3xl opacity-40" />
      <div className="absolute bottom-0 left-1/3 w-[420px] h-[420px] bg-pastel-blue rounded-full blur-3xl opacity-40" />

      <div className="relative">
        <header className="container py-6 flex items-center justify-between">
          <WeaveLogo />
          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#how" className="hover:text-foreground transition-smooth">How it works</a>
            <a href="#impact" className="hover:text-foreground transition-smooth">Impact</a>
            <Link to="/auth/citizen" className="text-foreground font-medium">Sign in →</Link>
          </nav>
        </header>

        <section className="container pt-12 pb-20 text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-card border border-border shadow-soft mb-6 animate-fade-in">
            <Sparkles className="w-3.5 h-3.5 text-accent" />
            <span className="text-xs font-medium tracking-wide">A civic fabric, woven by people</span>
          </div>
          <h1 className="font-display text-5xl md:text-7xl font-semibold leading-[1.05] tracking-tight animate-fade-in">
            Real problems.<br />
            <span className="text-primary">Real neighbors.</span> Real fixes.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto animate-fade-in">
            Weave connects citizens, skilled volunteers, and NGOs into one transparent loop —
            from a snapped photo of a pothole to a verified, before-and-after resolution.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2"><MapPin className="w-4 h-4 text-primary" /> Geo-matched</span>
            <span className="inline-flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-primary" /> Identity verified</span>
            <span className="inline-flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Smart classification</span>
          </div>
        </section>

        <section id="how" className="container pb-24">
          <p className="text-center text-sm uppercase tracking-[0.25em] text-muted-foreground mb-3">
            Choose your role
          </p>
          <h2 className="text-center font-display text-3xl md:text-4xl mb-12">
            Where do you fit in the weave?
          </h2>

          <div className="grid md:grid-cols-3 gap-6">
            {ROLES.map((r, i) => {
              const Icon = r.icon;
              return (
                <Link
                  key={r.to}
                  to={r.to}
                  className="group soft-card p-8 relative overflow-hidden animate-fade-in"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <div className={`absolute inset-0 ${r.bg} opacity-60 group-hover:opacity-90 transition-smooth`} />
                  <div className="relative">
                    <div className="w-14 h-14 rounded-2xl bg-card shadow-soft flex items-center justify-center mb-6 group-hover:animate-float">
                      <Icon className="w-7 h-7 text-primary" />
                    </div>
                    <p className="font-display text-sm text-primary/70 mb-1">{r.devanagari}</p>
                    <h3 className="font-display text-3xl font-semibold mb-3">{r.title}</h3>
                    <p className="text-sm text-foreground/75 mb-8 leading-relaxed">{r.desc}</p>
                    <div className="inline-flex items-center gap-2 text-sm font-medium text-primary">
                      Continue as {r.title} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-smooth" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <footer className="container py-10 border-t border-border/60 text-center text-sm text-muted-foreground">
          <p>Weave · woven together for a better street, block, and city.</p>
        </footer>
      </div>
    </div>
  );
};

export default Index;
