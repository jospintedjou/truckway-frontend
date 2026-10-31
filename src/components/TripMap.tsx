import { PathLayer, ScatterplotLayer, SolidPolygonLayer, TextLayer } from "@deck.gl/layers";
import { MapboxOverlay } from "@deck.gl/mapbox";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { Corridor, Level, Plan, Route } from "../api";
import { cellColor, cellPolygon, stormLabels } from "../lib/heat";
import { LEVELS, levelRgb } from "../lib/risk";
import { positionAt } from "../lib/track";
import { MapFallback, webglSupported } from "./MapFallback";

const STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const TEAL: [number, number, number] = [94, 234, 212];
const SLATE: [number, number, number] = [107, 134, 163];
const RED = LEVELS[4].rgb;

export interface MapPadding {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

interface Props {
  plan: Plan;
  corridor: Corridor | null;
  /** hours since departure */
  hour: number;
  /** forecast frame index matching `hour` (corridor frames start on the hour before departure) */
  heatHour: number;
  showHeat: boolean;
  selectedRoute: string;
  selectedCheckpoint: { route: string; index: number } | null;
  padding: MapPadding;
  onSelectCheckpoint: (route: string, index: number) => void;
  onSelectRoute: (route: string) => void;
}

function placeName(label: string): string {
  return label.split(",")[0].trim();
}

/**
 * The CARTO dark style is very muted. Lift state borders, highways and place names so a
 * route reads against real geography, and match the background to the app's navy.
 * Matches layers by type and id so it doesn't depend on exact layer names.
 * Returns false until the style's layers are available.
 */
function tuneBasemap(map: maplibregl.Map): boolean {
  const layers = map.getStyle()?.layers;
  if (!layers?.length) return false;
  for (const layer of layers) {
    const id = layer.id.toLowerCase();
    try {
      if (layer.type === "background") {
        map.setPaintProperty(layer.id, "background-color", "#0B1A2E");
      } else if (layer.type === "fill" && id.includes("water")) {
        map.setPaintProperty(layer.id, "fill-color", "#0F2C47");
      } else if (layer.type === "line" && (id.includes("boundary") || id.includes("admin"))) {
        map.setPaintProperty(layer.id, "line-color", id.includes("country") ? "#5D7A99" : "#3E5B7A");
      } else if (layer.type === "line" && /motorway|highway|trunk/.test(id) && !id.includes("casing")) {
        map.setPaintProperty(layer.id, "line-color", "#33506E");
      } else if (layer.type === "line" && /road|primary|secondary/.test(id) && !id.includes("casing")) {
        map.setPaintProperty(layer.id, "line-color", "#22394F");
      } else if (layer.type === "symbol" && layer.layout && "text-field" in layer.layout) {
        const place = /place|city|town|state|country|capital/.test(id);
        map.setPaintProperty(layer.id, "text-color", place ? "#D5E1EC" : "#93A8BC");
        map.setPaintProperty(layer.id, "text-halo-color", "#0B1A2E");
        map.setPaintProperty(layer.id, "text-halo-width", 1.4);
      }
    } catch {
      /* a layer that doesn't accept the property: leave it as styled */
    }
  }
  return true;
}

interface CpDatum {
  route: string;
  index: number;
  position: [number, number];
  level: Level | null;
  escalated: boolean;
  selectedRoute: boolean;
}

function TripMapInner(props: Props) {
  const { plan, corridor, hour, heatHour, showHeat, selectedRoute, selectedCheckpoint, padding } = props;
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const handlers = useRef(props);
  handlers.current = props;

  const [mapFailed, setMapFailed] = useState(() => !webglSupported());

  // ---- map lifecycle ----
  useEffect(() => {
    if (!container.current || mapFailed) return;
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: container.current,
        style: STYLE,
        center: [-98, 38],
        zoom: 3.5,
        attributionControl: { compact: true },
        dragRotate: false,
        pitchWithRotate: false,
      });
    } catch (err) {
      // e.g. WebGL blocked by the browser or the GPU driver: keep the rest of the page usable
      console.warn("Map unavailable", err);
      setMapFailed(true);
      return;
    }
    map.touchZoomRotate.disableRotation();
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    let tuned = false;
    map.on("styledata", () => {
      if (!tuned) tuned = tuneBasemap(map);
    });
    const overlay = new MapboxOverlay({ interleaved: false, layers: [] });
    map.addControl(overlay as unknown as maplibregl.IControl);
    mapRef.current = map;
    overlayRef.current = overlay;
    return () => {
      overlayRef.current = null;
      mapRef.current = null;
      map.remove();
    };
  }, [mapFailed]);

  // fit all routes once per plan (and when the panel layout changes)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let minLon = Infinity;
    let minLat = Infinity;
    let maxLon = -Infinity;
    let maxLat = -Infinity;
    for (const r of plan.routes) {
      for (const [lon, lat] of r.geometry) {
        minLon = Math.min(minLon, lon);
        maxLon = Math.max(maxLon, lon);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
      }
    }
    if (!Number.isFinite(minLon)) return;
    // Camera moves don't need the style to be loaded; only a real container size.
    map.resize();
    map.fitBounds(
      [
        [minLon, minLat],
        [maxLon, maxLat],
      ],
      { padding, duration: 0, maxZoom: 9 },
    );
  }, [plan, padding]);

  // ---- static data (rebuilt only when the plan or selection changes) ----
  const routeOrder = useMemo(
    () => [...plan.routes].sort((a, b) => Number(a.id === selectedRoute) - Number(b.id === selectedRoute)),
    [plan, selectedRoute],
  );

  const checkpoints = useMemo<CpDatum[]>(
    () =>
      routeOrder.flatMap((r) =>
        r.checkpoints.map((c, index) => ({
          route: r.id,
          index,
          position: [c.lon, c.lat] as [number, number],
          level: c.level,
          escalated: c.load_escalated,
          selectedRoute: r.id === selectedRoute,
        })),
      ),
    [routeOrder, selectedRoute],
  );

  const cellIds = useMemo(() => (corridor ? corridor.cells.lat.map((_, i) => i) : []), [corridor]);
  const endpoints = useMemo(
    () => [
      { position: [plan.trip.origin.lon, plan.trip.origin.lat], kind: "origin", name: placeName(plan.trip.origin.label) },
      {
        position: [plan.trip.destination.lon, plan.trip.destination.lat],
        kind: "destination",
        name: placeName(plan.trip.destination.label),
      },
    ],
    [plan],
  );
  // "Route A" tags halfway along each route, so the map reads without the side panel
  const routeTags = useMemo(
    () =>
      plan.routes.map((r) => ({
        id: r.id,
        position: positionAt(r.geometry, r.duration_s / 2),
        eligible: r.summary.eligible,
      })),
    [plan],
  );

  // ---- dynamic data (follows the slider) ----
  const frame = Math.round(heatHour * 20) / 20; // 3-minute steps are plenty for color blending
  const labels = useMemo(() => (corridor && showHeat ? stormLabels(corridor, heatHour) : []), [corridor, showHeat, heatHour]);
  const trucks = useMemo(
    () =>
      plan.routes.map((r) => ({
        route: r.id,
        position: positionAt(r.geometry, hour * 3600),
        selected: r.id === selectedRoute,
        arrived: hour * 3600 >= r.duration_s,
      })),
    [plan, hour, selectedRoute],
  );

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const selectedCp = selectedCheckpoint;

    const layers = [
      corridor &&
        new SolidPolygonLayer<number>({
          id: "heat",
          data: cellIds,
          visible: showHeat,
          getPolygon: (i) => cellPolygon(corridor, i),
          getFillColor: (i) => cellColor(corridor, i, frame),
          updateTriggers: { getFillColor: [frame] },
          pickable: false,
        }),
      new PathLayer<Route>({
        id: "route-glow",
        data: routeOrder.filter((r) => r.id === selectedRoute),
        getPath: (r) => r.geometry.map((p) => [p[0], p[1]] as [number, number]),
        getColor: (r) => [...(r.summary.eligible ? TEAL : RED), 55],
        getWidth: 16,
        widthUnits: "pixels",
        capRounded: true,
        jointRounded: true,
      }),
      new PathLayer<Route>({
        id: "routes",
        data: routeOrder,
        getPath: (r) => r.geometry.map((p) => [p[0], p[1]] as [number, number]),
        getColor: (r) =>
          !r.summary.eligible ? [...RED, 230] : r.id === selectedRoute ? [...TEAL, 255] : [...SLATE, 200],
        getWidth: (r) => (r.id === selectedRoute ? 5 : 3),
        widthUnits: "pixels",
        capRounded: true,
        jointRounded: true,
        pickable: true,
        onClick: (info) => {
          if (info.object) handlers.current.onSelectRoute(info.object.id);
          return true;
        },
        updateTriggers: { getColor: [selectedRoute], getWidth: [selectedRoute] },
      }),
      new ScatterplotLayer<CpDatum>({
        id: "checkpoints",
        data: checkpoints,
        getPosition: (d) => d.position,
        getRadius: (d) =>
          selectedCp && selectedCp.route === d.route && selectedCp.index === d.index
            ? 9
            : d.level === 4
              ? 7
              : d.selectedRoute
                ? 5
                : 3,
        radiusUnits: "pixels",
        getFillColor: (d) => [...levelRgb(d.level), d.selectedRoute ? 255 : 150],
        stroked: true,
        getLineColor: (d) => (d.level === 4 ? [255, 255, 255, 255] : [11, 26, 46, 255]),
        getLineWidth: (d) => (d.level === 4 ? 2 : 1.5),
        lineWidthUnits: "pixels",
        pickable: true,
        onClick: (info) => {
          if (info.object) handlers.current.onSelectCheckpoint(info.object.route, info.object.index);
          return true;
        },
        updateTriggers: { getRadius: [selectedCp?.route, selectedCp?.index] },
      }),
      new ScatterplotLayer<CpDatum>({
        id: "load-rings",
        data: checkpoints.filter((d) => d.escalated && d.selectedRoute),
        getPosition: (d) => d.position,
        getRadius: 10,
        radiusUnits: "pixels",
        filled: false,
        stroked: true,
        getLineColor: [255, 255, 255, 220],
        getLineWidth: 1.5,
        lineWidthUnits: "pixels",
      }),
      new ScatterplotLayer({
        id: "endpoints",
        data: endpoints,
        getPosition: (d) => d.position as [number, number],
        getRadius: 7,
        radiusUnits: "pixels",
        getFillColor: (d) => (d.kind === "origin" ? [230, 240, 245, 255] : [255, 77, 106, 255]),
        stroked: true,
        getLineColor: [11, 26, 46, 255],
        getLineWidth: 2,
        lineWidthUnits: "pixels",
      }),
      new ScatterplotLayer({
        id: "trucks",
        data: trucks.filter((t) => !t.arrived || t.selected),
        getPosition: (d) => d.position,
        getRadius: (d) => (d.selected ? 9 : 6),
        radiusUnits: "pixels",
        getFillColor: [11, 26, 46, 255],
        stroked: true,
        getLineColor: (d) => (d.selected ? [...TEAL, 255] : [...SLATE, 255]),
        getLineWidth: (d) => (d.selected ? 3 : 2),
        lineWidthUnits: "pixels",
        updateTriggers: { getLineColor: [selectedRoute], getRadius: [selectedRoute] },
      }),
      new TextLayer({
        id: "endpoint-labels",
        data: endpoints,
        getPosition: (d) => d.position as [number, number],
        getText: (d) => d.name,
        getSize: 13,
        getColor: [230, 240, 245, 255],
        background: true,
        getBackgroundColor: [11, 26, 46, 230],
        getBorderColor: (d) => (d.kind === "origin" ? [230, 240, 245, 160] : [255, 77, 106, 220]),
        getBorderWidth: 1,
        backgroundPadding: [8, 4],
        fontFamily: "Inter, system-ui, sans-serif",
        fontWeight: 600,
        getPixelOffset: [0, -22],
      }),
      new TextLayer({
        id: "route-tags",
        data: routeTags,
        getPosition: (d) => d.position,
        getText: (d) => `Route ${d.id}`,
        getSize: 12,
        getColor: (d) => (d.id === selectedRoute ? [4, 52, 44, 255] : [230, 240, 245, 255]),
        background: true,
        getBackgroundColor: (d) =>
          d.id === selectedRoute ? [...(d.eligible ? TEAL : RED), 255] : d.eligible ? [30, 53, 80, 235] : [90, 20, 36, 235],
        backgroundPadding: [7, 3],
        fontFamily: "Inter, system-ui, sans-serif",
        fontWeight: 600,
        pickable: true,
        onClick: (info) => {
          if (info.object) handlers.current.onSelectRoute(info.object.id);
          return true;
        },
        updateTriggers: { getColor: [selectedRoute], getBackgroundColor: [selectedRoute] },
      }),
      new TextLayer({
        id: "storm-labels",
        data: labels,
        visible: showHeat,
        getPosition: (d) => d.position,
        getText: (d) => d.text,
        getSize: 12,
        getColor: (d) => [...LEVELS[d.level].rgb, 255],
        background: true,
        getBackgroundColor: [17, 36, 59, 235],
        getBorderColor: (d) => [...LEVELS[d.level].rgb, 255],
        getBorderWidth: 1,
        backgroundPadding: [8, 4],
        fontFamily: "Inter, system-ui, sans-serif",
        fontWeight: 500,
        getPixelOffset: [0, -18],
      }),
    ].filter(Boolean);

    overlay.setProps({ layers });
  }, [
    corridor,
    cellIds,
    frame,
    showHeat,
    routeOrder,
    selectedRoute,
    checkpoints,
    selectedCheckpoint,
    endpoints,
    routeTags,
    trucks,
    labels,
  ]);

  if (mapFailed) return <MapFallback />;
  return <div ref={container} className="map" />;
}

export const TripMap = memo(TripMapInner);
