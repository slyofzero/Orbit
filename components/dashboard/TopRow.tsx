"use client";
// v1's dashboard top row: the greeting with today's date, and the quote banner beside it.

import { useEffect, useRef, useState } from "react";
import { Heading, QuoteBanner, Text } from "@/components/ui";
import { formatLong, istHour, todayIST } from "@/lib/dates";
import { QUOTES, nextOrder, shuffledOrder } from "@/lib/quotes";

const ROTATE_MS = 30 * 60 * 1000; // a new quote every half hour (v1), or when you ask for one

function greeting(hour: number) {
  if (hour < 5) return "Burning the midnight oil";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function TopRow() {
  // Read the clock only in the browser, so the server and the first render agree.
  const [now, setNow] = useState<number | null>(null);
  const [quote, setQuote] = useState<{ order: number[]; pos: number } | null>(null);
  const shownAt = useRef(0);

  const next = () => {
    shownAt.current = Date.now();
    setQuote((q) => {
      if (!q) return { order: shuffledOrder(QUOTES.length), pos: 0 };
      if (q.pos + 1 < q.order.length) return { ...q, pos: q.pos + 1 };
      return { order: nextOrder(QUOTES.length, q.order[q.pos]), pos: 0 }; // every quote shown: shuffle again
    });
  };

  useEffect(() => {
    setNow(Date.now());
    next();
    const t = setInterval(() => {
      setNow(Date.now());
      if (!document.hidden && Date.now() - shownAt.current > ROTATE_MS) next();
    }, 60_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="mb-3.5 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-[22px] gap-y-3 max-[900px]:grid-cols-1">
      <div className="flex flex-wrap items-baseline gap-x-3.5">
        {now !== null && (
          <>
            <Heading level={2} className="text-[1.7rem]">
              {greeting(istHour(now))}
            </Heading>
            <Text as="span" variant="muted" className="font-display text-[1.15rem] font-semibold">
              {formatLong(todayIST(now))}
            </Text>
          </>
        )}
      </div>
      {quote && <QuoteBanner size="sm" quote={QUOTES[quote.order[quote.pos]]} onNext={next} />}
    </div>
  );
}
