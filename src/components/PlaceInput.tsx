import { useEffect, useId, useRef, useState } from "react";
import { api, type Place } from "../api";

interface Props {
  label: string;
  icon: "origin" | "destination";
  value: Place;
  onChange: (place: Place) => void;
  placeholder: string;
}

/** Text field with place suggestions. Typing clears the chosen coordinates until a suggestion is picked. */
export function PlaceInput({ label, icon, value, onChange, placeholder }: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Required<Place>[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const typed = useRef(false);

  useEffect(() => {
    const q = value.label.trim();
    if (!typed.current || q.length < 3 || value.lat !== undefined) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      api
        .geocode(q, ctrl.signal)
        .then((r) => {
          setResults(r.results);
          setActive(0);
          setOpen(true);
        })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [value.label, value.lat]);

  const pick = (p: Required<Place>) => {
    typed.current = false;
    onChange(p);
    setOpen(false);
  };

  return (
    <div className="field place">
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <div className="input-wrap">
        <span className={`place-dot ${icon}`} aria-hidden="true" />
        <input
          id={id}
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          autoComplete="off"
          value={value.label}
          placeholder={placeholder}
          onChange={(e) => {
            typed.current = true;
            onChange({ label: e.target.value });
          }}
          onFocus={() => results.length && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (!open || !results.length) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => (a + 1) % results.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => (a - 1 + results.length) % results.length);
            } else if (e.key === "Enter") {
              e.preventDefault();
              pick(results[active]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
        />
        {loading && <span className="spinner" aria-label="Searching" />}
        {value.lat !== undefined && <span className="check" aria-label="Place selected">✓</span>}
      </div>
      {open && results.length > 0 && (
        <ul id={`${id}-list`} role="listbox" className="suggestions">
          {results.map((r, i) => (
            <li
              key={`${r.lat},${r.lon}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? "active" : undefined}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(r);
              }}
            >
              {r.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
