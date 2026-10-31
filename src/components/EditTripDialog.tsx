import { useEffect, useRef } from "react";
import { useTrip } from "../store";
import { TripForm } from "./TripForm";

/** Edit the trip without leaving the map. A new plan replaces the current one in place. */
export function EditTripDialog({ onClose }: { onClose: () => void }) {
  const { form } = useTrip();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="edit-trip-title" tabIndex={-1} ref={panel}>
        <div className="dialog-head">
          <h2 id="edit-trip-title">Edit trip</h2>
          <button type="button" className="icon" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <TripForm
          demoAllowed={form.scenario === "storm" || new URLSearchParams(window.location.search).has("demo")}
          submitLabel="Update routes"
          onPlanned={onClose}
        />
      </div>
    </div>
  );
}
