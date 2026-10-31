import type { Level } from "../api";

export type RGB = [number, number, number];

export const LEVELS: { name: string; short: string; hex: string; rgb: RGB }[] = [
  { name: "Low", short: "Low", hex: "#2DD4BF", rgb: [45, 212, 191] },
  { name: "Moderate", short: "Mod", hex: "#FACC15", rgb: [250, 204, 21] },
  { name: "High", short: "High", hex: "#FB923C", rgb: [251, 146, 60] },
  { name: "Severe", short: "Severe", hex: "#E8590C", rgb: [232, 89, 12] },
  { name: "No travel", short: "No travel", hex: "#FF2D55", rgb: [255, 45, 85] },
];

export const UNKNOWN = { name: "Unknown", hex: "#5B6B7F", rgb: [91, 107, 127] as RGB };

export function levelName(level: Level | null): string {
  return level === null ? UNKNOWN.name : LEVELS[level].name;
}

export function levelHex(level: Level | null): string {
  return level === null ? UNKNOWN.hex : LEVELS[level].hex;
}

export function levelRgb(level: Level | null): RGB {
  return level === null ? UNKNOWN.rgb : LEVELS[level].rgb;
}

/** Same rule as the backend: a stretch takes the worse of its two ends; unknown counts as High. */
export function segmentLevel(a: Level | null, b: Level | null): Level | null {
  if (a === null && b === null) return null;
  const ea = a ?? 2;
  const eb = b ?? 2;
  return Math.max(ea, eb) as Level;
}

export function driverText(drivers: string[]): string {
  if (!drivers.length) return "Calm";
  return `Set by ${drivers.join(" and ")}`;
}

export function fmtLb(lb: number): string {
  return `${Math.round(lb).toLocaleString("en-US")} lb`;
}
