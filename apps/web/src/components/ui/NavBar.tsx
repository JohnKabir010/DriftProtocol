"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSessionStore } from "@/stores/sessionStore";
import { api } from "@/lib/api";

const MOBILE_LINKS = [
  { href: "/", label: "HOME" },
  { href: "/tracks", label: "TRACKS" },
  { href: "/bot-race", label: "VS BOTS" },
  { href: "/play", label: "RACE" },
  { href: "/garage", label: "GARAGE" },
  { href: "/factions", label: "FACTIONS" },
  { href: "/districts", label: "DISTRICTS" },
  { href: "/market", label: "MARKET" },
  { href: "/betting", label: "BETS" },
  { href: "/tournaments", label: "TOURNAMENTS" },
  { href: "/wallet", label: "WALLET" },
  { href: "/leaderboard", label: "STANDINGS" },
];

const LINKS = [
  { href: "/", label: "HOME" },
  { href: "/tracks", label: "TRACKS" },
  { href: "/bot-race", label: "VS BOTS" },
  { href: "/play", label: "RACE" },
  { href: "/garage", label: "GARAGE" },
  { href: "/factions", label: "FACTIONS" },
  { href: "/districts", label: "DISTRICTS" },
  { href: "/market", label: "MARKET" },
  { href: "/betting", label: "BETS" },
  { href: "/tournaments", label: "TOURNAMENTS" },
  { href: "/wallet", label: "WALLET" },
  { href: "/leaderboard", label: "STANDINGS" },
];

const TIER_COLORS: Record<string, string> = {
  STREET: "text-white/60",
  UNDERGROUND: "text-neon-cyan",
  SYNDICATE: "text-neon-magenta",
  LEGEND: "text-neon-volt",
};

export function NavBar() {
  const pathname = usePathname();
  const profile = useSessionStore((s) => s.profile);
  const [factionTag, setFactionTag] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!profile) return;
    api.factions
      .me()
      .then((me) => {
        const m = me as any;
        setFactionTag(m?.faction?.tag ?? null);
      })
      .catch(() => {});
  }, [profile?.id]);

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  return (
    <motion.nav
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.55, ease: [0.23, 1, 0.32, 1] }}
      className="fixed top-0 left-0 right-0 z-50 bg-void/90 backdrop-blur-xl border-b border-neon-cyan/10"
    >
      {/* Main row */}
      <div className="flex items-center justify-between px-6 py-3">

        {/* Logo */}
        <Link href="/" className="flex-shrink-0">
          <span className="font-display text-xl tracking-[0.15em] text-neon-cyan text-glow-cyan select-none">
            DRIFT<span className="text-neon-magenta text-glow-magenta">://</span>PROTOCOL
          </span>
        </Link>

        {/* Nav links */}
        <div className="hidden lg:flex items-center gap-1">
          {LINKS.map((l) => {
            const isActive = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`relative px-3 py-2 font-display text-[11px] tracking-widest transition-colors duration-200 ${
                  isActive
                    ? "text-neon-volt"
                    : "text-white/40 hover:text-white/80"
                }`}
              >
                {l.label}
                <AnimatePresence>
                  {isActive && (
                    <motion.span
                      layoutId="nav-underline"
                      className="absolute bottom-0 left-2 right-2 h-px bg-neon-volt"
                      initial={{ opacity: 0, scaleX: 0 }}
                      animate={{ opacity: 1, scaleX: 1 }}
                      exit={{ opacity: 0, scaleX: 0 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                      style={{ boxShadow: "0 0 8px rgba(204,255,0,0.6)" }}
                    />
                  )}
                </AnimatePresence>
              </Link>
            );
          })}
        </div>

        {/* Mobile: hamburger toggle */}
        <button
          className="flex lg:hidden items-center justify-center w-9 h-9 border border-neon-cyan/20 text-neon-cyan/70 hover:text-neon-cyan hover:border-neon-cyan/50 transition-colors"
          onClick={() => setMobileOpen((o) => !o)}
          aria-label="Toggle navigation menu"
          aria-expanded={mobileOpen}
        >
          <span className="font-display text-base">{mobileOpen ? "✕" : "☰"}</span>
        </button>

        {/* Right side: profile */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {profile ? (
            <>
              {/* Guest accounts: link a provider so progress + funds survive the browser */}
              {profile.authProvider === "guest" && (
                <div className="hidden md:flex items-center gap-1.5">
                  <span className="font-display text-[9px] text-neon-volt/70 tracking-widest">
                    SAVE PROGRESS:
                  </span>
                  {(["google", "discord"] as const).map((p) => (
                    <a
                      key={p}
                      href={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/v1/auth/${p}/start?upgrade=${encodeURIComponent(useSessionStore.getState().accessToken ?? "")}`}
                      className="font-display text-[10px] tracking-widest px-2 py-1 border border-neon-cyan/30 text-neon-cyan hover:bg-neon-cyan/10 transition-colors"
                    >
                      {p === "google" ? "GOOGLE" : "DISCORD"}
                    </a>
                  ))}
                </div>
              )}

              {/* Tier badge */}
              <span
                className={`hidden sm:block font-display text-[10px] tracking-widest ${
                  TIER_COLORS[profile.repTier] ?? "text-white/60"
                }`}
              >
                {profile.repTier}
              </span>

              {/* Faction tag */}
              {factionTag && (
                <span className="hidden sm:block font-display text-[10px] tracking-widest text-neon-volt">
                  [{factionTag}]
                </span>
              )}

              {/* Handle */}
              <span className="font-display text-sm text-white/90 tracking-wide">
                {profile.handle}
              </span>

              {/* Credits */}
              <div className="holo-card-sm px-2.5 py-1 flex items-center gap-1.5">
                <span className="font-display text-[10px] text-white/40 tracking-widest">₵</span>
                <span className="font-display text-xs text-neon-volt tabular-nums tracking-widest">
                  {Number(profile.credits).toLocaleString()}
                </span>
              </div>

              {/* Level */}
              <div
                className="px-2 py-0.5 font-display text-[10px] text-white/50 tracking-widest border border-neon-cyan/20 bg-neon-cyan/5"
                style={{
                  clipPath:
                    "polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)",
                }}
              >
                LVL{" "}
                <span className="text-neon-cyan">{profile.level}</span>
              </div>
            </>
          ) : (
            <span className="font-display text-[10px] text-white/30 tracking-widest animate-pulse">
              CONNECTING…
            </span>
          )}
        </div>
      </div>

      {/* Bottom neon sweep line */}
      <div
        className="h-px w-full"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(0,240,255,0.3) 50%, transparent 100%)",
        }}
      />

      {/* Mobile full-screen nav menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="lg:hidden absolute top-full left-0 right-0 bg-void/97 backdrop-blur-xl border-b border-neon-cyan/10 z-50"
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-0.5 p-4">
              {MOBILE_LINKS.map((l) => {
                const isActive = pathname === l.href;
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={`px-3 py-3 font-display text-[11px] tracking-widest transition-colors text-center border ${
                      isActive
                        ? "text-neon-volt border-neon-volt/30 bg-neon-volt/5"
                        : "text-white/40 border-transparent hover:text-white/80 hover:border-neon-cyan/20"
                    }`}
                  >
                    {l.label}
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
