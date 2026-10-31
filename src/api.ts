export type Level = 0 | 1 | 2 | 3 | 4;

export interface Place {
  label: string;
  lat?: number;
  lon?: number;
}

export interface WeatherSample {
  wind_mph: number;
  gust_mph: number;
  rain_in_hr: number;
  snow_in_hr: number;
}

export interface Checkpoint {
  mile: number;
  lat: number;
  lon: number;
  eta: string;
  eta_offset_s: number;
  tz: string;
  weather: WeatherSample | null;
  level: Level | null; // null = forecast unavailable
  base_level: Level | null;
  drivers: string[];
  load_escalated: boolean;
}

export interface RouteSummary {
  distance_mi: number;
  duration_s: number;
  no_travel_miles: number;
  severe_miles: number;
  high_miles: number;
  moderate_miles: number;
  low_miles: number;
  unknown_miles: number;
  load_escalated_miles: number;
  avg_risk: number;
  eligible: boolean;
  blocked_at: { mile: number; drivers: string[] } | null;
}

export interface Route {
  id: string;
  distance_mi: number;
  duration_s: number;
  arrival: string;
  /** [lon, lat, seconds since departure] */
  geometry: [number, number, number][];
  checkpoints: Checkpoint[];
  summary: RouteSummary;
}

export interface Plan {
  trip: {
    id: string;
    origin: Required<Place>;
    destination: Required<Place>;
    departure: string;
    timezone: string;
    load_lb: number;
    interval_mi: number;
    scenario: string | null;
  };
  routes: Route[];
  recommendation: {
    status: "recommended" | "no_safe_route";
    route_id: string | null;
    ranking: string[];
    reasons: string[];
  };
}

export interface Corridor {
  trip_id: string;
  start: string;
  hours: number;
  load_lb: number;
  cells: { lat: number[]; lon: number[]; dlat: number; dlon: number };
  /** flat [hour * cellCount + cell]; -1 = unknown */
  levels: number[];
  drivers: number[];
  wind_mph: number[];
  rain_in_hr_x100: number[];
  snow_in_hr_x10: number[];
}

export interface PlanInput {
  origin: Place;
  destination: Place;
  departure_local: string;
  load_lb: number;
  interval_mi: 10 | 25 | 50;
  scenario?: "storm" | null;
}

const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let resp: Response;
  try {
    resp = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError("Can't reach the server. Check your connection and try again.", 0);
  }
  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new ApiError(errorMessage(body) ?? `Request failed (${resp.status})`, resp.status);
  }
  return body as T;
}

function errorMessage(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const b = body as Record<string, unknown>;
  if (typeof b.detail === "string") return b.detail;
  // DRF validation errors: { field: ["message"] } or nested
  const first = Object.entries(b)[0];
  if (!first) return undefined;
  const [field, value] = first;
  const msg = Array.isArray(value) ? value[0] : typeof value === "object" ? errorMessage(value) : value;
  return typeof msg === "string" ? `${field.replace(/_/g, " ")}: ${msg}` : undefined;
}

export const api = {
  health: () => request<{ status: string }>("/api/health"),
  geocode: (q: string, signal?: AbortSignal) =>
    request<{ results: Required<Place>[] }>(`/api/geocode?q=${encodeURIComponent(q)}`, { signal }),
  plan: (input: PlanInput) => request<Plan>("/api/trips/plan", { method: "POST", body: JSON.stringify(input) }),
  corridor: (tripId: string) => request<Corridor>(`/api/trips/${tripId}/corridor`),
};
