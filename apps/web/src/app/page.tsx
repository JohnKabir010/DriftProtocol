"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

/* ── Particle data — fixed so SSR/client match ─────────────────────────── */
const PARTICLES: Array<{
  id: number;
  top: string;
  left: string;
  size: number;
  color: string;
  duration: number;
  delay: number;
  drift: number;
}> = [
  { id:  0, top: "88%", left:  "7%", size: 1.5, color: "rgba(0,240,255,0.4)",  duration: 14, delay:  0.0, drift:  18 },
  { id:  1, top: "76%", left: "19%", size: 1.0, color: "rgba(255,46,151,0.35)", duration: 18, delay:  2.3, drift: -22 },
  { id:  2, top: "93%", left: "34%", size: 2.0, color: "rgba(0,240,255,0.35)",  duration: 12, delay:  0.8, drift:  14 },
  { id:  3, top: "81%", left: "47%", size: 1.0, color: "rgba(255,46,151,0.3)",  duration: 20, delay:  4.1, drift: -16 },
  { id:  4, top: "95%", left: "58%", size: 1.5, color: "rgba(0,240,255,0.4)",   duration: 15, delay:  1.5, drift:  20 },
  { id:  5, top: "72%", left: "69%", size: 2.5, color: "rgba(204,255,0,0.25)",  duration: 22, delay:  3.0, drift: -12 },
  { id:  6, top: "89%", left: "80%", size: 1.0, color: "rgba(0,240,255,0.35)",  duration: 16, delay:  5.5, drift:  24 },
  { id:  7, top: "91%", left: "91%", size: 1.5, color: "rgba(255,46,151,0.3)",  duration: 11, delay:  0.3, drift: -18 },
  { id:  8, top: "85%", left: "13%", size: 1.0, color: "rgba(0,240,255,0.3)",   duration: 19, delay:  6.2, drift:  16 },
  { id:  9, top: "79%", left: "26%", size: 2.0, color: "rgba(255,46,151,0.35)", duration: 13, delay:  2.8, drift: -20 },
  { id: 10, top: "97%", left: "42%", size: 1.5, color: "rgba(0,240,255,0.4)",   duration: 17, delay:  1.0, drift:  10 },
  { id: 11, top: "83%", left: "55%", size: 1.0, color: "rgba(204,255,0,0.2)",   duration: 21, delay:  4.7, drift: -14 },
  { id: 12, top: "90%", left: "73%", size: 2.0, color: "rgba(0,240,255,0.35)",  duration: 14, delay:  3.5, drift:  22 },
  { id: 13, top: "75%", left: "87%", size: 1.5, color: "rgba(255,46,151,0.3)",  duration: 18, delay:  0.6, drift: -10 },
  { id: 14, top: "94%", left:  "3%", size: 1.0, color: "rgba(0,240,255,0.4)",   duration: 16, delay:  7.0, drift:  18 },
  { id: 15, top: "86%", left: "96%", size: 2.5, color: "rgba(255,46,151,0.25)", duration: 23, delay:  2.1, drift: -24 },
];

const FEATURES = [
  {
    label: "RACE",
    icon: "▸",
    desc: "Sprint, circuit, drift trial. Credits every finish.",
    accent: "text-neon-cyan",
    border: "border-neon-cyan/20 hover:border-neon-cyan/50",
    glow: "hover:shadow-neon-cyan",
  },
  {
    label: "UPGRADE",
    icon: "⬡",
    desc: "Engine · Tires · Nitro · ECU. Build your edge.",
    accent: "text-neon-magenta",
    border: "border-neon-magenta/20 hover:border-neon-magenta/50",
    glow: "hover:shadow-neon-magenta",
  },
  {
    label: "REP",
    icon: "◈",
    desc: "Street → Underground → Syndicate → Legend.",
    accent: "text-neon-volt",
    border: "border-neon-volt/20 hover:border-neon-volt/50",
    glow: "hover:shadow-neon-volt",
  },
];

function useLiveStats() {
  const [stats, setStats] = useState({ racers: 0, races: 0, districts: 0 });
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/v1/stats`)
      .then((r) => r.json())
      .then((data: { totalPlayers?: number; liveRaces?: number; contestedDistricts?: number }) => {
        setStats({
          racers: data.totalPlayers ?? 0,
          races: data.liveRaces ?? 0,
          districts: data.contestedDistricts ?? 0,
        });
      })
      .catch(() => {});
  }, []);
  return stats;
}

export default function LandingPage() {
  const stats = useLiveStats();
  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-void pt-16">

      {/* ── Grid overlay ──────────────────────────────────────────────── */}
      <div className="absolute inset-0 grid-bg opacity-60 pointer-events-none" />

      {/* ── Scanlines ─────────────────────────────────────────────────── */}
      <div className="scanlines absolute inset-0 pointer-events-none" />

      {/* ── Background blobs ──────────────────────────────────────────── */}
      <div
        className="absolute -top-40 -left-40 w-[700px] h-[700px] rounded-full pointer-events-none anim-float"
        style={{
          background: "radial-gradient(circle, rgba(0,240,255,0.07) 0%, transparent 70%)",
          filter: "blur(60px)",
          animationDuration: "8s",
        }}
      />
      <div
        className="absolute -bottom-40 -right-40 w-[800px] h-[800px] rounded-full pointer-events-none anim-float"
        style={{
          background: "radial-gradient(circle, rgba(255,46,151,0.07) 0%, transparent 70%)",
          filter: "blur(70px)",
          animationDuration: "11s",
          animationDelay: "2s",
        }}
      />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(204,255,0,0.03) 0%, transparent 65%)",
          filter: "blur(80px)",
        }}
      />

      {/* ── Floating particles ────────────────────────────────────────── */}
      {PARTICLES.map((p) => (
        <span
          key={p.id}
          className="absolute rounded-full pointer-events-none"
          style={{
            top: p.top,
            left: p.left,
            width: `${p.size}px`,
            height: `${p.size}px`,
            background: p.color,
            boxShadow: `0 0 ${p.size * 3}px ${p.color}`,
            animation: `particle-rise ${p.duration}s ${p.delay}s infinite`,
            ["--x-drift" as string]: `${p.drift}px`,
          }}
        />
      ))}

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative z-10 flex flex-col items-center text-center gap-6 px-6">

        {/* Eyebrow */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1], delay: 0.1 }}
          className="font-display text-xs tracking-[0.5em] text-neon-magenta/70"
        >
          NEO-MERIDIAN · UNDERGROUND RACING
        </motion.div>

        {/* Main title */}
        <motion.h1
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1], delay: 0.2 }}
          className="glitch-text font-display text-7xl md:text-8xl tracking-widest text-neon-cyan text-glow-cyan"
          data-text="DRIFT PROTOCOL"
        >
          DRIFT PROTOCOL
        </motion.h1>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.23, 1, 0.32, 1], delay: 0.45 }}
          className="text-white/50 text-sm max-w-lg leading-relaxed"
        >
          Street racing, real stakes. Own your car. Earn your rep. Control the district.
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1], delay: 0.6 }}
          className="flex items-center gap-4 mt-2"
        >
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Link
              href="/play"
              className="holo-card inline-block px-14 py-4 font-display text-xl text-neon-volt border border-neon-cyan/40 bg-neon-cyan/5 hover:bg-neon-cyan/10 hover:text-glow-volt transition-all duration-200 tracking-widest"
            >
              RACE NOW
            </Link>
          </motion.div>

          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Link
              href="/garage"
              className="holo-card inline-block px-10 py-4 font-display text-xl text-white/70 hover:text-white border border-neon-magenta/30 hover:border-neon-magenta/60 transition-all duration-200 tracking-widest"
            >
              GARAGE
            </Link>
          </motion.div>

          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Link
              href="/wallet"
              className="holo-card inline-block px-10 py-4 font-display text-xl text-neon-volt/80 hover:text-neon-volt border border-neon-volt/30 hover:border-neon-volt/60 transition-all duration-200 tracking-widest"
            >
              WALLET
            </Link>
          </motion.div>
        </motion.div>

        {/* Stats bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.85 }}
          className="flex items-center gap-4 mt-1"
        >
          <div className="flex items-center gap-2">
            <span
              className="dot-cyan anim-pulse-cyan"
              style={{ display: "inline-block" }}
            />
            <span className="font-display text-[10px] tracking-widest text-white/30">
              ACTIVE RACERS: {stats.racers}
            </span>
          </div>
          <span className="text-white/15 font-display text-xs">|</span>
          <span className="font-display text-[10px] tracking-widest text-white/30">
            LIVE RACES: {stats.races}
          </span>
          <span className="text-white/15 font-display text-xs">|</span>
          <span className="font-display text-[10px] tracking-widest text-white/30">
            DISTRICTS CONTESTED: {stats.districts}
          </span>
        </motion.div>
      </section>

      {/* ── Neon divider ──────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, scaleX: 0 }}
        animate={{ opacity: 1, scaleX: 1 }}
        transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1], delay: 0.9 }}
        className="neon-divider w-full max-w-2xl mx-auto my-10 z-10"
      />

      {/* ── Feature cards ─────────────────────────────────────────────── */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-5 px-6 pb-16 max-w-3xl w-full">
        {FEATURES.map((f, i) => (
          <motion.div
            key={f.label}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.5,
              ease: [0.23, 1, 0.32, 1],
              delay: 1.0 + i * 0.1,
            }}
            whileHover={{ y: -3 }}
            className={`holo-card px-6 py-5 text-center border transition-all duration-300 cursor-default ${f.border} ${f.glow}`}
          >
            <div className={`font-display text-xl mb-1 ${f.accent}`}>
              {f.icon}
            </div>
            <div className={`font-display text-sm tracking-widest mb-2 ${f.accent}`}>
              {f.label}
            </div>
            <div className="text-white/45 text-xs leading-relaxed">
              {f.desc}
            </div>
          </motion.div>
        ))}
      </div>
    </main>
  );
}
