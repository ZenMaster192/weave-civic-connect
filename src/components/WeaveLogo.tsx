import { Link } from "react-router-dom";

export const WeaveLogo = ({ className = "" }: { className?: string }) => (
  <Link to="/" className={`inline-flex items-center gap-2 ${className}`}>
    <img 
      src="/logo.png" 
      alt="Weave Logo" 
      className="w-9 h-9 object-contain" 
    />
    <span className="mt-1 font-display text-2xl font-semibold tracking-tight text-foreground">
      Weave
    </span>
  </Link>
);
