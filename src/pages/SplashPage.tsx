import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { Logo } from "../components/Logo";

const MIN_SPLASH_MS = 1600;

/** Page 1: brand loader. Also wakes the API so the first plan request is fast. */
export default function SplashPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("Checking the forecast service…");

  useEffect(() => {
    let cancelled = false;
    const started = Date.now();
    api
      .health()
      .then(() => !cancelled && setStatus("Ready"))
      .catch(() => !cancelled && setStatus("Server is waking up…"))
      .finally(() => {
        const wait = Math.max(0, MIN_SPLASH_MS - (Date.now() - started));
        setTimeout(() => !cancelled && navigate("/plan", { replace: true }), wait);
      });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <main className="screen splash">
      <div className="splash-glow" aria-hidden="true" />
      <Logo size={88} animated />
      <h1 className="splash-title">Truckway</h1>
      <p className="splash-tag">
        The <span className="accent">safest route</span> for your load
      </p>
      <div className="splash-bar" role="progressbar" aria-label="Loading">
        <span />
      </div>
      <p className="muted small" aria-live="polite">
        {status}
      </p>
    </main>
  );
}
