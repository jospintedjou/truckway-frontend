import { Component, type ErrorInfo, type ReactNode } from "react";

/** True when the browser can create a WebGL context (needed by MapLibre and deck.gl). */
export function webglSupported(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/** Shown in place of the map when it can't be drawn. The routes, verdict and timeline still work. */
export function MapFallback() {
  return (
    <div className="map map-fallback" role="note">
      <div className="map-fallback-card">
        <h2>The map can't be shown in this browser</h2>
        <p className="muted">
          It needs WebGL, which is turned off or blocked here (often hardware acceleration is disabled, or the browser runs
          in a virtual machine or remote desktop). The recommendation, routes and checkpoint timeline below still work.
        </p>
        <p className="muted small">
          To fix it: turn on hardware acceleration in your browser settings and restart it, or try another browser.
        </p>
      </div>
    </div>
  );
}

/** Keeps a map crash (WebGL context lost, driver error) from blanking the whole page. */
export class MapErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn("Map crashed", error, info.componentStack);
  }

  render() {
    return this.state.failed ? <MapFallback /> : this.props.children;
  }
}
