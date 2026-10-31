import { useEffect, useRef } from "react";
import type { Level } from "../api";
import { LEVELS, levelHex, levelName } from "../lib/risk";
import { fmtDateTime } from "../lib/time";

const HOURS = 48;
const PLAY_HOURS_PER_SECOND = 3;

interface Props {
  hour: number;
  onHour: (h: number) => void;
  playing: boolean;
  onPlaying: (p: boolean) => void;
  departure: string;
  timezone: string;
  /** risk the selected truck meets each hour; undefined after arrival */
  track: (Level | null | undefined)[];
  routeId: string;
  showHeat: boolean;
  onToggleHeat: () => void;
  /** one line about the corridor forecast, e.g. "Calm for the next 48 h" */
  heatStatus: string | null;
}

/**
 * Time control for the whole map: moving it shows the forecast at that hour on the heatmap
 * and where each truck would be. Its track is the risk timeline of the selected truck.
 */
export function ForecastSlider(props: Props) {
  const { hour, onHour, playing, onPlaying, departure, timezone, track, routeId } = props;
  const raf = useRef(0);
  const hourRef = useRef(hour);
  hourRef.current = hour;

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const tick = (now: number) => {
      const next = hourRef.current + ((now - last) / 1000) * PLAY_HOURS_PER_SECOND;
      last = now;
      if (next >= HOURS) {
        onHour(HOURS);
        onPlaying(false);
        return;
      }
      onHour(next);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, onHour, onPlaying]);

  const at = new Date(new Date(departure).getTime() + hour * 3600_000);
  const now = track[Math.min(track.length - 1, Math.floor(hour))];

  return (
    <div className="slider">
      <div className="slider-row">
        <button
          type="button"
          className="play"
          aria-label={playing ? "Pause forecast" : "Play forecast"}
          onClick={() => {
            if (!playing && hour >= HOURS) onHour(0);
            onPlaying(!playing);
          }}
        >
          {playing ? (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
        <div className="slider-main">
          <div className="slider-top">
            <span className="slider-time">
              +{hour.toFixed(hour < 10 ? 1 : 0)}h · {fmtDateTime(at, timezone)}
            </span>
            <span className="slider-now">
              {now === undefined ? (
                `Route ${routeId} arrived`
              ) : (
                <>
                  Route {routeId} truck: <b style={{ color: levelHex(now) }}>{levelName(now)}</b>
                </>
              )}
            </span>
          </div>
          <div className="scrub">
            <div className="strip" aria-hidden="true">
              {track.map((lv, i) => (
                <i key={i} style={{ background: lv === undefined ? "#22344B" : levelHex(lv) }} />
              ))}
            </div>
            <div className="thumb" style={{ left: `${(hour / HOURS) * 100}%` }} aria-hidden="true" />
            <input
              type="range"
              min={0}
              max={HOURS}
              step={0.05}
              value={hour}
              aria-label="Hours after departure: moves the forecast and the trucks"
              aria-valuetext={`${hour.toFixed(1)} hours after departure`}
              onChange={(e) => {
                onPlaying(false);
                onHour(Number(e.target.value));
              }}
            />
          </div>
          <div className="slider-ticks muted" aria-hidden="true">
            <span>Depart</span>
            <span>+12h</span>
            <span>+24h</span>
            <span>+36h</span>
            <span>+48h</span>
          </div>
        </div>
      </div>

      <div className="slider-foot">
        <button
          type="button"
          className={`heat-toggle${props.showHeat ? " on" : ""}`}
          aria-pressed={props.showHeat}
          onClick={props.onToggleHeat}
          title="Weather risk for your load along the corridor, at the time on the slider"
        >
          <span className="switch" aria-hidden="true" />
          Risk map
        </button>
        <div className="legend" aria-label="Risk levels">
          {LEVELS.map((l) => (
            <span key={l.name}>
              <i style={{ background: l.hex }} />
              {l.name}
            </span>
          ))}
        </div>
      </div>
      {props.showHeat && props.heatStatus && <p className="heat-status">{props.heatStatus}</p>}
    </div>
  );
}
