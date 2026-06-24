import { type ReactNode } from "react";

interface Props {
  children: ReactNode;
  className?: string;
  glow?: "cyan" | "magenta" | "volt";
  variant?: "default" | "bright" | "dark";
}

const GLOW: Record<NonNullable<Props["glow"]>, string> = {
  cyan: "shadow-neon-cyan border-neon-cyan/30 hover:shadow-neon-cyan hover:border-neon-cyan/60",
  magenta:
    "shadow-neon-magenta border-neon-magenta/30 hover:shadow-neon-magenta hover:border-neon-magenta/60",
  volt: "shadow-neon-volt border-neon-volt/30 hover:shadow-neon-volt hover:border-neon-volt/60",
};

const VARIANT: Record<NonNullable<Props["variant"]>, string> = {
  default: "bg-surface",
  bright: "bg-surface-hi",
  dark: "bg-void/80",
};

export function HoloCard({
  children,
  className = "",
  glow,
  variant = "default",
}: Props) {
  return (
    <div
      className={[
        "holo-card",
        "transition-all duration-200",
        "hover:brightness-110",
        VARIANT[variant],
        glow ? GLOW[glow] : "border-neon-cyan/20",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}
