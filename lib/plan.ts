import { Day } from "./types";

// ---------- date helpers (all dates are plain YYYY-MM-DD strings, IST) ----------
export const todayIST = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

const toUTC = (d: string) => {
  const [y, m, dd] = d.split("-").map(Number);
  return Date.UTC(y, m - 1, dd);
};
export const addDays = (d: string, n: number) => new Date(toUTC(d) + n * 86400000).toISOString().slice(0, 10);
export const daysBetween = (a: string, b: string) => Math.round((toUTC(b) - toUTC(a)) / 86400000);
export const weekday = (d: string) => new Date(toUTC(d)).getUTCDay(); // 0=Sun
export const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const fmtDate = (d: string) =>
  new Date(toUTC(d)).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

export const KIND_LABEL: Record<string, string> = {
  study: "study", light: "light", mock: "mock", crunch: "short day", buffer: "buffer", exam: "exam", taper: "taper",
};


// ---------- milestones ----------
export interface Milestone {
  id: string;
  name: string;
  short: string;
  date: string;
  note?: string;
}

export const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const FULL_WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const fmtLong = (d: string) => `${FULL_WEEKDAYS[weekday(d)]} ${Number(d.slice(8))} ${MONTH_NAMES[Number(d.slice(5, 7)) - 1]}`;

// ---------- a whole plan as one object (the built-in one, or one the user imported) ----------
export interface PlanData {
  name: string;
  days: Day[];
  phaseNames: Record<string, string>; // phase id -> title, in display order
  milestones: Milestone[];
}

export const EMPTY_PLAN: PlanData = { name: "No plan yet", days: [], phaseNames: {}, milestones: [] };
