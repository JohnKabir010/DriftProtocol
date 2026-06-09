import { type ReactNode } from "react";

interface Props {
  children: ReactNode;
  className?: string;
  glow?: "cyan" | "magenta" | "volt";
}

const GLOW = {
  cyan: "shadow-neon-cyan border-neon-cyan/30",
  magenta: "shadow-neon-magenta border-neon-magenta/30",
  volt: "border-neon-volt/30",
};

export function HoloCard({ children, className = "", glow }: Props) {
  return (
    <div className={`holo-card ${glow ? GLOW[glow] : "border-neon-cyan/20"} ${className}`}>
      {children}
    </div>
  );
}
