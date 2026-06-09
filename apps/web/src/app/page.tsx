import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-10 pt-16 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,240,255,0.08),transparent_60%),radial-gradient(ellipse_at_bottom,rgba(255,46,151,0.08),transparent_60%)]" />

      <div className="text-center space-y-3 z-10">
        <div className="font-display text-xs tracking-[0.5em] text-neon-magenta">NEO-MERIDIAN · UNDERGROUND</div>
        <h1 className="font-display text-7xl tracking-widest text-neon-cyan drop-shadow-[0_0_32px_rgba(0,240,255,0.55)]">
          DRIFT PROTOCOL
        </h1>
        <p className="text-white/50 max-w-md text-center text-sm leading-relaxed">
          Street racing, real stakes. Own your car. Earn your reputation.
          Control the district. No installs, no wallets, no waiting.
        </p>
      </div>

      <div className="flex gap-4 z-10">
        <Link
          href="/play"
          className="holo-card px-12 py-4 font-display text-xl text-neon-volt hover:shadow-neon-cyan transition-shadow"
        >
          RACE NOW
        </Link>
        <Link
          href="/garage"
          className="holo-card px-8 py-4 font-display text-xl text-white/70 hover:text-white hover:shadow-neon-magenta transition-all border-neon-magenta/20"
        >
          GARAGE
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-6 z-10 mt-4">
        {[
          { label: "RACE", desc: "Sprint, circuit, drift trial. Earn credits every race." },
          { label: "UPGRADE", desc: "Engine, tires, nitro, ECU. Build your edge." },
          { label: "REP", desc: "Climb from Street to Legend. Unlock higher stakes." },
        ].map((f) => (
          <div key={f.label} className="holo-card px-6 py-4 max-w-[200px] text-center">
            <div className="font-display text-sm text-neon-cyan mb-2">{f.label}</div>
            <div className="text-white/50 text-xs leading-relaxed">{f.desc}</div>
          </div>
        ))}
      </div>
    </main>
  );
}
