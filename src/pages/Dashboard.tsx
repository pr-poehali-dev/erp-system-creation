import { Role } from "@/App";
import Icon from "@/components/ui/icon";

interface Props { role: Role; }

const kpiCards = [
  { label: "Выручка (месяц)", value: "₽ 14 280 000", change: "+12%", up: true, icon: "TrendingUp", color: "text-blue-600 bg-blue-50" },
  { label: "Активных проектов", value: "23", change: "+3 новых", up: true, icon: "HardHat", color: "text-emerald-600 bg-emerald-50" },
  { label: "Сделок в CRM", value: "87", change: "12 горячих", up: true, icon: "Users", color: "text-violet-600 bg-violet-50" },
  { label: "K_company", value: "0.87", change: "-0.02 к вчера", up: false, icon: "Activity", color: "text-amber-600 bg-amber-50" },
  { label: "Просрочено этапов", value: "4", change: "Требует внимания", up: false, icon: "AlertTriangle", color: "text-red-600 bg-red-50" },
  { label: "Заявок на закупку", value: "31", change: "8 ожидают", up: false, icon: "ShoppingCart", color: "text-cyan-600 bg-cyan-50" },
];

const recentProjects = [
  { name: "Дом №241 — Иванов А.П.", stage: "Фундамент", progress: 18, daysLeft: 51, status: "warning" },
  { name: "Дом №238 — Петрова С.В.", stage: "Стены", progress: 45, daysLeft: 34, status: "success" },
  { name: "Дом №235 — Сидоров М.Н.", stage: "Кровля", progress: 72, daysLeft: 17, status: "success" },
  { name: "Дом №229 — Козлов Д.И.", stage: "Гарантия", progress: 100, daysLeft: 0, status: "done" },
  { name: "Дом №244 — Новикова Е.О.", stage: "Проектирование", progress: 5, daysLeft: 58, status: "error" },
];

const alerts = [
  { text: "Дом №241: отставание от графика на 3 дня", type: "error", time: "сегодня" },
  { text: "Экскаватор CAT 320 требует ТО (через 50 моточасов)", type: "warning", time: "сегодня" },
  { text: "Поставщик «СтройМат» не подтвердил отгрузку", type: "warning", time: "вчера" },
  { text: "Договор №2241 подписан — создан проект", type: "success", time: "вчера" },
  { text: "K_company пересчитан: 0.87 (норма 0.90)", type: "warning", time: "08:00" },
];

const statusColor = { success: "badge-success", warning: "badge-warning", error: "badge-error", done: "bg-gray-100 text-gray-600" };
const alertIcon = { error: "AlertCircle", warning: "AlertTriangle", success: "CheckCircle" } as const;
const alertColor = { error: "text-red-500", warning: "text-amber-500", success: "text-emerald-500" } as const;

export default function Dashboard({ role }: Props) {
  return (
    <div className="space-y-6 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Панель управления</h1>
          <p className="text-hint mt-0.5">5 мая 2026 · Пн · обновлено в 08:05</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors">
          <Icon name="RefreshCw" size={14} />
          Обновить
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpiCards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-border p-4 hover:shadow-md transition-shadow">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${card.color}`}>
              <Icon name={card.icon} size={18} />
            </div>
            <div className="text-[20px] font-bold text-foreground leading-tight">{card.value}</div>
            <div className="text-hint mt-0.5">{card.label}</div>
            <div className={`text-[11px] mt-1.5 font-medium ${card.up ? "text-emerald-600" : "text-amber-600"}`}>
              {card.change}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Projects table */}
        <div className="xl:col-span-2 bg-white rounded-xl border border-border">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-[15px]">Активные проекты ИЖС</h2>
            <button className="text-primary text-[13px] hover:underline">Все проекты →</button>
          </div>
          <div className="divide-y divide-border">
            {recentProjects.map((p) => (
              <div key={p.name} className="px-5 py-3.5 flex items-center gap-4 hover:bg-background transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-foreground truncate">{p.name}</div>
                  <div className="text-hint mt-0.5">Этап: {p.stage}</div>
                </div>
                <div className="w-32 shrink-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-hint">{p.progress}%</span>
                    {p.daysLeft > 0 && <span className="text-hint">{p.daysLeft} дн.</span>}
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${p.progress}%` }}
                    />
                  </div>
                </div>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0 ${statusColor[p.status as keyof typeof statusColor]}`}>
                  {p.status === "success" ? "В норме" : p.status === "warning" ? "Внимание" : p.status === "error" ? "Отставание" : "Завершён"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Alerts */}
        <div className="bg-white rounded-xl border border-border">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-[15px]">Уведомления</h2>
            <span className="badge-error text-[11px] px-2 py-0.5 rounded-full font-medium">2 срочных</span>
          </div>
          <div className="divide-y divide-border">
            {alerts.map((a, i) => (
              <div key={i} className="px-5 py-3.5 flex items-start gap-3">
                <Icon
                  name={alertIcon[a.type as keyof typeof alertIcon] || "Info"}
                  size={15}
                  className={`mt-0.5 shrink-0 ${alertColor[a.type as keyof typeof alertColor] || "text-blue-500"}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-foreground leading-snug">{a.text}</div>
                  <div className="text-hint mt-0.5">{a.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* K_company block */}
      <div className="bg-white rounded-xl border border-border p-5">
        <div className="flex items-center gap-3 mb-4">
          <Icon name="Activity" size={18} className="text-primary" />
          <h2 className="font-semibold text-[15px]">K_company — Коэффициент скорости компании</h2>
          <span className="badge-warning text-[11px] px-2 py-0.5 rounded-full font-medium ml-auto">0.87 / норма 0.90</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { dept: "Строительство", k: 0.83, trend: "down" },
            { dept: "Снабжение", k: 0.91, trend: "up" },
            { dept: "CRM / Продажи", k: 0.94, trend: "up" },
            { dept: "Аренда техники", k: 0.78, trend: "down" },
          ].map((d) => (
            <div key={d.dept} className="bg-background rounded-lg p-4">
              <div className="text-hint mb-1">{d.dept}</div>
              <div className="text-[22px] font-bold text-foreground">{d.k}</div>
              <div className={`text-[12px] mt-1 flex items-center gap-1 ${d.trend === "up" ? "text-emerald-600" : "text-red-500"}`}>
                <Icon name={d.trend === "up" ? "TrendingUp" : "TrendingDown"} size={13} />
                {d.trend === "up" ? "В норме" : "Ниже нормы"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
