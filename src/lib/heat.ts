import type { Corridor, Level } from "../api";
import { LEVELS } from "./risk";

export type RGBA = [number, number, number, number];

/**
 * Opacity per level. Low is a faint tint (it shows where the forecast covers the corridor
 * without competing with real risk); unknown cells are not painted.
 */
const ALPHA = [26, 80, 105, 135, 165];

function frameColor(level: number): RGBA {
  if (level < 0) return [0, 0, 0, 0];
  const [r, g, b] = LEVELS[level].rgb;
  return [r, g, b, ALPHA[level]];
}

/**
 * Color of a cell at a fractional forecast hour. The server sends whole hours;
 * blending the two neighbouring frames here keeps the slider smooth without any
 * network request while dragging. Risk decisions never use these blended values.
 */
export function cellColor(c: Corridor, cell: number, hour: number): RGBA {
  const n = c.cells.lat.length;
  const h = Math.min(Math.max(hour, 0), c.hours - 1);
  const h0 = Math.floor(h);
  const h1 = Math.min(h0 + 1, c.hours - 1);
  const f = h - h0;
  const a = frameColor(c.levels[h0 * n + cell]);
  const b = frameColor(c.levels[h1 * n + cell]);
  if (f === 0 || h0 === h1) return a;
  // fading in or out from transparent: keep the visible color, blend only opacity
  const rgbFrom = a[3] === 0 ? b : a;
  const rgbTo = b[3] === 0 ? a : b;
  return [
    rgbFrom[0] + (rgbTo[0] - rgbFrom[0]) * f,
    rgbFrom[1] + (rgbTo[1] - rgbFrom[1]) * f,
    rgbFrom[2] + (rgbTo[2] - rgbFrom[2]) * f,
    a[3] + (b[3] - a[3]) * f,
  ];
}

export function cellPolygon(c: Corridor, cell: number): [number, number][] {
  const lat = c.cells.lat[cell];
  const lon = c.cells.lon[cell];
  // exact tiling: overlapping translucent cells would draw darker seams
  const hy = c.cells.dlat / 2;
  const hx = c.cells.dlon / 2;
  return [
    [lon - hx, lat - hy],
    [lon + hx, lat - hy],
    [lon + hx, lat + hy],
    [lon - hx, lat + hy],
  ];
}

export interface StormLabel {
  position: [number, number];
  text: string;
  level: number;
}

function distanceMi(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const x = (lon2 - lon1) * Math.cos((((lat1 + lat2) / 2) * Math.PI) / 180);
  const y = lat2 - lat1;
  return Math.sqrt(x * x + y * y) * 69;
}

/** At most `max` labels, on the worst cells of separate storms (>= High), naming what drives them. */
export function stormLabels(c: Corridor, hour: number, max = 2): StormLabel[] {
  const n = c.cells.lat.length;
  const h = Math.min(Math.max(Math.round(hour), 0), c.hours - 1);
  const candidates: { i: number; level: number; score: number }[] = [];
  for (let i = 0; i < n; i++) {
    const level = c.levels[h * n + i];
    if (level >= 2) candidates.push({ i, level, score: level * 1000 + c.wind_mph[h * n + i] });
  }
  candidates.sort((x, y) => y.score - x.score);
  const picked: StormLabel[] = [];
  for (const cand of candidates) {
    const lat = c.cells.lat[cand.i];
    const lon = c.cells.lon[cand.i];
    if (picked.some((p) => distanceMi(lat, lon, p.position[1], p.position[0]) < 250)) continue;
    const k = h * n + cand.i;
    const driver = c.drivers[k];
    const text =
      driver === 3
        ? `Snow ${(c.snow_in_hr_x10[k] / 10).toFixed(1)} in/hr`
        : driver === 2
          ? `Rain ${(c.rain_in_hr_x100[k] / 100).toFixed(2)} in/hr`
          : `Wind ${c.wind_mph[k]} mph`;
    picked.push({ position: [lon, lat], text, level: cand.level });
    if (picked.length >= max) break;
  }
  return picked;
}

/**
 * Worst level anywhere on the corridor during each slider hour 0..hours (`offset` maps
 * slider hours to corridor frames). Null when no cell has data in that hour.
 */
export function corridorWorstByHour(c: Corridor, hours: number, offset: number): (Level | null)[] {
  const n = c.cells.lat.length;
  const clamp = (f: number) => Math.min(c.hours - 1, Math.max(0, f));
  return Array.from({ length: hours + 1 }, (_, h) => {
    let worst = -1;
    for (let f = clamp(Math.floor(h + offset)); f <= clamp(Math.ceil(h + 1 + offset)); f++) {
      for (let i = 0; i < n; i++) worst = Math.max(worst, c.levels[f * n + i]);
    }
    return worst < 0 ? null : (worst as Level);
  });
}
