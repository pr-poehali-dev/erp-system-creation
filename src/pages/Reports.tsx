import { Role } from "@/App";
import Icon from "@/components/ui/icon";

interface Props { role: Role; }

const kpiMetrics = [
  { name: "K_company (скорость компании)", value: "0.87", target: "0.90", status: "warning", trend: "↓ 0.02 к прошлой неделе" },
  { name: "Конверсия лид → договор", value: "11.8%", target: "15%", status: "warning", trend: "↑ 0.5% к прошлому месяцу" },
  { name: "Средний срок сдачи дома", value: "64 дня", target: "62 дня", status: "error", trend: "↑ +2 дня к нормативу" },
  { name: "Маржинальность стройки", value: "33.9%", target: "35%", status: "warning", trend: "↔ Стабильно" },
  { name: "NPS клиентов", value: "74", target: "80", status: "warning", trend: "↑ +3 к прошлому кварталу" },
  { name: "Загрузка бригад", value: "87%", target: "80%", status: "success", trend: "↑ Выше нормы" },
];

const managers = [
  { name: "Тихонов А.В.", role: "CRM-менеджер", leads: 34, deals: 14, conv: "41.2%", revenue: "98.4 млн", kpi: 94 },
  { name: "Кузнецова В.И.", role: "CRM-менеджер", leads: 28, deals: 11, conv: "39.3%", revenue: "77.1 млн", kpi: 88 },
  { name: "Алексеев П.Д.", role: "Риэлтор", leads: 19, deals: 7, conv: "36.8%", revenue: "46.9 млн", kpi: 85 },
];

const brigades = [
  { name: "Бригада №1 (Соколов)", projects: 4, onTime: 4, avgDays: 61, rating: 4.9 },
  { name: "Бригада №3 (Захаров)", projects: 5, onTime: 4, avgDays: 64, rating: 4.6 },
  { name: "Бригада №4 (Романов)", projects: 3, onTime: 2, avgDays: 67, rating: 4.1 },
];

const statusColor: Record<string, string> = {
  success: "badge-success",
  warning: "badge-warning",
  error: "badge-error",
};

const statusIcon: Record<string, string> = {
  success: "CheckCircle",
  warning: "AlertTriangle",
  error: "XCircle",
};

export default function Reports({ role }: Props) {
  return (
    <div className="space-y-6 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Отчёты и KPI</h1>
          <p className="text-hint mt-0.5">Аналитика · KPI по отделам · май 2026</p>
        </div>
        <div className="flex gap-2">
          <select className="px-3 py-2 border border-border rounded-lg text-[13px] bg-white outline-none">
            <option>Май 2026</option>
            <option>Апрель 2026</option>
            <option>Q1 2026</option>
          </select>
          <button className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-[13px] hover:bg-secondary transition-colors">
            <Icon name="Download" size={13} />
            Экспорт PDF
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
        {kpiMetrics.map(m => (
          <div key={m.name} className="bg-white rounded-xl border border-border p-4">
            <div className="flex items-start justify-between gap-2 mb-3">
              <span className="text-[13px] text-muted-foreground leading-snug">{m.name}</span>
              <Icon name={statusIcon[m.status]} size={15} className={`shrink-0 mt-0.5 ${m.status === "success" ? "text-emerald-500" : m.status === "warning" ? "text-amber-500" : "text-red-500"}`} />
            </div>
            <div className="text-[24px] font-bold text-foreground">{m.value}</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-hint">Цель: {m.target}</span>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ml-auto ${statusColor[m.status]}`}>
                {m.status === "success" ? "Выполнен" : m.status === "warning" ? "Внимание" : "Не достигнут"}
              </span>
            </div>
            <div className="text-[11px] text-muted-foreground mt-2">{m.trend}</div>
          </div>
        ))}
      </div>

      {/* Managers KPI */}
      <div className="bg-white rounded-xl border border-border">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-[15px]">Рейтинг менеджеров CRM и риэлторов</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {["Сотрудник", "Роль", "Лидов", "Договоров", "Конверсия", "Выручка", "KPI"].map(h => (
                <th key={h} className="px-5 py-3 text-left text-hint font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {managers.map((m, i) => (
              <tr key={m.name} className="hover:bg-background transition-colors">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${i === 0 ? "bg-amber-100 text-amber-700" : "bg-secondary text-muted-foreground"}`}>
                      {i + 1}
                    </div>
                    <span className="text-[13px] font-medium">{m.name}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-hint">{m.role}</td>
                <td className="px-5 py-3.5 text-[13px]">{m.leads}</td>
                <td className="px-5 py-3.5 text-[13px] font-semibold">{m.deals}</td>
                <td className="px-5 py-3.5 text-[13px]">{m.conv}</td>
                <td className="px-5 py-3.5 text-[13px] font-semibold">₽ {m.revenue}</td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${m.kpi}%` }} />
                    </div>
                    <span className={`text-[12px] font-bold ${m.kpi >= 90 ? "text-emerald-600" : "text-amber-600"}`}>{m.kpi}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Brigades */}
      <div className="bg-white rounded-xl border border-border">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-[15px]">Рейтинг бригад (скорость + качество)</h2>
        </div>
        <div className="divide-y divide-border">
          {brigades.map((b, i) => (
            <div key={b.name} className="px-5 py-4 flex items-center gap-4">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0 ${i === 0 ? "bg-amber-100 text-amber-700" : "bg-secondary text-muted-foreground"}`}>
                #{i + 1}
              </div>
              <div className="flex-1">
                <div className="text-[13px] font-semibold">{b.name}</div>
                <div className="text-hint">Домов: {b.projects} · В срок: {b.onTime}/{b.projects} · Ср. срок: {b.avgDays} дн.</div>
              </div>
              <div className="flex items-center gap-1">
                <Icon name="Star" size={14} className="text-amber-400 fill-amber-400" />
                <span className="text-[13px] font-bold">{b.rating}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
