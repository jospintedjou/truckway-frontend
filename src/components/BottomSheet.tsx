import { useEffect, useRef, useState, type ReactNode } from "react";

export const PEEK_PX = 210;

export function useIsDesktop(): boolean {
  const query = "(min-width: 900px)";
  const [desktop, setDesktop] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setDesktop(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return desktop;
}

const snaps = () => [PEEK_PX, Math.round(window.innerHeight * 0.5), Math.round(window.innerHeight * 0.88)];

/**
 * Mobile: a draggable sheet with three snap points (verdict, routes, full timeline).
 * Desktop: the same content in a side panel that can be hidden to free the map.
 */
export function BottomSheet({
  children,
  desktop,
  onHeightChange,
  collapsed = false,
  onToggleCollapsed,
}: {
  children: ReactNode;
  desktop: boolean;
  onHeightChange?: (px: number) => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const [height, setHeight] = useState(PEEK_PX);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ y: number; h: number; moved: boolean } | null>(null);

  useEffect(() => onHeightChange?.(desktop ? 0 : height), [height, desktop, onHeightChange]);

  if (desktop)
    return (
      <>
        <aside id="trip-panel" className={`panel${collapsed ? " collapsed" : ""}`} aria-label="Trip details">
          {children}
        </aside>
        <button
          type="button"
          className="panel-toggle"
          onClick={onToggleCollapsed}
          aria-controls="trip-panel"
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Show trip details" : "Hide trip details"}
          title={collapsed ? "Show trip details" : "Hide trip details"}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d={collapsed ? "M9 6l6 6-6 6" : "M15 6l-6 6 6 6"} />
          </svg>
        </button>
      </>
    );

  const snapTo = (h: number) => {
    const s = snaps();
    setHeight(s.reduce((best, v) => (Math.abs(v - h) < Math.abs(best - h) ? v : best), s[0]));
  };

  const cycle = () => {
    const s = snaps();
    const i = s.findIndex((v) => Math.abs(v - height) < 8);
    setHeight(s[(i + 1) % s.length]);
  };

  return (
    <section className={`sheet${dragging ? " dragging" : ""}`} style={{ height }} aria-label="Trip details">
      <div
        className="sheet-handle"
        role="button"
        tabIndex={0}
        aria-label="Resize trip details"
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          drag.current = { y: e.clientY, h: height, moved: false };
          setDragging(true);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const dy = d.y - e.clientY;
          if (Math.abs(dy) > 4) d.moved = true;
          setHeight(Math.min(window.innerHeight * 0.92, Math.max(120, d.h + dy)));
        }}
        onPointerUp={() => {
          const d = drag.current;
          drag.current = null;
          setDragging(false);
          if (d && !d.moved) cycle();
          else snapTo(height);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            cycle();
          }
        }}
      >
        <span />
      </div>
      <div className="sheet-body">{children}</div>
    </section>
  );
}
