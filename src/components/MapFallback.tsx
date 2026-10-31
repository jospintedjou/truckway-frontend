import { Component, lazy, Suspense, type ErrorInfo, type ReactNode } from "react";
import type { MapProps } from "./TripMap";

/** True when the browser can create a WebGL context (needed by MapLibre and deck.gl). */
export function webglSupported(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/** Force the simple map with `?map=lite` (handy for testing and demos). */
export function liteMapRequested(): boolean {
  return new URLSearchParams(window.location.search).get("map") === "lite";
}

// Leaflet is only downloaded when the simple map is actually needed.
const LiteMap = lazy(() => import("./LiteMap"));

export function LiteMapLazy(props: MapProps) {
  return (
    <Suspense fallback={<div className="map" />}>
      <LiteMap {...props} />
    </Suspense>
  );
}

/** If the WebGL map crashes after start-up (context lost, driver error), swap in the simple map. */
export class MapErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn("Map crashed, switching to the simple map", error, info.componentStack);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
