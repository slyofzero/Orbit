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
