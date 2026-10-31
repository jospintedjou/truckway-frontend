import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { cellColor, stormLabels } from "../lib/heat";
import { LEVELS, levelHex } from "../lib/risk";
import { positionAt } from "../lib/track";
import { liteMapRequested } from "./MapFallback";
import type { MapProps } from "./TripMap";

/**
 * Simple map for browsers without WebGL: Leaflet with raster tiles and a 2D canvas.
 * Same data and interactions as the WebGL map (routes, checkpoints, risk map, trucks).
 */

// Standard OpenStreetMap tiles (no key), darkened with a CSS filter to match the app.
// Fine for a fallback; heavy production traffic should use a tile provider with a plan.
const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TEAL = "#5EEAD4";
const SLATE = "#6B86A3";
const RED = LEVELS[4].hex;

const latLng = (p: [number, number] | [number, number, number]): L.LatLngTuple => [p[1], p[0]];

function tagIcon(text: string, className: string): L.DivIcon {
  const span = document.createElement("span");
  span.textContent = text; // place names come from the geocoder: never inject them as HTML
  // no iconSize: the label sizes to its text and CSS centers it on the point
  return L.divIcon({ html: span, className: `lite-tag ${className}`, iconSize: null as unknown as L.PointExpression });
}

export default function LiteMap(props: MapProps) {
  const { plan, corridor, hour, heatHour, showHeat, selectedRoute, selectedCheckpoint, padding } = props;
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const groups = useRef<{ heat: L.LayerGroup; routes: L.LayerGroup; trucks: L.LayerGroup; labels: L.LayerGroup } | null>(
    null,
  );
  const renderers = useRef<{ heat: L.Canvas; routes: L.Canvas } | null>(null);
  const cells = useRef<L.Rectangle[]>([]);
  const handlers = useRef(props);
  handlers.current = props;

  useEffect(() => {
    if (!el.current) return;
    const map = L.map(el.current, { zoomControl: false, attributionControl: true });
    // panes keep the risk map under the routes whatever order layers are added in
    map.createPane("heat").style.zIndex = "350";
    map.createPane("routes").style.zIndex = "420";
    map.createPane("trucks").style.zIndex = "440";
    L.tileLayer(TILES, {
      maxZoom: 12,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    L.control.zoom({ position: "topright" }).addTo(map);
    renderers.current = { heat: L.canvas({ pane: "heat" }), routes: L.canvas({ pane: "routes" }) };
    groups.current = {
      heat: L.layerGroup().addTo(map),
      routes: L.layerGroup().addTo(map),
      trucks: L.layerGroup().addTo(map),
      labels: L.layerGroup().addTo(map),
    };
    map.setView([38, -98], 4);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      groups.current = null;
      cells.current = [];
    };
  }, []);

  // fit the routes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const bounds = L.latLngBounds(plan.routes.flatMap((r) => r.geometry.map(latLng)));
    if (!bounds.isValid()) return;
    map.invalidateSize();
    map.fitBounds(bounds, {
      paddingTopLeft: [padding.left, padding.top],
      paddingBottomRight: [padding.right, padding.bottom],
      maxZoom: 9,
    });
  }, [plan, padding]);

  // routes, checkpoints, endpoints, route tags
  useEffect(() => {
    const g = groups.current;
    const r = renderers.current;
    if (!g || !r) return;
    g.routes.clearLayers();
    const ordered = [...plan.routes].sort((a, b) => Number(a.id === selectedRoute) - Number(b.id === selectedRoute));
    for (const route of ordered) {
      const selected = route.id === selectedRoute;
      const color = !route.summary.eligible ? RED : selected ? TEAL : SLATE;
      const path = route.geometry.map(latLng);
      if (selected) {
        L.polyline(path, { renderer: r.routes, pane: "routes", color, weight: 14, opacity: 0.22, interactive: false }).addTo(
          g.routes,
        );
      }
      L.polyline(path, { renderer: r.routes, pane: "routes", color, weight: selected ? 5 : 3, opacity: selected ? 1 : 0.8 })
        .on("click", () => handlers.current.onSelectRoute(route.id))
        .addTo(g.routes);

      route.checkpoints.forEach((c, index) => {
        const isSel = selectedCheckpoint?.route === route.id && selectedCheckpoint.index === index;
        L.circleMarker([c.lat, c.lon], {
          renderer: r.routes,
          pane: "routes",
          radius: isSel ? 9 : c.level === 4 ? 7 : selected ? 5 : 3,
          color: c.level === 4 ? "#ffffff" : "#0B1A2E",
          weight: c.level === 4 ? 2 : 1.5,
          fillColor: levelHex(c.level),
          fillOpacity: selected ? 1 : 0.6,
        })
          .on("click", () => handlers.current.onSelectCheckpoint(route.id, index))
          .addTo(g.routes);
      });

      const mid = positionAt(route.geometry, route.duration_s / 2);
      const tagClass = selected ? (route.summary.eligible ? "selected" : "blocked selected") : route.summary.eligible ? "" : "blocked";
      L.marker(latLng(mid), { icon: tagIcon(`Route ${route.id}`, tagClass), pane: "trucks" })
        .on("click", () => handlers.current.onSelectRoute(route.id))
        .addTo(g.routes);
    }

    const ends = [
      { p: plan.trip.origin, cls: "origin" },
      { p: plan.trip.destination, cls: "destination" },
    ];
    for (const { p, cls } of ends) {
      L.circleMarker([p.lat, p.lon], {
        renderer: r.routes,
        pane: "routes",
        radius: 7,
        color: "#0B1A2E",
        weight: 2,
        fillColor: cls === "origin" ? "#E6F0F5" : "#FF4D6A",
        fillOpacity: 1,
        interactive: false,
      }).addTo(g.routes);
      L.marker([p.lat, p.lon], {
        icon: tagIcon(p.label.split(",")[0], `place ${cls}`),
        pane: "trucks",
        interactive: false,
      }).addTo(g.routes);
    }
  }, [plan, selectedRoute, selectedCheckpoint]);

  // risk map cells, created once per corridor
  useEffect(() => {
    const g = groups.current;
    const r = renderers.current;
    if (!g || !r) return;
    g.heat.clearLayers();
    cells.current = [];
    if (!corridor) return;
    const hy = corridor.cells.dlat / 2;
    const hx = corridor.cells.dlon / 2;
    corridor.cells.lat.forEach((lat, i) => {
      const lon = corridor.cells.lon[i];
      const rect = L.rectangle(
        [
          [lat - hy, lon - hx],
          [lat + hy, lon + hx],
        ],
        { renderer: r.heat, pane: "heat", stroke: false, fillOpacity: 0, interactive: false },
      );
      rect.addTo(g.heat);
      cells.current.push(rect);
    });
  }, [corridor]);

  // recolor cells for the slider time (Leaflet batches canvas redraws per frame)
  const frame = Math.round(heatHour * 10) / 10;
  useEffect(() => {
    const map = mapRef.current;
    const g = groups.current;
    if (!map || !g) return;
    if (!showHeat || !corridor) {
      if (map.hasLayer(g.heat)) map.removeLayer(g.heat);
      return;
    }
    if (!map.hasLayer(g.heat)) g.heat.addTo(map);
    cells.current.forEach((rect, i) => {
      const [cr, cg, cb, a] = cellColor(corridor, i, frame);
      rect.setStyle({ fillColor: `rgb(${cr | 0},${cg | 0},${cb | 0})`, fillOpacity: a / 255 });
    });
  }, [corridor, frame, showHeat]);

  // trucks and storm labels follow the slider
  const labels = useMemo(() => (corridor && showHeat ? stormLabels(corridor, frame) : []), [corridor, showHeat, frame]);
  useEffect(() => {
    const g = groups.current;
    const r = renderers.current;
    if (!g || !r) return;
    g.trucks.clearLayers();
    for (const route of plan.routes) {
      const selected = route.id === selectedRoute;
      if (hour * 3600 >= route.duration_s && !selected) continue;
      L.circleMarker(latLng(positionAt(route.geometry, hour * 3600)), {
        renderer: r.routes,
        pane: "routes",
        radius: selected ? 9 : 6,
        color: selected ? TEAL : SLATE,
        weight: selected ? 3 : 2,
        fillColor: "#0B1A2E",
        fillOpacity: 1,
        interactive: false,
      }).addTo(g.trucks);
    }
    g.labels.clearLayers();
    for (const l of labels) {
      L.marker(latLng(l.position), {
        icon: tagIcon(l.text, `storm level-${l.level}`),
        pane: "trucks",
        interactive: false,
      }).addTo(g.labels);
    }
  }, [plan, hour, selectedRoute, labels]);

  return (
    <div className="map lite-map">
      <div ref={el} className="lite-map-canvas" />
      <span className="lite-badge" title="A simpler map is shown because WebGL isn't available">
        Simple map
      </span>
      <LiteNotice />
    </div>
  );
}

/** Tells the user once why the map looks different. Hides itself after a few seconds. */
function LiteNotice() {
  const forced = liteMapRequested();
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 9000);
    return () => clearTimeout(t);
  }, []);
  if (!visible) return null;
  return (
    <div className="lite-notice" role="status">
      <div>
        <strong>Switched to the simple map</strong>
        <p>
          {forced
            ? "You opened the page with ?map=lite."
            : "Your browser can't run the full map (WebGL is off or blocked)."}{" "}
          Routes, risk, the forecast slider and the timeline all work the same.
        </p>
      </div>
      <button type="button" className="icon" aria-label="Dismiss" onClick={() => setVisible(false)}>
        ×
      </button>
    </div>
  );
}
