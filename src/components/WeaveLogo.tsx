import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";

export const WeaveLogo = ({ className = "" }: { className?: string }) => (
  <Link to="/" className={`inline-flex items-center gap-2 ${className}`}>
    <div className="relative w-9 h-9 rounded-xl bg-gradient-accent flex items-center justify-center shadow-soft">
      <Sparkles className="w-5 h-5 text-foreground" strokeWidth={2.2} />
    </div>
    <span className="font-display text-2xl font-semibold tracking-tight text-foreground">
      Weave
    </span>
  </Link>
);
