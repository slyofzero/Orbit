// check.ts section: dates. Run: bun run check
import {
  addDays,
  addMonths,
  daysInMonth,
  formatDate,
  isIsoDate,
  monthGrid,
  formatRange,
  parseDateRange,
  suggestRanges,
  parseDateText,
  todayIST,
  weekday,
} from "@/lib/dates";
import { ok } from "@/scripts/checks/helpers";

console.log("dates");
{
  ok(
    todayIST(Date.UTC(2026, 10, 17, 18, 29)) === "2026-11-17" &&
      todayIST(Date.UTC(2026, 10, 17, 18, 30)) === "2026-11-18",
    "todayIST flips at IST midnight",
  );
  ok(
    isIsoDate("2028-02-29") && !isIsoDate("2027-02-29") && !isIsoDate("2026-13-01") && !isIsoDate("18/11/2026"),
    "isIsoDate",
  );
  ok(
    addDays("2026-12-31", 1) === "2027-01-01" && addDays("2026-03-01", -1) === "2026-02-28",
    "addDays across month and year",
  );
  ok(
    addMonths("2026-01-31", 1) === "2026-02-28" && addMonths("2026-11-15", -12) === "2025-11-15",
    "addMonths clamps to month end",
  );
  ok(weekday("2026-11-16") === 0 && weekday("2026-11-22") === 6, "weekday: Monday = 0, Sunday = 6");
  const grid = monthGrid(2026, 11);
  ok(
    grid.length === 42 && grid[0].date === "2026-10-26" && grid.filter((c) => c.inMonth).length === 30,
    "month grid starts on a Monday",
  );
  ok(formatDate("2026-11-18") === "Wed, 18 Nov 2026", "formatDate");
  ok(daysInMonth(2000, 2) === 29 && daysInMonth(1900, 2) === 28, "leap years");
}
{
  // a date typed by hand (DatePicker typeable)
  const t = "2026-11-21";
  const plan = { starts_on: "2026-11-09", ends_on: "2027-02-08" };
  const pd = (s: string) => parseDateText(s, t, plan);
  ok(
    pd("today") === t && pd(" Tomorrow ") === "2026-11-22" && pd("yesterday") === "2026-11-20",
    "parseDateText: today, tomorrow, yesterday",
  );
  ok(
    pd("2026-11-23") === "2026-11-23" &&
      pd("23 Nov") === "2026-11-23" &&
      pd("23 november") === "2026-11-23" &&
      pd("Nov 23") === "2026-11-23" &&
      pd("23rd Nov") === "2026-11-23" &&
      pd("Mon, 23 Nov 2026") === "2026-11-23" &&
      pd("23/11") === "2026-11-23" &&
      pd("23/11/26") === "2026-11-23" &&
      pd("1 sept") === "2026-09-01", // outside the plan in either year: today's year
    "parseDateText: the usual ways to write a date",
  );
  ok(pd("5 Jan") === "2027-01-05", "parseDateText: no year takes the one inside the plan");
  ok(
    pd("31 Feb") === null &&
      pd("Task 1") === null &&
      pd("revise eigenvalues") === null &&
      pd("23") === null &&
      pd("") === null &&
      pd("ma 3") === null,
    "parseDateText: other text is not a date",
  );
}
{
  // a day, week or month typed by hand (DateFilter)
  const t = "2026-11-21"; // a Saturday
  const plan = { starts_on: "2026-11-09", ends_on: "2027-02-08" };
  const pr = (s: string) => {
    const r = parseDateRange(s, t, plan);
    return r ? `${r.unit} ${r.from} ${r.to}` : null;
  };
  ok(
    pr("23 Nov") === "day 2026-11-23 2026-11-23" && pr("today") === "day 2026-11-21 2026-11-21",
    "parseDateRange: a day",
  );
  ok(
    pr("this week") === "week 2026-11-16 2026-11-22" &&
      pr("Week") === "week 2026-11-16 2026-11-22" &&
      pr("next week") === "week 2026-11-23 2026-11-29" &&
      pr("last week") === "week 2026-11-09 2026-11-15" &&
      pr("week of 25 Nov") === "week 2026-11-23 2026-11-29" &&
      pr("week 1 jan") === "week 2026-12-28 2027-01-03",
    "parseDateRange: weeks run Monday to Sunday",
  );
  ok(
    pr("this month") === "month 2026-11-01 2026-11-30" &&
      pr("next month") === "month 2026-12-01 2026-12-31" &&
      pr("last month") === "month 2026-10-01 2026-10-31" &&
      pr("November") === "month 2026-11-01 2026-11-30" &&
      pr("feb") === "month 2027-02-01 2027-02-28" &&
      pr("Feb 2028") === "month 2028-02-01 2028-02-29" &&
      pr("12/2026") === "month 2026-12-01 2026-12-31",
    "parseDateRange: months (no year = the one inside the plan)",
  );
  ok(
    pr("") === null && pr("revise") === null && pr("week of nothing") === null && pr("13/2026") === null,
    "parseDateRange: other text is not a range",
  );
  ok(
    formatRange(parseDateRange("23 Nov", t)!) === "Mon, 23 Nov 2026" &&
      formatRange(parseDateRange("next week", t)!) === "Week of 23 Nov 2026 (to 29 Nov)" &&
      formatRange(parseDateRange("this month", t)!) === "November 2026",
    "formatRange: how a range reads",
  );
  const wr = parseDateRange("saturday", t, plan)!;
  ok(
    wr.unit === "weekday" &&
      wr.weekday === 5 &&
      wr.from === plan.starts_on &&
      wr.to === plan.ends_on &&
      pr("sat") === pr("saturday") &&
      pr("Saturdays") === pr("saturday") &&
      pr("every saturday") === pr("saturday") &&
      formatRange(wr) === "Every Saturday",
    "parseDateRange: a weekday alone is every one of them in the plan",
  );
  ok(
    pr("this saturday") === "day 2026-11-21 2026-11-21" &&
      pr("next sat") === "day 2026-11-28 2026-11-28" &&
      pr("last saturday") === "day 2026-11-14 2026-11-14" &&
      pr("this monday") === "day 2026-11-23 2026-11-23" &&
      pr("mon") !== null &&
      pr("month") === "month 2026-11-01 2026-11-30",
    "parseDateRange: this / next / last weekday is one day",
  );
  const labels = (s: string) => suggestRanges(s, t, plan).map((x) => x.label);
  ok(
    labels("sat").join(" | ") ===
      "Every Saturday | This Saturday · Sat, 21 Nov 2026 | Next Saturday · Sat, 28 Nov 2026 | Last Saturday · Sat, 14 Nov 2026",
    "suggestRanges: a weekday offers every / this / next / last",
  );
  ok(
    labels("")[0] === "Today · Sat, 21 Nov 2026" &&
      labels("23 nov")[0] === "Mon, 23 Nov 2026" &&
      labels("no").includes("November 2026") &&
      labels("ne").length === 6 &&
      labels("xyz").length === 0,
    "suggestRanges: quick picks, a typed date, phrase starts, at most 6, nothing for nonsense",
  );
}
