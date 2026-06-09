import { type ButtonHTMLAttributes } from "react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "cyan" | "magenta" | "volt";
  size?: "sm" | "md" | "lg";
}

const VARIANT = {
  cyan: "text-neon-cyan hover:shadow-neon-cyan border-neon-cyan/40",
  magenta: "text-neon-magenta hover:shadow-neon-magenta border-neon-magenta/40",
  volt: "text-neon-volt hover:shadow-neon-cyan border-neon-volt/40",
};

const SIZE = {
  sm: "px-4 py-1.5 text-xs",
  md: "px-6 py-2.5 text-sm",
  lg: "px-10 py-4 text-xl",
};

export function NeonButton({ variant = "cyan", size = "md", className = "", children, ...rest }: Props) {
  return (
    <button
      className={`holo-card font-display tracking-wider border transition-shadow disabled:opacity-40
        ${VARIANT[variant]} ${SIZE[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
