import { describe, expect, it } from "vitest";
import type { Checkpoint, Corridor, Level } from "../api";
import { cellColor, corridorWorstByHour, stormLabels } from "./heat";
import { segmentLevel } from "./risk";
import { fmtDuration } from "./time";
import { hourlyTrack, levelAtTime, positionAt } from "./track";

const cp = (mile: number, offset: number, level: Level | null): Checkpoint => ({
  mile,
  lat: 0,
  lon: 0,
  eta: new Date(offset * 1000).toISOString(),
  eta_offset_s: offset,
  tz: "UTC",
  weather: null,
  level,
  base_level: level,
  drivers: [],
  load_escalated: false,
});

describe("track", () => {
  it("interpolates the truck position by time", () => {
    const geom: [number, number, number][] = [
      [0, 0, 0],
      [10, 0, 100],
      [10, 10, 300],
    ];
    expect(positionAt(geom, 50)).toEqual([5, 0]);
    expect(positionAt(geom, 200)).toEqual([10, 5]);
    expect(positionAt(geom, 999)).toEqual([10, 10]);
  });

  it("uses the worse end of the current stretch, like the backend", () => {
    const cps = [cp(0, 0, 0), cp(25, 3600, 3), cp(50, 7200, 0)];
    expect(levelAtTime(cps, 1800)).toBe(3);
    expect(levelAtTime(cps, 5400)).toBe(3);
    expect(levelAtTime(cps, 8000)).toBeUndefined();
    expect(hourlyTrack(cps, 3)).toEqual([3, 3, undefined, undefined]);
  });

  it("treats unknown as High", () => {
    expect(segmentLevel(null, 0)).toBe(2);
    expect(segmentLevel(null, null)).toBeNull();
  });
});

describe("heat", () => {
  const corridor: Corridor = {
    trip_id: "t",
    start: "2026-01-01T00:00:00Z",
    hours: 2,
    load_lb: 1,
    cells: { lat: [0, 10], lon: [0, 10], dlat: 0.2, dlon: 0.2 },
    // hour 0: [low, severe], hour 1: [moderate, severe]
    levels: [0, 3, 1, 3],
    drivers: [0, 1, 1, 1],
    wind_mph: [5, 50, 28, 50],
    rain_in_hr_x100: [0, 0, 0, 0],
    snow_in_hr_x10: [0, 0, 0, 0],
  };

  it("tints low cells faintly and blends toward the next hour", () => {
    const low = cellColor(corridor, 0, 0);
    expect(low.slice(0, 3)).toEqual([45, 212, 191]);
    expect(low[3]).toBeLessThan(40);
    const mid = cellColor(corridor, 0, 0.5);
    expect(mid[3]).toBeGreaterThan(low[3]);
    expect(mid[3]).toBeLessThan(cellColor(corridor, 0, 1)[3]);
  });

  it("labels the worst storm with its cause", () => {
    const labels = stormLabels(corridor, 0);
    expect(labels).toHaveLength(1);
    expect(labels[0].text).toBe("Wind 50 mph");
  });

  it("gives the worst corridor level for each slider hour", () => {
    expect(corridorWorstByHour(corridor, 2, 0)).toEqual([3, 3, 3]);
    const calm = { ...corridor, levels: [0, -1, 1, -1] };
    expect(corridorWorstByHour(calm, 1, 0)).toEqual([1, 1]);
    expect(corridorWorstByHour({ ...corridor, levels: [-1, -1, -1, -1] }, 0, 0)).toEqual([null]);
  });
});

describe("time", () => {
  it("formats durations", () => {
    expect(fmtDuration(13 * 3600 + 40 * 60)).toBe("13h 40m");
    expect(fmtDuration(45 * 60)).toBe("45m");
  });
});
