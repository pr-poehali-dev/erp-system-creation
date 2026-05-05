import { useEffect, useState } from "react";
import { Role } from "@/App";
import Icon from "@/components/ui/icon";
import { api, DashboardData, KCompany } from "@/lib/api";

interface Props { role: Role; }

const fmt = (n: number) =>
  n >= 1_000_000
    ? `₽ ${(n / 1_000_000).toFixed(1)} млн`
    : n >= 1000
    ? `₽ ${n.toLocaleString("ru")}`
    : `₽ ${n}`;

const kLabel = (k: KCompany) => [
  { dept: "Продажи", k: k.k_sales },
  { dept: "Производство", k: k.k_production },
  { dept: "Скорость стройки", k: k.k_speed },
  { dept: "Оборачиваемость", k: k.k_turnover },
];

export default function Dashboard({ role }: Props) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [recalcing, setRecalcing] = useState(false);

  const load = () => {
    setLoading(true);
    api
      .dashboard()
      .then(setData)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleRecalc = async () => {
    setRecalcing(true);
    try {
      await api.kcompany.calc();
      load();
    } finally {
      setRecalcing(false);
    }
  };

  const k = data?.k_company;

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Панель управления</h1>
          <p className="text-hint mt-0.5">
            {new Date().toLocaleDateString("ru-RU", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          disabled={loading}
        >
          <Icon name="RefreshCw" size={14} className={loading ? "animate-spin" : ""} />
          Обновить
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Выручка (месяц)",
            value: loading ? "—" : fmt(data?.revenue_month ?? 0),
            icon: "TrendingUp",
            color: "text-blue-600 bg-blue-50",
          },
          {
            label: "Активных проектов",
            value: loading ? "—" : String(data?.active_projects ?? 0),
            icon: "HardHat",
            color: "text-emerald-600 bg-emerald-50",
          },
          {
            label: "Сделок в работе",
            value: loading ? "—" : String(data?.active_deals ?? 0),
            icon: "Users",
            color: "text-violet-600 bg-violet-50",
          },
          {
            label: "Заявок на материал",
            value: loading ? "—" : String(data?.pending_requests ?? 0),
            icon: "ShoppingCart",
            color: "text-amber-600 bg-amber-50",
          },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-white rounded-xl border border-border p-4 hover:shadow-md transition-shadow"
          >
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${card.color}`}
            >
              <Icon name={card.icon} size={18} />
            </div>
            <div
              className={`text-[22px] font-bold text-foreground leading-tight ${
                loading ? "animate-pulse text-muted-foreground" : ""
              }`}
            >
              {card.value}
            </div>
            <div className="text-hint mt-0.5">{card.label}</div>
          </div>
        ))}
      </div>

      {/* K_company block */}
      <div className="bg-white rounded-xl border border-border p-5">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <Icon name="Activity" size={18} className="text-primary" />
          <h2 className="font-semibold text-[15px]">
            K_company — Коэффициент скорости компании
          </h2>
          {k && (
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full font-medium ml-auto ${
                k.k_total >= 0.9
                  ? "badge-success"
                  : k.k_total >= 0.8
                  ? "badge-warning"
                  : "badge-error"
              }`}
            >
              {k.k_total.toFixed(2)} / норма 0.90
            </span>
          )}
          {role === "director" && (
            <button
              onClick={handleRecalc}
              disabled={recalcing}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-[12px] hover:bg-secondary transition-colors disabled:opacity-50"
            >
              <Icon
                name="Calculator"
                size={13}
                className={recalcing ? "animate-spin" : ""}
              />
              Пересчитать
            </button>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-background rounded-lg p-4 animate-pulse">
                <div className="h-3 bg-secondary rounded w-2/3 mb-3" />
                <div className="h-7 bg-secondary rounded w-1/2 mb-2" />
                <div className="h-3 bg-secondary rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : k ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {kLabel(k).map((d) => (
                <div key={d.dept} className="bg-background rounded-lg p-4">
                  <div className="text-hint mb-1">{d.dept}</div>
                  <div className="text-[24px] font-bold text-foreground">
                    {d.k.toFixed(2)}
                  </div>
                  <div
                    className={`text-[12px] mt-1 flex items-center gap-1 ${
                      d.k >= 0.9
                        ? "text-emerald-600"
                        : d.k >= 0.8
                        ? "text-amber-500"
                        : "text-red-500"
                    }`}
                  >
                    <Icon
                      name={d.k >= 0.85 ? "TrendingUp" : "TrendingDown"}
                      size={13}
                    />
                    {d.k >= 0.9
                      ? "В норме"
                      : d.k >= 0.8
                      ? "Внимание"
                      : "Ниже нормы"}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-border grid grid-cols-1 md:grid-cols-3 gap-4 text-[13px]">
              <div>
                <span className="text-hint">Продажи факт:</span>{" "}
                <span className="font-semibold">{fmt(k.sales_fact)}</span> / план{" "}
                {fmt(k.sales_plan)}
              </div>
              <div>
                <span className="text-hint">Сдано домов:</span>{" "}
                <span className="font-semibold">{k.houses_fact}</span> / план{" "}
                {k.houses_plan}
              </div>
              <div>
                <span className="text-hint">Средний срок:</span>{" "}
                <span className="font-semibold">{k.avg_duration_days} дн.</span> /
                норма 62
              </div>
            </div>
            {(k.alert || k.alert_sent) && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
                <Icon
                  name="AlertTriangle"
                  size={15}
                  className="text-red-500 shrink-0"
                />
                <span className="text-[13px] text-red-700">
                  K_company ниже порогового значения 0.80 — директору отправлено
                  уведомление
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="text-hint text-center py-8 flex flex-col items-center gap-2">
            <Icon name="BarChart2" size={28} className="text-muted-foreground" />
            <span>Нет данных — нажмите «Пересчитать»</span>
          </div>
        )}
      </div>
    </div>
  );
}
