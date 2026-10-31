import { useNavigate, useSearchParams } from "react-router-dom";
import { Brand } from "../components/Logo";
import { TripForm } from "../components/TripForm";
import { useTrip } from "../store";

/** Page 2: the trip details. */
export default function PlanPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { form, plan } = useTrip();

  return (
    <main className="screen plan">
      <header className="plan-header">
        <Brand />
        {plan && (
          <button type="button" className="link" onClick={() => navigate("/trip")}>
            Back to last trip →
          </button>
        )}
      </header>

      <section className="plan-hero">
        <h1>
          Where are you <span className="accent">hauling</span> today?
        </h1>
        <p className="muted">
          We check the forecast at the exact time you'll reach each part of the route, then pick the safest of three routes
          for your load.
        </p>
      </section>

      <TripForm demoAllowed={params.has("demo") || form.scenario === "storm"} onPlanned={() => navigate("/trip")} />
    </main>
  );
}
