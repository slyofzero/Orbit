// check.ts section: dates. Run: bun run check
import { addDays, addMonths, daysInMonth, formatDate, isIsoDate, monthGrid, todayIST, weekday } from "@/lib/dates";
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
