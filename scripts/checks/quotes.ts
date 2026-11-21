// check.ts section: quotes. Run: bun run check
import { formatLong, istHour } from "@/lib/dates";
import { QUOTES, nextOrder, shuffledOrder } from "@/lib/quotes";
import { ok } from "@/scripts/checks/helpers";

console.log("quotes");
{
  let s = 3;
  const rnd = () => (s = (s * 48271) % 2147483647) / 2147483647;
  const order = shuffledOrder(QUOTES.length, rnd);
  ok(
    order.length === QUOTES.length && new Set(order).size === QUOTES.length,
    "a shuffle shows every quote exactly once",
  );
  ok(
    order.some((v, i) => v !== i),
    "…in a mixed-up order",
  );
  let clash = false;
  for (let k = 0; k < 200; k++) if (nextOrder(5, 2, rnd)[0] === 2) clash = true;
  ok(!clash, "the next round never starts with the quote just shown");
  ok(
    QUOTES.every((q) => q.trim().length > 0 && !/\bGATE\b/.test(q)),
    "quotes are non-empty and not exam-specific",
  );
  ok(formatLong("2026-11-20") === "Friday 20 November", "formatLong: v1's long date");
  ok(
    istHour(Date.UTC(2026, 10, 20, 20, 0)) === 1 && istHour(Date.UTC(2026, 10, 20, 6, 29)) === 11,
    "istHour: UTC+5:30",
  );
}
