"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSessionStore } from "@/stores/sessionStore";

const LINKS = [
  { href: "/", label: "HOME" },
  { href: "/play", label: "RACE" },
  { href: "/garage", label: "GARAGE" },
  { href: "/leaderboard", label: "STANDINGS" },
];

const TIER_COLORS = {
  STREET: "text-white/60",
  UNDERGROUND: "text-neon-cyan",
  SYNDICATE: "text-neon-magenta",
  LEGEND: "text-neon-volt",
};

export function NavBar() {
  const pathname = usePathname();
  const profile = useSessionStore((s) => s.profile);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3 bg-void/80 backdrop-blur-md border-b border-neon-cyan/10">
      <Link href="/" className="font-display text-lg text-neon-cyan tracking-widest">
        DRIFT<span className="text-neon-magenta">://</span>PROTOCOL
      </Link>

      <div className="flex items-center gap-6">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`font-display text-xs tracking-widest transition-colors ${
              pathname === l.href ? "text-neon-volt" : "text-white/50 hover:text-white"
            }`}
          >
            {l.label}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-3">
        {profile ? (
          <>
            <span className={`font-display text-xs ${TIER_COLORS[profile.repTier]}`}>
              {profile.repTier}
            </span>
            <span className="font-display text-sm text-white">{profile.handle}</span>
            <span className="font-display text-xs text-neon-volt tabular-nums">
              ₵{Number(profile.credits).toLocaleString()}
            </span>
            <span className="holo-card px-2 py-0.5 font-display text-xs text-white/60">
              LVL {profile.level}
            </span>
          </>
        ) : (
          <span className="font-display text-xs text-white/30 animate-pulse">CONNECTING…</span>
        )}
      </div>
    </nav>
  );
}
