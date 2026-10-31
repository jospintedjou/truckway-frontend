import { useState } from "react";
import type { Checkpoint, Plan, Route } from "../api";
import { driverText, fmtLb, LEVELS, levelHex, levelName } from "../lib/risk";
import { fmtDateTime, fmtDuration, fmtTime } from "../lib/time";

export function Verdict({ plan, onChangeTrip }: { plan: Plan; onChangeTrip: () => void }) {
  const rec = plan.recommendation;
  const load = fmtLb(plan.trip.load_lb);

  if (rec.status === "no_safe_route") {
    return (
      <div className="verdict danger" role="alert">
        <div className="verdict-icon" aria-hidden="true">
          !
        </div>
        <div>
          <p className="eyebrow">Checked for {load}</p>
          <h2>Don't travel on this schedule</h2>
          <p className="muted">
            Every route crosses No travel conditions. No route is recommended: people and cargo come first.
          </p>
          <ul className="reasons">
            {rec.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <button type="button" className="secondary" onClick={onChangeTrip}>
            Change departure or load
          </button>
        </div>
      </div>
    );
  }

  return <RecommendedVerdict plan={plan} />;
}

function RecommendedVerdict({ plan }: { plan: Plan }) {
  const [open, setOpen] = useState(false);
  const rec = plan.recommendation;
  const route = plan.routes.find((r) => r.id === rec.route_id)!;
  const s = route.summary;
  const lastTz = route.checkpoints[route.checkpoints.length - 1]?.tz ?? plan.trip.timezone;
  return (
    <div className={`verdict ok${open ? " open" : ""}`}>
      <div className="verdict-icon" aria-hidden="true">
        ✓
      </div>
      <div className="verdict-main">
        <p className="eyebrow">Recommended · checked for {fmtLb(plan.trip.load_lb)}</p>
        <h2>Take route {route.id}</h2>
        <p className="muted">
          {fmtDuration(route.duration_s)} · arrive {fmtDateTime(route.arrival, lastTz)}
        </p>
        {open && (
          <div id="verdict-details" className="verdict-details">
            <dl className="stats">
              <div>
                <dt>Severe</dt>
                <dd>{Math.round(s.severe_miles)} mi</dd>
              </div>
              <div>
                <dt>High</dt>
                <dd>{Math.round(s.high_miles)} mi</dd>
              </div>
              <div>
                <dt>Avg risk</dt>
                <dd>{s.avg_risk.toFixed(2)}</dd>
              </div>
              <div>
                <dt>Distance</dt>
                <dd>{Math.round(route.distance_mi)} mi</dd>
              </div>
            </dl>
            <p className="eyebrow muted-eyebrow">Why this route</p>
            <ul className="reasons">
              {rec.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            {s.load_escalated_miles > 0 && (
              <p className="load-note">▲ {Math.round(s.load_escalated_miles)} mi raised by your load</p>
            )}
          </div>
        )}
      </div>
      <button
        type="button"
        className="expand"
        aria-expanded={open}
        aria-controls="verdict-details"
        aria-label={open ? "Hide details" : "Show details"}
        onClick={() => setOpen((v) => !v)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
    </div>
  );
}

function conditions(c: Checkpoint): string {
  const w = c.weather;
  if (!w) return "Forecast unavailable: treated as High";
  return `Wind ${Math.round(w.wind_mph)} mph (gust ${Math.round(w.gust_mph)}) · Rain ${w.rain_in_hr.toFixed(2)} in/hr · Snow ${w.snow_in_hr.toFixed(1)} in/hr`;
}

export function LevelChip({ level }: { level: Checkpoint["level"] }) {
  const color = levelHex(level);
  return (
    <span className="chip" style={{ color, borderColor: color }}>
      {levelName(level)}
    </span>
  );
}

export function LoadNote({ c, loadLb }: { c: Checkpoint; loadLb: number }) {
  if (!c.load_escalated || c.base_level === null || c.level === null) return null;
  return (
    <p className="load-note">
      ▲ Your {fmtLb(loadLb)} load raises {LEVELS[c.base_level].name} to {LEVELS[c.level].name}
    </p>
  );
}

export function Timeline({
  route,
  loadLb,
  selectedIndex,
  onSelect,
}: {
  route: Route;
  loadLb: number;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}) {
  const last = route.checkpoints.length - 1;
  return (
    <ol className="timeline" aria-label={`Checkpoints on route ${route.id}`}>
      {route.checkpoints.map((c, i) => (
        <li key={i}>
          <button
            type="button"
            className={`tl-row${selectedIndex === i ? " selected" : ""}`}
            onClick={() => onSelect(i)}
          >
            <span className="tl-time">{fmtTime(c.eta, c.tz)}</span>
            <span className="tl-dot" style={{ background: levelHex(c.level) }} aria-hidden="true" />
            <span className="tl-body">
              <span className="tl-title">
                {i === 0 ? "Departure" : i === last ? "Arrival" : `Mile ${Math.round(c.mile)}`}
                <LevelChip level={c.level} />
              </span>
              <span className="tl-sub">{conditions(c)}</span>
              {c.drivers.length > 0 && <span className="tl-sub">{driverText(c.drivers)}</span>}
              <LoadNote c={c} loadLb={loadLb} />
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}

export function CheckpointCard({
  route,
  index,
  loadLb,
  onClose,
}: {
  route: Route;
  index: number;
  loadLb: number;
  onClose: () => void;
}) {
  const c = route.checkpoints[index];
  if (!c) return null;
  return (
    <div className="cp-card" role="dialog" aria-label={`Route ${route.id}, mile ${Math.round(c.mile)}`}>
      <div className="cp-head">
        <span>
          Route {route.id} · mile {Math.round(c.mile)}
        </span>
        <button type="button" className="icon" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </div>
      <p className="cp-eta">ETA {fmtDateTime(c.eta, c.tz)}</p>
      <div className="cp-level">
        <LevelChip level={c.level} />
        <span className="muted small">{driverText(c.drivers)}</span>
      </div>
      <p className="small">{conditions(c)}</p>
      <LoadNote c={c} loadLb={loadLb} />
    </div>
  );
}
