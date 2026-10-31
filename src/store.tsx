import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import type { Plan, PlanInput } from "./api";
import { defaultDeparture } from "./lib/time";

interface TripState {
  form: PlanInput;
  plan: Plan | null;
  setForm: (form: PlanInput) => void;
  setPlan: (plan: Plan | null) => void;
}

const KEY = "truckway:v1";

const defaultForm = (): PlanInput => ({
  origin: { label: "" },
  destination: { label: "" },
  departure_local: defaultDeparture(),
  load_lb: 42_000,
  interval_mi: 25,
  scenario: null,
});

// sessionStorage keeps the last trip across reloads of the results page.
// It may be unavailable (private mode, blocked storage), so every access is guarded.
function load(): { form: PlanInput; plan: Plan | null } {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as { form: PlanInput; plan: Plan | null };
      return { form: { ...defaultForm(), ...saved.form, departure_local: defaultDeparture() }, plan: saved.plan };
    }
  } catch {
    /* ignore */
  }
  return { form: defaultForm(), plan: null };
}

function save(form: PlanInput, plan: Plan | null) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ form, plan }));
  } catch {
    /* ignore */
  }
}

const Ctx = createContext<TripState | null>(null);

export function TripProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(load);

  const setForm = useCallback((form: PlanInput) => {
    setState((s) => {
      save(form, s.plan);
      return { ...s, form };
    });
  }, []);

  const setPlan = useCallback((plan: Plan | null) => {
    setState((s) => {
      save(s.form, plan);
      return { ...s, plan };
    });
  }, []);

  return <Ctx.Provider value={{ ...state, setForm, setPlan }}>{children}</Ctx.Provider>;
}

export function useTrip(): TripState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTrip outside TripProvider");
  return v;
}
