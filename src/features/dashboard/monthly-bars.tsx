import { dec, formatAmount } from "@/lib/money";

const MONTHS = ["იან", "თებ", "მარ", "აპრ", "მაი", "ივნ", "ივლ", "აგვ", "სექ", "ოქტ", "ნოე", "დეკ"];

/** Sales vs. money collected per month — plain SVG, rendered on the server. */
export function MonthlyBars({ data }: { data: { month: string; total: string; paid: string }[] }) {
  const max = Math.max(1, ...data.flatMap((d) => [dec(d.total).toNumber(), dec(d.paid).toNumber()]));
  const width = 720;
  const height = 220;
  const pad = { top: 12, bottom: 28, left: 0, right: 0 };
  const slot = (width - pad.left - pad.right) / data.length;
  const barW = Math.min(18, slot / 3);
  const scale = (v: string) => (dec(v).toNumber() / max) * (height - pad.top - pad.bottom);

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full" role="img" aria-label="თვიური გაყიდვები">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1={0}
            x2={width}
            y1={height - pad.bottom - f * (height - pad.top - pad.bottom)}
            y2={height - pad.bottom - f * (height - pad.top - pad.bottom)}
            className="stroke-border"
            strokeDasharray="3 4"
          />
        ))}
        {data.map((d, i) => {
          const x = pad.left + i * slot + slot / 2;
          const hTotal = scale(d.total);
          const hPaid = scale(d.paid);
          const monthIndex = Number(d.month.slice(5, 7)) - 1;
          return (
            <g key={d.month}>
              <title>{`${MONTHS[monthIndex]} ${d.month.slice(0, 4)} — გაყიდვა ${formatAmount(d.total)} ₾, აღებული ${formatAmount(d.paid)} ₾`}</title>
              <rect
                x={x - barW - 1}
                y={height - pad.bottom - hTotal}
                width={barW}
                height={Math.max(hTotal, 0)}
                rx={3}
                className="fill-gold"
              />
              <rect
                x={x + 1}
                y={height - pad.bottom - hPaid}
                width={barW}
                height={Math.max(hPaid, 0)}
                rx={3}
                className="fill-foreground/70"
              />
              <text x={x} y={height - 8} textAnchor="middle" className="fill-muted-foreground text-[11px]">
                {MONTHS[monthIndex]}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-gold" /> გაყიდვა
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-foreground/70" /> აღებული თანხა
        </span>
      </div>
    </div>
  );
}
