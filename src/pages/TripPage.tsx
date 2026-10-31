import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { Navigate } from "react-router-dom";
import { api, ApiError, type Corridor, type Plan } from "../api";
import { BottomSheet, PEEK_PX, useIsDesktop } from "../components/BottomSheet";
import { EditTripDialog } from "../components/EditTripDialog";
import { ForecastSlider } from "../components/ForecastSlider";
import { MapErrorBoundary } from "../components/MapFallback";
import { RouteCard } from "../components/RouteCard";
import { CheckpointCard, Timeline, Verdict } from "../components/TripDetails";
import { TripMap, type MapPadding } from "../components/TripMap";
import { fmtLb, LEVELS } from "../lib/risk";
import { fmtDateTime } from "../lib/time";
import { hourlyTrack } from "../lib/track";
import { useTrip } from "../store";

const HOURS = 48;

/** Page 3: the live map with routes, checkpoints, the risk heatmap and the forecast slider. */
export default function TripPage() {
  const { plan } = useTrip();
  if (!plan) return <Navigate to="/plan" replace />;
  return <TripView key={plan.trip.id} plan={plan} />;
}

function short(label: string): string {
  return label.split(",").slice(0, 2).join(",");
}

function TripView({ plan }: { plan: Plan }) {
  const desktop = useIsDesktop();
  const [selectedRoute, setSelectedRoute] = useState(plan.recommendation.route_id ?? plan.routes[0].id);
  const [selectedCp, setSelectedCp] = useState<{ route: string; index: number } | null>(null);
  const [hour, setHour] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [showHeat, setShowHeat] = useState(true);
  const [corridor, setCorridor] = useState<Corridor | null>(null);
  const [corridorError, setCorridorError] = useState<string | null>(null);
  const [sheetH, setSheetH] = useState(PEEK_PX);
  const [editing, setEditing] = useState(false);

  // The heatmap loads after the routes are already on screen.
  useEffect(() => {
    let cancelled = false;
    api
      .corridor(plan.trip.id)
      .then((c) => !cancelled && setCorridor(c))
      .catch((e) => !cancelled && setCorridorError(e instanceof ApiError ? e.message : "Weather map unavailable"));
    return () => {
      cancelled = true;
    };
  }, [plan.trip.id]);

  const route = plan.routes.find((r) => r.id === selectedRoute) ?? plan.routes[0];
  const track = useMemo(() => hourlyTrack(route.checkpoints, HOURS), [route]);
  // corridor frames start on the whole hour at or before departure
  const heatOffset = corridor ? (Date.parse(plan.trip.departure) - Date.parse(corridor.start)) / 3_600_000 : 0;

  const padding = useMemo<MapPadding>(
    () => (desktop ? { top: 110, bottom: 200, left: 460, right: 70 } : { top: 110, bottom: PEEK_PX + 190, left: 30, right: 30 }),
    [desktop],
  );

  const selectCheckpoint = useCallback(
    (routeId: string, index: number) => {
      const r = plan.routes.find((x) => x.id === routeId);
      const cp = r?.checkpoints[index];
      if (!cp) return;
      setSelectedRoute(routeId);
      setSelectedCp({ route: routeId, index });
      setPlaying(false);
      setHour(Math.min(HOURS, Math.max(0, cp.eta_offset_s / 3600)));
    },
    [plan],
  );

  const selectRoute = useCallback((routeId: string) => {
    setSelectedRoute(routeId);
    setSelectedCp(null);
  }, []);

  // Sheet content does not depend on the slider, so dragging it never re-renders the lists.
  const details = useMemo(
    () => (
      <>
        <Verdict plan={plan} onChangeTrip={() => setEditing(true)} />
        <h3 className="section-title">Routes</h3>
        <div className="route-list">
          {plan.routes.map((r) => (
            <RouteCard
              key={r.id}
              route={r}
              recommended={r.id === plan.recommendation.route_id}
              selected={r.id === selectedRoute}
              loadLb={plan.trip.load_lb}
              onSelect={() => selectRoute(r.id)}
            />
          ))}
        </div>
        <h3 className="section-title">Route {selectedRoute} timeline</h3>
        <Timeline
          route={plan.routes.find((r) => r.id === selectedRoute) ?? plan.routes[0]}
          loadLb={plan.trip.load_lb}
          selectedIndex={selectedCp?.route === selectedRoute ? selectedCp.index : null}
          onSelect={(i) => selectCheckpoint(selectedRoute, i)}
        />
        <p className="footnote muted">
          Routing by TomTom (truck profile). Forecast by Open-Meteo. Weather is read at each checkpoint's ETA; wind uses
          sustained speed, gusts are shown for information.
          {plan.trip.scenario && " This trip includes a synthetic demo storm."}
        </p>
      </>
    ),
    [plan, selectedRoute, selectedCp, selectRoute, selectCheckpoint],
  );

  const toggleHeat = useCallback(() => setShowHeat((v) => !v), []);
  const closeEdit = useCallback(() => setEditing(false), []);

  // One line telling the driver what the risk map holds, so an empty map reads as "calm", not "broken".
  const heatStatus = useMemo(() => {
    if (corridorError) return corridorError;
    if (!corridor) return "Loading the weather risk map…";
    const n = corridor.cells.lat.length;
    let worst = 0;
    let first = -1;
    for (let h = 0; h < corridor.hours; h++) {
      for (let i = 0; i < n; i++) {
        const lv = corridor.levels[h * n + i];
        if (lv > worst) worst = lv;
        if (lv >= 1 && first < 0) first = h;
      }
    }
    if (worst <= 0) return "Calm along the whole corridor for the next 48 h.";
    const at = Math.max(0, Math.round(first - heatOffset));
    return `Up to ${LEVELS[worst].name} on the corridor, first risk at +${at}h. Press play to watch it move.`;
  }, [corridor, corridorError, heatOffset]);

  const cpRoute = selectedCp ? plan.routes.find((r) => r.id === selectedCp.route) : undefined;

  return (
    <div className={`trip ${desktop ? "desktop" : "mobile"}`} style={{ "--sheet-h": `${sheetH}px` } as CSSProperties}>
      <MapErrorBoundary>
        <TripMap
          plan={plan}
          corridor={corridor}
          hour={hour}
          heatHour={hour + heatOffset}
          showHeat={showHeat}
          selectedRoute={selectedRoute}
          selectedCheckpoint={selectedCp}
          padding={padding}
          onSelectCheckpoint={selectCheckpoint}
          onSelectRoute={selectRoute}
        />
      </MapErrorBoundary>

      <header className="topbar">
        <button type="button" className="trip-pill" onClick={() => setEditing(true)} aria-label="Edit trip">
          <span className="tp-text">
            <span className="tp-route">
              {short(plan.trip.origin.label)} → {short(plan.trip.destination.label)}
            </span>
            <span className="tp-meta">
              {fmtDateTime(plan.trip.departure, plan.trip.timezone)} ·{" "}
              <span className="tp-load">{fmtLb(plan.trip.load_lb)}</span> · every {plan.trip.interval_mi} mi
            </span>
          </span>
          <span className="tp-edit" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z" />
              <path d="M13.5 6.5l4 4" />
            </svg>
          </span>
        </button>
        {plan.trip.scenario && (
          <div className="topbar-row">
            <span className="demo-chip">Demo storm (synthetic)</span>
          </div>
        )}
      </header>

      {cpRoute && selectedCp && (
        <CheckpointCard
          route={cpRoute}
          index={selectedCp.index}
          loadLb={plan.trip.load_lb}
          onClose={() => setSelectedCp(null)}
        />
      )}

      <div className="slider-wrap">
        <ForecastSlider
          hour={hour}
          onHour={setHour}
          playing={playing}
          onPlaying={setPlaying}
          departure={plan.trip.departure}
          timezone={plan.trip.timezone}
          track={track}
          routeId={route.id}
          showHeat={showHeat}
          onToggleHeat={toggleHeat}
          heatStatus={heatStatus}
        />
      </div>

      <BottomSheet desktop={desktop} onHeightChange={setSheetH}>
        {details}
      </BottomSheet>

      {editing && <EditTripDialog onClose={closeEdit} />}
    </div>
  );
}
