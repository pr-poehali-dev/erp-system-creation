import { useEffect, useMemo, useState } from "react";
import Icon from "@/components/ui/icon";
import { api, RealtorsReport, RealtorReportRow } from "@/lib/api";
import { QUALIFICATIONS } from "@/lib/commission";

type SortKey = "commission" | "closed" | "name";

const QUAL_BADGE: Record<string, string> = {
  novice:  "bg-blue-100 text-blue-700",
  inTopic: "bg-amber-100 text-amber-700",
  pro:     "bg-emerald-100 text-emerald-700",
};

const fmtMoney = (n: number) =>
  `₽ ${Math.round(n).toLocaleString("ru")}`;

export default function RealtorsRanking() {
  const [data, setData] = useState<RealtorsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("commission");

  const load = () => {
    setLoading(true);
    api.realtorsReport().then(setData).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const sorted: RealtorReportRow[] = useMemo(() => {
    if (!data) return [];
    const list = [...data.realtors];
    if (sortKey === "commission") {
      list.sort((a, b) => Number(b.commission_total) - Number(a.commission_total));
    } else if (sortKey === "closed") {
      list.sort((a, b) => Number(b.closed_count) - Number(a.closed_count));
    } else {
      list.sort((a, b) => a.name.localeCompare(b.name, "ru"));
    }
    return list;
  }, [data, sortKey]);

  if (loading) {
    return <div className="h-32 bg-secondary rounded-xl animate-pulse" />;
  }
  if (!data) return null;

  return (
    <div className="bg-white border border-border rounded-xl overflow-hidden">
      {/* Шапка */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-wrap gap-3">
        <div>
          <h2 className="font-semibold text-[14px]">Топ риэлторов</h2>
          <p className="text-hint text-[12px] mt-0.5">
            Активных риэлторов: {data.totals.realtors} · закрытых сделок: {data.totals.closed_total} · 
            выручка {fmtMoney(data.totals.revenue_total)} · комиссии {fmtMoney(data.totals.commission_total)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[12px] text-hint">Сортировка:</span>
          {([
            { key: "commission" as SortKey, label: "По комиссии" },
            { key: "closed"     as SortKey, label: "По закрытым" },
            { key: "name"       as SortKey, label: "По ФИО" },
          ]).map(opt => (
            <button key={opt.key}
              onClick={() => setSortKey(opt.key)}
              className={`text-[12px] px-2.5 py-1 rounded-md font-medium transition-colors ${
                sortKey === opt.key
                  ? "bg-primary text-white"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}>
              {opt.label}
            </button>
          ))}
          <button onClick={load}
            className="ml-2 p-1.5 rounded-md hover:bg-secondary text-muted-foreground"
            title="Обновить">
            <Icon name="RefreshCw" size={14} />
          </button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="text-center py-10 text-hint">
          <Icon name="UserSquare" size={28} className="mx-auto mb-2" />
          Активных риэлторов пока нет
        </div>
      ) : (
        <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-secondary/50 text-left text-[11px] uppercase text-hint">
              <th className="px-4 py-2.5 font-medium w-10">#</th>
              <th className="px-4 py-2.5 font-medium">Риэлтор</th>
              <th className="px-4 py-2.5 font-medium">Квалификация</th>
              <th className="px-4 py-2.5 font-medium text-right">Закрыто</th>
              <th className="px-4 py-2.5 font-medium text-right">Открыто</th>
              <th className="px-4 py-2.5 font-medium text-right">Выручка (закр.)</th>
              <th className="px-4 py-2.5 font-medium text-right">Комиссия</th>
              <th className="px-4 py-2.5 font-medium">До след. уровня</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, idx) => {
              const qual = QUALIFICATIONS[r.qualification] || QUALIFICATIONS.novice;
              return (
                <tr key={r.id} className="border-t border-border hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3 text-[13px] font-bold text-muted-foreground">{idx + 1}</td>
                  <td className="px-4 py-3 text-[13px] font-medium">{r.name}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] px-2 py-0.5 rounded-md font-medium ${QUAL_BADGE[r.qualification] || QUAL_BADGE.novice}`}>
                      {qual.label} · {qual.rate}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[13px] font-semibold text-right">{r.closed_count}</td>
                  <td className="px-4 py-3 text-[13px] text-right text-muted-foreground">{r.open_count}</td>
                  <td className="px-4 py-3 text-[13px] text-right">{fmtMoney(Number(r.closed_revenue))}</td>
                  <td className="px-4 py-3 text-[13px] font-bold text-emerald-600 text-right">
                    {fmtMoney(Number(r.commission_total))}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-muted-foreground">
                    {r.next_level && r.next_rate
                      ? `+${r.to_next} до ${QUALIFICATIONS[r.next_level].label} (${r.next_rate}%)`
                      : <span className="text-emerald-600 font-medium">Максимум</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}