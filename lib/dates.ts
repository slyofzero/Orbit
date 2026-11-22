// Calendar maths on plain "YYYY-MM-DD" strings. Days are IST calendar days (the planner's day).
// Only todayIST() reads the clock; everything else is pure string/number maths, so it never
// shifts a day because of the viewer's timezone.

export type IsoDate = string; // "2026-11-18"

const pad = (n: number) => String(n).padStart(2, "0");

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
export const WEEKDAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Today's date in India (UTC+5:30), whatever timezone the device is in. */
export function todayIST(now: number = Date.now()): IsoDate {
  const d = new Date(now + 330 * 60_000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function isIsoDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  return mo >= 1 && mo <= 12 && d >= 1 && d <= daysInMonth(y, mo);
}

export function parseIso(s: IsoDate): { y: number; m: number; d: number } {
  return { y: +s.slice(0, 4), m: +s.slice(5, 7), d: +s.slice(8, 10) };
}

export const toIso = (y: number, m: number, d: number): IsoDate => `${y}-${pad(m)}-${pad(d)}`;

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** Days in month `m` (1–12) of year `y`. */
export function daysInMonth(y: number, m: number): number {
  return [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
}

/** Days since 1970-01-01 for a calendar date (no timezone involved). */
function dayNumber(y: number, m: number, d: number): number {
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

function fromDayNumber(n: number): IsoDate {
  const dt = new Date(n * 86_400_000);
  return toIso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function addDays(s: IsoDate, n: number): IsoDate {
  const { y, m, d } = parseIso(s);
  return fromDayNumber(dayNumber(y, m, d) + n);
}

/** Same day `n` months later, clamped to the month's last day (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(s: IsoDate, n: number): IsoDate {
  const { y, m, d } = parseIso(s);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return toIso(ny, nm, Math.min(d, daysInMonth(ny, nm)));
}

/** 0 = Monday … 6 = Sunday. */
export function weekday(s: IsoDate): number {
  const { y, m, d } = parseIso(s);
  return (dayNumber(y, m, d) + 3) % 7; // 1970-01-01 was a Thursday
}

/** The 6×7 grid a month view shows, Monday first, including days from the months around it. */
export function monthGrid(y: number, m: number): { date: IsoDate; inMonth: boolean }[] {
  const first = toIso(y, m, 1);
  const start = addDays(first, -weekday(first));
  return Array.from({ length: 42 }, (_, i) => {
    const date = addDays(start, i);
    return { date, inMonth: parseIso(date).m === m };
  });
}

/** "Wed, 18 Nov 2026" */
export function formatDate(s: IsoDate): string {
  const { y, m, d } = parseIso(s);
  return `${WEEKDAYS_SHORT[weekday(s)]}, ${d} ${MONTHS[m - 1].slice(0, 3)} ${y}`;
}

/** String comparison works for ISO dates; these read better. */
export const isBefore = (a: IsoDate, b: IsoDate) => a < b;
export const isAfter = (a: IsoDate, b: IsoDate) => a > b;

const WEEKDAYS_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** "Friday 20 November" (v1's long date, no year). */
export function formatLong(s: IsoDate): string {
  const { m, d } = parseIso(s);
  return `${WEEKDAYS_LONG[weekday(s)]} ${d} ${MONTHS[m - 1]}`;
}

/** The hour (0–23) in India at a moment, whatever timezone the device is in. */
export function istHour(now: number = Date.now()): number {
  return new Date(now + 330 * 60_000).getUTCHours();
}

/** Whole days from `a` to `b` (negative if `b` is earlier). */
export function daysBetween(a: IsoDate, b: IsoDate): number {
  const pa = parseIso(a);
  const pb = parseIso(b);
  return dayNumber(pb.y, pb.m, pb.d) - dayNumber(pa.y, pa.m, pa.d);
}

/** "18 Nov" (v1's short date). */
export function formatShort(s: IsoDate): string {
  const { m, d } = parseIso(s);
  return `${d} ${MONTHS[m - 1].slice(0, 3)}`;
}

/** A date typed by hand (DateFilter, through parseDateRange). Returns it, or null when the text isn't one.
 *  Understands "today", "tomorrow", "yesterday", "2026-11-23", "23 Nov", "23 november", "Nov 23", "23/11", each with an optional weekday in front ("Mon, 23 Nov") and an optional year ("23 Nov 2026",
 *  "23/11/26"). Without a year it takes the one that puts the date inside `span` (e.g. the plan), else today's year.
 *  A date that doesn't exist ("31 Feb") is not a date. */
export function parseDateText(
  text: string,
  today: IsoDate,
  span?: { starts_on: IsoDate; ends_on: IsoDate },
): IsoDate | null {
  const s = text
    .trim()
    .toLowerCase()
    .replace(/[,.]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^(mon|tue|wed|thu|fri|sat|sun)[a-z]* /, ""); // a weekday in front is just decoration
  if (!s) return null;
  if (s === "today") return today;
  if (s === "tomorrow") return addDays(today, 1);
  if (s === "yesterday") return addDays(today, -1);
  if (isIsoDate(s)) return s;

  // "nov", "novem", "november" (at least 3 letters of the name; "sept" too); 0 = not a month
  const month = (w: string) =>
    w.length < 3 ? 0 : MONTHS.findIndex((m) => m.toLowerCase().startsWith(w === "sept" ? "sep" : w)) + 1;
  let d = 0;
  let m = 0;
  let yText: string | undefined;
  let hit: RegExpExecArray | null;
  if ((hit = /^(\d{1,2})(?:st|nd|rd|th)? ([a-z]+)(?: (\d{2}|\d{4}))?$/.exec(s))) {
    [d, m, yText] = [+hit[1], month(hit[2]), hit[3]];
  } else if ((hit = /^([a-z]+) (\d{1,2})(?:st|nd|rd|th)?(?: (\d{2}|\d{4}))?$/.exec(s))) {
    [d, m, yText] = [+hit[2], month(hit[1]), hit[3]];
  } else if ((hit = /^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2}|\d{4}))?$/.exec(s))) {
    [d, m, yText] = [+hit[1], +hit[2], hit[3]];
  } else return null;
  if (m < 1 || m > 12 || d < 1) return null;

  const fits = (y: number) => d <= daysInMonth(y, m);
  if (yText) {
    const y = yText.length === 2 ? 2000 + +yText : +yText;
    return fits(y) ? toIso(y, m, d) : null;
  }
  const years = span ? [parseIso(span.starts_on).y, parseIso(span.ends_on).y, parseIso(today).y] : [parseIso(today).y];
  for (const y of years) {
    if (!fits(y)) continue;
    const iso = toIso(y, m, d);
    if (!span || (iso >= span.starts_on && iso <= span.ends_on)) return iso;
  }
  const y = parseIso(today).y;
  return fits(y) ? toIso(y, m, d) : null;
}

/** A stretch of days, both ends included: one day, a Monday-to-Sunday week or a calendar month. `weekday` (unit
 *  "weekday", 0 = Monday) keeps only that day of the week between `from` and `to`: "every Saturday". */
export interface DateRange {
  from: IsoDate;
  to: IsoDate;
  unit: "day" | "week" | "month" | "weekday";
  weekday?: number;
}

export const dayRange = (d: IsoDate): DateRange => ({ from: d, to: d, unit: "day" });
export function weekRange(d: IsoDate): DateRange {
  const from = addDays(d, -weekday(d));
  return { from, to: addDays(from, 6), unit: "week" };
}
export function monthRange(y: number, m: number): DateRange {
  return { from: toIso(y, m, 1), to: toIso(y, m, daysInMonth(y, m)), unit: "month" };
}

/** Every `wd` (0 = Monday) inside `span`, or in any year without one. */
export function weekdayRange(wd: number, span?: { starts_on: IsoDate; ends_on: IsoDate }): DateRange {
  return { from: span?.starts_on ?? "0001-01-01", to: span?.ends_on ?? "9999-12-31", unit: "weekday", weekday: wd };
}

/** "sat", "satur", "saturday", "saturdays" → 5 (0 = Monday); -1 = not a weekday. At least 3 letters. */
function weekdayOf(w: string): number {
  const x = w.endsWith("days") ? w.slice(0, -1) : w;
  return x.length < 3 ? -1 : WEEKDAYS_LONG.findIndex((d) => d.toLowerCase().startsWith(x));
}

/** A day, week, month or weekday typed by hand (DateFilter). null = not one. Understands every day parseDateText
 *  does, and weeks: "this week" ("week"), "next week", "last week", "week of 23 Nov" ("week 23 Nov"); months: "this
 *  month" ("month"), "next month", "last month", "Nov", "November", "Nov 2026", "11/2026"; weekdays: "saturday",
 *  "sat", "saturdays", "every saturday" (every one in `span`), "this saturday" (the coming one, today included),
 *  "next saturday" (the one after), "last saturday". A month without a year takes the one that overlaps `span`
 *  (e.g. the plan), else today's year. */
export function parseDateRange(
  text: string,
  today: IsoDate,
  span?: { starts_on: IsoDate; ends_on: IsoDate },
): DateRange | null {
  const s = text.trim().toLowerCase().replace(/[,.]/g, " ").replace(/\s+/g, " ");
  if (!s) return null;
  const t = parseIso(today);
  const step = (n: number) => {
    const k = t.y * 12 + (t.m - 1) + n;
    return monthRange(Math.floor(k / 12), (k % 12) + 1);
  };
  const named: Record<string, () => DateRange> = {
    week: () => weekRange(today),
    "this week": () => weekRange(today),
    "next week": () => weekRange(addDays(today, 7)),
    "last week": () => weekRange(addDays(today, -7)),
    "previous week": () => weekRange(addDays(today, -7)),
    month: () => step(0),
    "this month": () => step(0),
    "next month": () => step(1),
    "last month": () => step(-1),
    "previous month": () => step(-1),
  };
  if (named[s]) return named[s]();

  const wd = /^(?:(every|this|next|last|previous) )?([a-z]+)$/.exec(s);
  if (wd && weekdayOf(wd[2]) >= 0) {
    const n = weekdayOf(wd[2]);
    const coming = addDays(today, (n - weekday(today) + 7) % 7);
    if (!wd[1] || wd[1] === "every") return weekdayRange(n, span);
    return dayRange(wd[1] === "this" ? coming : wd[1] === "next" ? addDays(coming, 7) : addDays(coming, -7));
  }

  const week = /^week (?:of )?(.+)$/.exec(s);
  if (week) {
    const d = parseDateText(week[1], today, span);
    return d ? weekRange(d) : null;
  }
  const day = parseDateText(s, today, span);
  if (day) return dayRange(day);

  // a month: "nov", "november 2026", "11/2026"
  let m = 0;
  let y = 0;
  let hit: RegExpExecArray | null;
  if ((hit = /^([a-z]{3,})(?: (\d{4}))?$/.exec(s))) {
    const w = hit[1] === "sept" ? "sep" : hit[1];
    m = MONTHS.findIndex((x) => x.toLowerCase().startsWith(w)) + 1;
    y = hit[2] ? +hit[2] : 0;
  } else if ((hit = /^(\d{1,2})[/-](\d{4})$/.exec(s))) {
    [m, y] = [+hit[1], +hit[2]];
  }
  if (m < 1 || m > 12) return null;
  if (y) return monthRange(y, m);
  const years = span ? [parseIso(span.starts_on).y, parseIso(span.ends_on).y] : [];
  for (const yy of years) {
    const r = monthRange(yy, m);
    if (span && r.to >= span.starts_on && r.from <= span.ends_on) return r;
  }
  return monthRange(t.y, m);
}

/** How a range reads in a field: "Mon, 23 Nov 2026", "Week of 23 Nov 2026 (to 29 Nov)", "November 2026",
 *  "Every Saturday". */
export function formatRange(r: DateRange): string {
  if (r.unit === "weekday") return `Every ${WEEKDAYS_LONG[r.weekday ?? 0]}`;
  if (r.unit === "day") return formatDate(r.from);
  const { y, m } = parseIso(r.from);
  if (r.unit === "month") return `${MONTHS[m - 1]} ${y}`;
  return `Week of ${formatShort(r.from)} ${y} (to ${formatShort(r.to)})`;
}

/** One line of DateFilter's list: what it reads as, and the range it picks. */
export interface DateSuggestion {
  label: string;
  range: DateRange;
}

const SAME = (a: DateRange, b: DateRange) =>
  a.from === b.from && a.to === b.to && a.unit === b.unit && a.weekday === b.weekday;

/** What DateFilter's list offers for the text typed so far (at most `max`): every phrase it could be the start of,
 *  with the text itself first when it reads as a date no phrase gives ("23 nov") ("sat" → every / this / next / last Saturday;
 *  "ne" → next week, next month; "no" → November). Empty text offers quick picks (today, this and next week,
 *  this month). Labels say both the phrase and the dates: "This Saturday · Sat, 21 Nov 2026". */
export function suggestRanges(
  text: string,
  today: IsoDate,
  span?: { starts_on: IsoDate; ends_on: IsoDate },
  max = 6,
): DateSuggestion[] {
  const s = text.trim().toLowerCase().replace(/[,.]/g, " ").replace(/\s+/g, " ");
  const days = WEEKDAYS_LONG.map((d) => d.toLowerCase());
  const phrases = s
    ? [
        "today",
        "tomorrow",
        "yesterday",
        "this week",
        "next week",
        "last week",
        "this month",
        "next month",
        "last month",
        ...days.flatMap((d) => [`every ${d}`, `this ${d}`, `next ${d}`, `last ${d}`]),
        ...MONTHS.map((m) => m.toLowerCase()),
      ]
    : ["today", "this week", "next week", "this month"];
  // a phrase fits when it starts with the text, or one of its words does ("sat" fits "every saturday")
  const fits = (p: string) => !s || p.startsWith(s) || (!s.includes(" ") && p.split(" ").some((w) => w.startsWith(s)));
  const names = new Set([...days, ...MONTHS.map((m) => m.toLowerCase())]);
  const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);
  /** "this saturday" → "This Saturday · Sat, 21 Nov 2026"; the phrase is left out when the dates already say it. */
  const label = (phrase: string | null, r: DateRange) => {
    const dates = formatRange(r);
    if (!phrase || dates.toLowerCase().startsWith(phrase)) return dates;
    return `${cap(phrase.replace(/[a-z]+/g, (w) => (names.has(w) ? cap(w) : w)))} · ${dates}`;
  };

  const out: DateSuggestion[] = [];
  const add = (phrase: string | null, r: DateRange | null) => {
    if (r && out.length < max && !out.some((o) => SAME(o.range, r))) out.push({ label: label(phrase, r), range: r });
  };
  const typed = s ? parseDateRange(s, today, span) : null;
  for (const p of phrases) if (fits(p)) add(p, parseDateRange(p, today, span));
  // what was typed, as it reads ("23 nov"); first in the list when no phrase already gives it
  if (typed && !out.some((o) => SAME(o.range, typed))) {
    out.unshift({ label: label(null, typed), range: typed });
    out.length = Math.min(out.length, max);
  }
  return out;
}
