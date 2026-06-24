import Link from "next/link";

export default function NotFound() {
  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center bg-void overflow-hidden px-6">
      <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none" />
      <div className="scanlines absolute inset-0 pointer-events-none" />

      <div className="relative z-10 text-center space-y-6">
        <div className="font-display text-[10px] tracking-[0.5em] text-neon-magenta/60">
          NEO-MERIDIAN · ERROR
        </div>
        <h1 className="font-display text-8xl text-neon-cyan text-glow-cyan tracking-widest">
          404
        </h1>
        <p className="font-display text-sm text-white/30 tracking-widest max-w-xs mx-auto leading-relaxed">
          SIGNAL LOST. This route doesn&apos;t exist in the network grid.
        </p>
        <Link
          href="/"
          className="inline-block holo-card px-10 py-3 font-display text-sm text-neon-volt border border-neon-cyan/30 hover:border-neon-cyan/60 transition-all tracking-widest"
        >
          RETURN TO HQ
        </Link>
      </div>
    </main>
  );
}
