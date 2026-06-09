import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,240,255,0.08),transparent_60%),radial-gradient(ellipse_at_bottom,rgba(255,46,151,0.08),transparent_60%)]" />
      <h1 className="font-display text-6xl tracking-widest text-neon-cyan drop-shadow-[0_0_24px_rgba(0,240,255,0.6)]">
        DRIFT PROTOCOL
      </h1>
      <p className="text-white/60 max-w-md text-center">
        Neo-Meridian after dark. Race for credits, reputation, and turf. No installs, no wallets, no
        waiting.
      </p>
      <Link
        href="/play"
        className="holo-card px-10 py-4 font-display text-xl text-neon-volt hover:shadow-neon-cyan transition-shadow"
      >
        RACE NOW
      </Link>
    </main>
  );
}
