"use client";

import { useEffect, useRef, useState } from "react";

import { formatMonth } from "@/lib/dates";
import { dec, formatAmount } from "@/lib/money";
import { cn } from "@/lib/utils";

const CARD_WIDTH = 208; // w-52

const MONTHS = ["იან", "თებ", "მარ", "აპრ", "მაი", "ივნ", "ივლ", "აგვ", "სექ", "ოქტ", "ნოე", "დეკ"];

/**
 * Sales vs. money collected per month, one column per month (plain HTML, so it fills any width).
 * Hovering a column (mouse) or tapping it (touch) shows that month's numbers in a card.
 * `scroll` = many months: fixed column width, scrolls sideways, opens at the newest month, and
 * every January is labelled with its year.
 */
export function MonthlyBars({
  data,
  scroll = false,
}: {
  data: { month: string; total: string; paid: string }[];
  scroll?: boolean;
}) {
  // The shown month and where its card goes (px from the chart's left edge).
  const [shown, setShown] = useState<{ index: number; left: number } | null>(null);
  const active = shown?.index ?? null;
  const scroller = useRef<HTMLDivElement>(null);
  const chart = useRef<HTMLDivElement>(null);

  const show = (index: number, column: HTMLElement) => {
    const box = chart.current!.getBoundingClientRect();
    const col = column.getBoundingClientRect();
    const centre = col.left - box.left + col.width / 2;
    // Centred over the column, but kept inside the chart at both ends.
    setShown({ index, left: Math.min(Math.max(centre - CARD_WIDTH / 2, 0), Math.max(box.width - CARD_WIDTH, 0)) });
  };
  // Long history: open at the newest months.
  useEffect(() => {
    if (scroll && scroller.current) scroller.current.scrollLeft = scroller.current.scrollWidth;
  }, [scroll]);

  const max = Math.max(1, ...data.flatMap((d) => [dec(d.total).toNumber(), dec(d.paid).toNumber()]));
  const pct = (v: string) => `${Math.max((dec(v).toNumber() / max) * 100, 0)}%`;

  return (
    <div className="w-full">
      <div ref={scroller} className={cn(scroll && "overflow-x-auto pb-1")}>
        <div
          ref={chart}
          className={cn("relative", scroll && "w-max min-w-full")}
          onPointerLeave={(e) => {
            if (e.pointerType === "mouse") setShown(null);
          }}
        >
          {/* Grid lines over the bar area (the labels row, h-6, is below it). */}
          <div className="pointer-events-none absolute inset-x-0 top-3 bottom-6">
            {[0, 25, 50, 75].map((top) => (
              <div key={top} className="absolute inset-x-0 border-t border-dashed border-border" style={{ top: `${top}%` }} />
            ))}
          </div>

          <div className="relative flex h-56" role="group" aria-label="თვიური გაყიდვები">
            {data.map((d, i) => {
              const monthIndex = Number(d.month.slice(5, 7)) - 1;
              const isActive = active === i;
              const dimmed = active !== null && !isActive;
              const yearLabel = scroll && monthIndex === 0;
              return (
                <button
                  key={d.month}
                  type="button"
                  aria-label={`${formatMonth(d.month)}: გაყიდვა ${formatAmount(d.total)} ₾, აღებული ${formatAmount(d.paid)} ₾`}
                  aria-pressed={isActive}
                  // Mouse: hover shows the card. Touch: a tap toggles it (no hover on a phone).
                  onPointerEnter={(e) => {
                    if (e.pointerType === "mouse") show(i, e.currentTarget);
                  }}
                  onClick={(e) => {
                    if ((e.nativeEvent as PointerEvent).pointerType !== "mouse" && isActive) setShown(null);
                    else show(i, e.currentTarget);
                  }}
                  className={cn(
                    "flex min-w-0 flex-1 cursor-pointer flex-col rounded-md pt-3 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                    scroll && "w-11 flex-none",
                    isActive && "bg-muted",
                  )}
                >
                  <span className="flex min-h-0 flex-1 items-end justify-center gap-0.5 px-0.5 sm:gap-1">
                    <span
                      className={cn("w-[38%] max-w-[18px] rounded-t-[3px] bg-gold transition-opacity", dimmed && "opacity-40")}
                      style={{ height: pct(d.total) }}
                    />
                    <span
                      className={cn(
                        "w-[38%] max-w-[18px] rounded-t-[3px] bg-foreground/70 transition-opacity",
                        dimmed && "opacity-40",
                      )}
                      style={{ height: pct(d.paid) }}
                    />
                  </span>
                  <span
                    className={cn(
                      "flex h-6 items-center justify-center truncate text-[10px] sm:text-[11px]",
                      isActive || yearLabel ? "font-semibold text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {yearLabel ? d.month.slice(0, 4) : MONTHS[monthIndex]}
                  </span>
                </button>
              );
            })}
          </div>

          {shown && data[shown.index] ? <MonthCard {...data[shown.index]} left={shown.left} /> : null}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-gold" /> გაყიდვა
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-foreground/70" /> აღებული თანხა
        </span>
        <span className="ml-auto [@media(hover:none)]:hidden">მიიტანეთ კურსორი სვეტზე</span>
        <span className="ml-auto [@media(hover:hover)]:hidden">შეეხეთ სვეტს დეტალებისთვის</span>
      </div>
    </div>
  );
}

function MonthCard({
  month,
  total,
  paid,
  left,
}: {
  month: string;
  total: string;
  paid: string;
  left: number;
}) {
  return (
    <div
      role="status"
      className="pointer-events-none absolute top-0 z-10 w-52 rounded-lg border bg-popover p-3 text-sm text-popover-foreground shadow-lg"
      style={{ left }}
    >
      <div className="mb-2 font-semibold">{formatMonth(month)}</div>
      <dl className="space-y-1">
        <Row color="bg-gold" label="გაყიდვა" value={total} />
        <Row color="bg-foreground/70" label="აღებული" value={paid} />
        <div className="flex items-center justify-between gap-3 border-t pt-1 text-muted-foreground">
          <dt>სხვაობა</dt>
          <dd className="tabular-nums">{formatAmount(dec(total).minus(paid))} ₾</dd>
        </div>
      </dl>
    </div>
  );
}

function Row({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="inline-flex items-center gap-1.5 text-muted-foreground">
        <span className={cn("size-2.5 rounded-sm", color)} />
        {label}
      </dt>
      <dd className="font-medium tabular-nums">{formatAmount(value)} ₾</dd>
    </div>
  );
}
