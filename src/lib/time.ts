const cache = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = tz + JSON.stringify(opts);
  let f = cache.get(key);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat("en-US", { ...opts, timeZone: tz });
    } catch {
      f = new Intl.DateTimeFormat("en-US", { ...opts, timeZone: "UTC" });
    }
    cache.set(key, f);
  }
  return f;
}

/** "Sat 1:30 PM CDT" in the given IANA time zone. */
export function fmtDateTime(date: Date | string | number, tz: string): string {
  return formatter(tz, { weekday: "short", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(
    new Date(date),
  );
}

/** "1:30 PM" */
export function fmtTime(date: Date | string | number, tz: string): string {
  return formatter(tz, { hour: "numeric", minute: "2-digit" }).format(new Date(date));
}

export function fmtDuration(seconds: number): string {
  const m = Math.round(seconds / 60);
  const h = Math.floor(m / 60);
  return h ? `${h}h ${String(m % 60).padStart(2, "0")}m` : `${m}m`;
}

/** Default departure: next quarter hour at least 30 minutes from now, as a datetime-local value. */
export function defaultDeparture(now = new Date()): string {
  const d = new Date(now.getTime() + 30 * 60_000);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
