import { LEVELS } from "../lib/risk";

const MAX = 80_000;
const THRESHOLDS = [30_000, 40_000];

function Chip({ level }: { level: number }) {
  const l = LEVELS[level];
  return (
    <span className="chip" style={{ color: l.hex, borderColor: l.hex }}>
      {l.name}
    </span>
  );
}

/** Load weight with the rule thresholds marked, and a live preview of how wind is classified for it. */
export function LoadInput({ value, onChange }: { value: number; onChange: (lb: number) => void }) {
  const over40 = value > 40_000;
  const over30 = value > 30_000;
  const rows: [string, number, boolean][] = [
    ["Wind 35–44 mph", over40 ? 3 : 2, over40],
    ["Wind 45–54 mph", over30 ? 4 : 3, over30],
    ["Wind 55+ mph", 4, false],
  ];

  return (
    <div className="field">
      <div className="field-row">
        <label htmlFor="load" className="field-label">
          Load weight
        </label>
        <div className="load-number">
          <input
            id="load-number"
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX}
            step={500}
            value={value}
            aria-label="Load weight in pounds"
            onChange={(e) => onChange(Math.min(MAX, Math.max(0, Number(e.target.value) || 0)))}
          />
          <span>lb</span>
        </div>
      </div>
      <div className="load-slider">
        <input
          id="load"
          type="range"
          min={0}
          max={MAX}
          step={500}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        {THRESHOLDS.map((t) => (
          <span key={t} className="tick" style={{ left: `${(t / MAX) * 100}%` }}>
            <span>{t / 1000}k</span>
          </span>
        ))}
      </div>
      <div className="rules" aria-live="polite">
        {rows.map(([label, level, raised]) => (
          <div key={label} className="rule-row">
            <span className="muted">{label}</span>
            <span>
              {raised && (
                <span className="raised" title="Raised by your load">
                  ▲ load
                </span>
              )}
              <Chip level={level} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
