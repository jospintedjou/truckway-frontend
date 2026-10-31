import type { Route } from "../api";
import { fmtLb, LEVELS, levelHex, segmentLevel } from "../lib/risk";
import { fmtDateTime, fmtDuration } from "../lib/time";

/** The route as a straight bar, colored stretch by stretch. Striped = level raised by the load. */
export function RiskRibbon({ route }: { route: Route }) {
  const cps = route.checkpoints;
  const total = route.distance_mi || 1;
  return (
    <div className="ribbon" role="img" aria-label={`Risk along route ${route.id}`}>
      {cps.slice(1).map((b, i) => {
        const a = cps[i];
        const level = segmentLevel(a.level, b.level);
        const escalated =
          a.level !== null &&
          b.level !== null &&
          Math.max(a.level, b.level) > Math.max(a.base_level ?? 0, b.base_level ?? 0);
        const color = levelHex(level);
        return (
          <i
            key={i}
            className={escalated ? "escalated" : undefined}
            style={{ flexGrow: (b.mile - a.mile) / total, background: color, color }}
          />
        );
      })}
    </div>
  );
}

function badge(route: Route, recommended: boolean): { text: string; color: string } {
  const s = route.summary;
  if (!s.eligible) return { text: "No travel", color: LEVELS[4].hex };
  if (recommended) return { text: "Safest", color: LEVELS[0].hex };
  if (s.severe_miles > 0) return { text: "Severe", color: LEVELS[3].hex };
  if (s.high_miles > 0) return { text: "High", color: LEVELS[2].hex };
  if (s.moderate_miles > 0) return { text: "Moderate", color: LEVELS[1].hex };
  return { text: "Low risk", color: LEVELS[0].hex };
}

export function RouteCard({
  route,
  recommended,
  selected,
  loadLb,
  onSelect,
}: {
  route: Route;
  recommended: boolean;
  selected: boolean;
  loadLb: number;
  onSelect: () => void;
}) {
  const s = route.summary;
  const b = badge(route, recommended);
  const lastTz = route.checkpoints[route.checkpoints.length - 1]?.tz ?? "UTC";
  return (
    <button
      type="button"
      className={`route-card${selected ? " selected" : ""}${!s.eligible ? " blocked" : ""}`}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <div className="rc-top">
        <span className="rc-name">Route {route.id}</span>
        <span className="chip" style={{ color: b.color, borderColor: b.color }}>
          {b.text}
        </span>
      </div>
      <div className="rc-meta">
        {fmtDuration(route.duration_s)} · {Math.round(route.distance_mi)} mi · arrive {fmtDateTime(route.arrival, lastTz)}
      </div>
      <RiskRibbon route={route} />
      {s.eligible ? (
        <div className="rc-stats">
          <span>
            <b>{Math.round(s.severe_miles)}</b> severe mi
          </span>
          <span>
            <b>{Math.round(s.high_miles)}</b> high mi
          </span>
          <span>
            avg risk <b>{s.avg_risk.toFixed(2)}</b>
          </span>
        </div>
      ) : (
        <div className="rc-blocked">
          No travel at mile {Math.round(s.blocked_at?.mile ?? 0)} ({s.blocked_at?.drivers.join(" and ") || "weather"})
        </div>
      )}
      {s.load_escalated_miles > 0 && (
        <div className="rc-load">
          ▲ {Math.round(s.load_escalated_miles)} mi raised by your {fmtLb(loadLb)} load
        </div>
      )}
      {s.unknown_miles > 0 && (
        <div className="rc-unknown">{Math.round(s.unknown_miles)} mi without forecast (counted as High)</div>
      )}
    </button>
  );
}
