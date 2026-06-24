import { type ButtonHTMLAttributes } from "react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "cyan" | "magenta" | "volt";
  size?: "sm" | "md" | "lg";
}

const VARIANT: Record<NonNullable<Props["variant"]>, string> = {
  cyan: [
    "text-neon-cyan border-neon-cyan/40",
    "hover:border-neon-cyan/80 hover:shadow-neon-cyan",
    "focus-visible:border-neon-cyan focus-visible:shadow-neon-cyan",
  ].join(" "),
  magenta: [
    "text-neon-magenta border-neon-magenta/40",
    "hover:border-neon-magenta/80 hover:shadow-neon-magenta",
    "focus-visible:border-neon-magenta focus-visible:shadow-neon-magenta",
  ].join(" "),
  volt: [
    "text-neon-volt border-neon-volt/40",
    "hover:border-neon-volt/80 hover:shadow-neon-volt",
    "focus-visible:border-neon-volt focus-visible:shadow-neon-volt",
  ].join(" "),
};

const SIZE: Record<NonNullable<Props["size"]>, string> = {
  sm: "px-4 py-1.5 text-xs",
  md: "px-6 py-2.5 text-sm",
  lg: "px-10 py-4 text-xl",
};

export function NeonButton({
  variant = "cyan",
  size = "md",
  className = "",
  children,
  ...rest
}: Props) {
  return (
    <button
      className={[
        "holo-card relative overflow-hidden",
        "font-display tracking-wider uppercase border",
        "transition-all duration-200",
        "hover:bg-white/5 active:scale-95",
        "disabled:opacity-40 disabled:pointer-events-none",
        "focus-visible:outline-none",
        VARIANT[variant],
        SIZE[size],
        className,
      ].join(" ")}
      {...rest}
    >
      {/* shimmer line that sweeps across on hover */}
      <span
        aria-hidden="true"
        className={[
          "pointer-events-none absolute inset-0",
          "before:absolute before:inset-y-0 before:-left-full before:w-1/2",
          "before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent",
          "before:skew-x-[-20deg]",
          "group-hover:before:translate-x-[250%] before:transition-transform before:duration-500 before:ease-out",
        ].join(" ")}
      />
      <span className="relative z-10">{children}</span>
    </button>
  );
}
