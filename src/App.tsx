import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import PlanPage from "./pages/PlanPage";
import SplashPage from "./pages/SplashPage";
import { TripProvider } from "./store";

// The map bundle (MapLibre + deck.gl) is only needed on the results page.
const TripPage = lazy(() => import("./pages/TripPage"));

export default function App() {
  return (
    <TripProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<SplashPage />} />
          <Route path="/plan" element={<PlanPage />} />
          <Route
            path="/trip"
            element={
              <Suspense fallback={<div className="screen center muted">Loading map…</div>}>
                <TripPage />
              </Suspense>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </TripProvider>
  );
}
