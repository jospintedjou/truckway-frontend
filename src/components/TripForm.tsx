import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError, type Plan, type PlanInput } from "../api";
import { useTrip } from "../store";
import { LoadInput } from "./LoadInput";
import { PlaceInput } from "./PlaceInput";

const STEPS = ["Finding truck routes", "Timing each checkpoint", "Reading the forecast at your ETAs", "Scoring risk for your load"];
const INTERVALS: PlanInput["interval_mi"][] = [10, 25, 50];

/** The trip details form. Used on the plan page and in the edit dialog on the map. */
export function TripForm({
  demoAllowed,
  submitLabel = "Find the safest route",
  onPlanned,
}: {
  demoAllowed: boolean;
  submitLabel?: string;
  onPlanned: (plan: Plan) => void;
}) {
  const { form, setForm, setPlan } = useTrip();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!busy) return;
    setStep(0);
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 1100);
    return () => clearInterval(t);
  }, [busy]);

  const update = (patch: Partial<PlanInput>) => setForm({ ...form, ...patch });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.origin.label.trim() || !form.destination.label.trim()) {
      setError("Enter where you're starting and where you're going.");
      return;
    }
    if (!form.load_lb || form.load_lb <= 0) {
      setError("Enter the load weight.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const result = await api.plan(form);
      setPlan(result);
      onPlanned(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <form className="card plan-form" onSubmit={submit} noValidate>
        <div className="places">
          <PlaceInput
            label="From"
            icon="origin"
            placeholder="Dallas, TX"
            value={form.origin}
            onChange={(origin) => update({ origin })}
          />
          <button
            type="button"
            className="swap"
            aria-label="Swap origin and destination"
            onClick={() => update({ origin: form.destination, destination: form.origin })}
          >
            ⇅
          </button>
          <PlaceInput
            label="To"
            icon="destination"
            placeholder="Denver, CO"
            value={form.destination}
            onChange={(destination) => update({ destination })}
          />
        </div>

        <div className="field">
          <label htmlFor="departure" className="field-label">
            Departure
          </label>
          <input
            id="departure"
            type="datetime-local"
            value={form.departure_local}
            onChange={(e) => update({ departure_local: e.target.value })}
          />
          <span className="hint">Local time at the starting point. Up to 72 hours ahead.</span>
        </div>

        <LoadInput value={form.load_lb} onChange={(load_lb) => update({ load_lb })} />

        <div className="field">
          <span className="field-label" id="interval-label">
            Check the weather every
          </span>
          <div className="segmented" role="radiogroup" aria-labelledby="interval-label">
            {INTERVALS.map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={form.interval_mi === v}
                className={form.interval_mi === v ? "on" : undefined}
                onClick={() => update({ interval_mi: v })}
              >
                {v} mi
              </button>
            ))}
          </div>
        </div>

        {demoAllowed && (
          <label className="demo-toggle">
            <input
              type="checkbox"
              checked={form.scenario === "storm"}
              onChange={(e) => update({ scenario: e.target.checked ? "storm" : null })}
            />
            <span>
              Add a demo storm <span className="muted">(synthetic, for walkthroughs)</span>
            </span>
          </label>
        )}

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <button className="primary big" type="submit" disabled={busy}>
          {busy ? "Planning…" : submitLabel}
        </button>
      </form>

      {busy && (
        <div className="loading-overlay" role="status" aria-live="polite">
          <div className="loading-card">
            <div className="route-loader" aria-hidden="true">
              <svg viewBox="0 0 120 40">
                <path d="M5 30 C30 30 40 10 60 10 S95 30 115 10" />
              </svg>
            </div>
            <ol>
              {STEPS.map((s, i) => (
                <li key={s} className={i < step ? "done" : i === step ? "now" : undefined}>
                  {s}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </>
  );
}
