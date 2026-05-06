import { Deal } from "@/lib/api";

const STAGES: Record<string, string> = {
  lead:     "Новый лид",
  kp:       "КП отправлено",
  planning: "Планирование",
  closed:   "Закрыта",
};

const FUNNEL_COLORS: Record<string, string> = {
  lead:     "bg-blue-500",
  kp:       "bg-violet-500",
  planning: "bg-amber-500",
  closed:   "bg-emerald-500",
};

const fmt = (n: number) =>
  n >= 1_000_000
    ? `₽ ${(n / 1_000_000).toFixed(1)} млн`
    : n >= 1000
    ? `₽ ${n.toLocaleString("ru")}`
    : `₽ ${n}`;

interface Props {
  deals: Deal[];
  loading: boolean;
}

export default function SalesFunnel({ deals, loading }: Props) {
  const stageCounts = Object.keys(STAGES).reduce(
    (acc, s) => ({ ...acc, [s]: deals.filter((d) => d.stage === s).length }),
    {} as Record<string, number>
  );
  const totalDeals = deals.length;
  const closedDeals = stageCounts["closed"] || 0;
  const conversion = totalDeals > 0 ? ((closedDeals / totalDeals) * 100).toFixed(1) : "0.0";
  const totalBudget = deals.reduce((s, d) => s + (d.budget || 0), 0);
  const avgBudget = totalDeals > 0 ? Math.round(totalBudget / totalDeals) : 0;
  const maxCount = Math.max(...Object.values(stageCounts), 1);

  return (
    <div className="bg-white rounded-xl border border-border p-5">
      <h2 className="font-semibold text-[15px] mb-4">Воронка продаж</h2>
      <div className="flex items-end gap-3 h-32">
        {Object.entries(STAGES).map(([key, label]) => (
          <div key={key} className="flex-1 flex flex-col items-center gap-2">
            <span className="text-[13px] font-semibold text-foreground">
              {loading ? "—" : stageCounts[key] ?? 0}
            </span>
            <div
              className={`w-full rounded-t-md ${FUNNEL_COLORS[key]} transition-all`}
              style={{
                height: loading
                  ? "20%"
                  : `${(((stageCounts[key] ?? 0) / maxCount) * 100) || 4}%`,
              }}
            />
            <span className="text-hint text-[11px] text-center leading-tight">
              {label}
            </span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4 mt-5 pt-4 border-t border-border">
        <div>
          <div className="text-hint text-[12px]">Конверсия (лид→закрыта)</div>
          <div className="text-[18px] font-bold text-foreground mt-1">
            {loading ? "—" : `${conversion}%`}
          </div>
        </div>
        <div>
          <div className="text-hint text-[12px]">Средний бюджет</div>
          <div className="text-[18px] font-bold text-foreground mt-1">
            {loading ? "—" : fmt(avgBudget)}
          </div>
        </div>
        <div>
          <div className="text-hint text-[12px]">Всего сделок</div>
          <div className="text-[18px] font-bold text-foreground mt-1">
            {loading ? "—" : totalDeals}
          </div>
        </div>
      </div>
    </div>
  );
}
