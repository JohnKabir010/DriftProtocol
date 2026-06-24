/** Clamp a number between min and max (inclusive). */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Linear interpolation from a to b by t ∈ [0, 1]. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Normalise an angle to (-π, π]. */
export function wrapAngle(rad: number): number {
  let r = rad % (2 * Math.PI);
  if (r > Math.PI) r -= 2 * Math.PI;
  if (r <= -Math.PI) r += 2 * Math.PI;
  return r;
}

/** Degrees to radians. */
export const DEG_TO_RAD = Math.PI / 180;
/** Radians to degrees. */
export const RAD_TO_DEG = 180 / Math.PI;

/** Format a credits balance to a display string (e.g. 1_234_000 → "1,234 CR"). */
export function formatCredits(minor: bigint | number): string {
  const n = typeof minor === "bigint" ? Number(minor) : minor;
  return `${Math.floor(n / 100).toLocaleString("en-US")} CR`;
}

/** Format a USDC balance in minor units (7 decimal places) to a display string. */
export function formatUsdc(minor: bigint | number): string {
  const n = typeof minor === "bigint" ? Number(minor) : minor;
  const units = (n / 1e7).toFixed(2);
  return `$${Number(units).toLocaleString("en-US", { minimumFractionDigits: 2 })} USDC`;
}
