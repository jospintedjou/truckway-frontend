import type { Checkpoint, Level } from "../api";
import { segmentLevel } from "./risk";

/** Truck position [lon, lat] at `seconds` after departure, interpolated along the route geometry. */
export function positionAt(geometry: [number, number, number][], seconds: number): [number, number] {
  if (!geometry.length) return [0, 0];
  if (seconds <= geometry[0][2]) return [geometry[0][0], geometry[0][1]];
  const last = geometry[geometry.length - 1];
  if (seconds >= last[2]) return [last[0], last[1]];
  let lo = 0;
  let hi = geometry.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (geometry[mid][2] <= seconds) lo = mid;
    else hi = mid;
  }
  const a = geometry[lo];
  const b = geometry[hi];
  const span = b[2] - a[2];
  const f = span > 0 ? (seconds - a[2]) / span : 0;
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
}

/**
 * Risk the truck meets at `seconds` after departure: the level of the stretch between
 * the two checkpoints around that moment. `undefined` once the truck has arrived.
 */
export function levelAtTime(checkpoints: Checkpoint[], seconds: number): Level | null | undefined {
  if (!checkpoints.length) return undefined;
  const last = checkpoints[checkpoints.length - 1];
  if (seconds > last.eta_offset_s) return undefined;
  if (seconds <= 0) return checkpoints[0].level;
  for (let i = 0; i < checkpoints.length - 1; i++) {
    const a = checkpoints[i];
    const b = checkpoints[i + 1];
    if (seconds >= a.eta_offset_s && seconds <= b.eta_offset_s) return segmentLevel(a.level, b.level);
  }
  return last.level;
}

/** One entry per forecast hour 0..hours, for the slider strip. */
export function hourlyTrack(checkpoints: Checkpoint[], hours: number): (Level | null | undefined)[] {
  return Array.from({ length: hours + 1 }, (_, h) => levelAtTime(checkpoints, h * 3600 + 1800));
}
