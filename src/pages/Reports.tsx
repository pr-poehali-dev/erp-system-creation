import { useEffect, useState } from "react";
import { Role } from "@/App";
import Icon from "@/components/ui/icon";
import { api, ReportsData } from "@/lib/api";
import RealtorsRanking from "@/components/reports/RealtorsRanking";

interface Props { role: Role; }

const fmt = (n: number) =>
  n >= 1_000_000 ? `₽ ${(n / 1_000_000).toFixed(1)} млн`
  : n >= 1000 ? `₽ ${n.toLocaleString("ru")}`
  : `₽ ${n}`;

const STATUS_ICON: Record<string, string> = {
  success: "CheckCircle", warning: "AlertTriangle", error: "XCircle",
};
const STATUS_CLS: Record<string, string> = {
  success: "badge-success", warning: "badge-warning", error: "badge-error",
};
const STATUS_COLOR: Record<string, string> = {
  success: "text-emerald-500", warning: "text-amber-500", error: "text-red-500",
};

const ROLE_LABELS: Record<string, string> = {
  crm_manager: "Менеджер CRM", realtor: "Риэлтор",
};

export default function Reports({ role }: Props) {
  const showRealtorsRanking = role === "director" || role === "commercial";
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.reports.get().then(setData).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Отчёты и KPI</h1>
          <p className="text-hint mt-0.5">Аналитика · текущий месяц</p>
        </div>
        <button
          onClick={() => { setLoading(true); api.reports.get().then(setData).finally(() => setLoading(false)); }}
          className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-[13px] hover:bg-secondary transition-colors"
        >
          <Icon name="RefreshCw" size={13} className={loading ? "animate-spin" : ""} />
          Обновить
        </button>
      </div>

      {/* Summary row */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Доходы (месяц)",   value: fmt(data.summary.income),   icon: "TrendingUp",   color: "text-emerald-600 bg-emerald-50" },
            { label: "Расходы (месяц)",  value: fmt(data.summary.expense),  icon: "TrendingDown", color: "text-red-600 bg-red-50" },
            { label: "Маржа",            value: `${data.summary.margin}%`,  icon: "Percent",      color: "text-blue-600 bg-blue-50" },
            { label: "Конверсия CRM",    value: `${data.summary.conversion}%`, icon: "Target",   color: "text-violet-600 bg-violet-50" },
          ].map(c => (
            <div key={c.label} className="bg-white rounded-xl border border-border p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${c.color}`}>
                <Icon name={c.icon} size={18} />
              </div>
              <div>
                <div className="text-[20px] font-bold text-foreground">{c.value}</div>
                <div className="text-hint">{c.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Топ риэлторов — только для директора/коммерческого */}
      {showRealtorsRanking && <RealtorsRanking />}

      {/* KPI Grid */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {loading
          ? [1,2,3,4].map(i => (
              <div key={i} className="bg-white rounded-xl border border-border p-4 animate-pulse h-28" />
            ))
          : data?.kpis.map(m => (
              <div key={m.name} className="bg-white rounded-xl border border-border p-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <span className="text-[12px] text-muted-foreground leading-snug">{m.name}</span>
                  <Icon name={STATUS_ICON[m.status]} size={15} className={`shrink-0 mt-0.5 ${STATUS_COLOR[m.status]}`} />
                </div>
                <div className="text-[24px] font-bold text-foreground">{m.value}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-hint text-[11px]">Цель: {m.target}</span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ml-auto ${STATUS_CLS[m.status]}`}>
                    {m.status === "success" ? "Выполнен" : m.status === "warning" ? "Внимание" : "Не достигнут"}
                  </span>
                </div>
                <div className="text-hint text-[11px] mt-1.5">{m.trend}</div>
              </div>
            ))
        }
      </div>

      {/* Managers table */}
      <div className="bg-white rounded-xl border border-border">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-[15px]">Рейтинг менеджеров и риэлторов</h2>
        </div>
        {loading ? (
          <div className="p-5 space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-10 bg-secondary rounded animate-pulse" />)}
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {["#", "Сотрудник", "Роль", "Лидов", "Договоров", "Конверсия", "Выручка", "KPI"].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-hint font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data?.managers.length === 0 ? (
                <tr><td colSpan={8} className="px-5 py-8 text-center text-hint">Нет данных</td></tr>
              ) : data?.managers.map((m, i) => (
                <tr key={m.id} className="hover:bg-background transition-colors">
                  <td className="px-5 py-3.5">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${i === 0 ? "bg-amber-100 text-amber-700" : "bg-secondary text-muted-foreground"}`}>
                      {i + 1}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-[13px] font-medium">{m.name}</td>
                  <td className="px-5 py-3.5 text-hint">{ROLE_LABELS[m.role] || m.role}</td>
                  <td className="px-5 py-3.5 text-[13px]">{m.leads}</td>
                  <td className="px-5 py-3.5 text-[13px] font-semibold">{m.contracts}</td>
                  <td className="px-5 py-3.5 text-[13px]">{m.conversion}%</td>
                  <td className="px-5 py-3.5 text-[13px] font-semibold">{fmt(m.revenue)}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${m.kpi}%` }} />
                      </div>
                      <span className={`text-[12px] font-bold ${m.kpi >= 80 ? "text-emerald-600" : "text-amber-600"}`}>{m.kpi}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Brigades */}
      <div className="bg-white rounded-xl border border-border">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-[15px]">Рейтинг бригад / прорабов</h2>
        </div>
        {loading ? (
          <div className="p-5 space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-10 bg-secondary rounded animate-pulse" />)}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {data?.brigades.length === 0 ? (
              <div className="px-5 py-8 text-center text-hint">Нет данных</div>
            ) : data?.brigades.map((b, i) => (
              <div key={b.id} className="px-5 py-4 flex items-center gap-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0 ${i === 0 ? "bg-amber-100 text-amber-700" : "bg-secondary text-muted-foreground"}`}>
                  #{i + 1}
                </div>
                <div className="flex-1">
                  <div className="text-[13px] font-semibold">{b.name}</div>
                  <div className="text-hint text-[12px]">
                    Объектов: {b.total_projects} · Сдано: {b.done_projects} · Ср. срок: {b.avg_days > 0 ? `${b.avg_days} дн.` : "нет данных"}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Icon name="Star" size={14} className="text-amber-400 fill-amber-400" />
                  <span className="text-[13px] font-bold">{b.rating.toFixed(1)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Request stats */}
      {data && Object.keys(data.req_stats).length > 0 && (
        <div className="bg-white rounded-xl border border-border p-5">
          <h2 className="font-semibold text-[15px] mb-4">Заявки на материалы — статистика</h2>
          <div className="flex gap-4">
            {[
              { key: "new",       label: "Новые",     cls: "badge-warning" },
              { key: "ordered",   label: "Заказаны",  cls: "badge-info" },
              { key: "delivered", label: "Доставлены", cls: "badge-success" },
            ].map(s => (
              <div key={s.key} className="flex-1 bg-background rounded-xl p-4 text-center">
                <div className="text-[28px] font-bold text-foreground">
                  {data.req_stats[s.key]?.count ?? 0}
                </div>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${s.cls}`}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}