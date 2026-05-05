import { Role } from "@/App";
import Icon from "@/components/ui/icon";

interface Props { role: Role; }

const checklists = [
  { id: "ЧЛ-128", project: "ДОМ-238", stage: "Кровля", inspector: "Петренко А. (ОТК)", date: "05.05.26", passed: 18, total: 22, status: "partial", defects: 4 },
  { id: "ЧЛ-127", project: "ДОМ-241", stage: "Фундамент — армирование", inspector: "Петренко А. (ОТК)", date: "04.05.26", passed: 20, total: 20, status: "passed", defects: 0 },
  { id: "ЧЛ-126", project: "ДОМ-235", stage: "Кровля — финал", inspector: "Волков С. (Telegram)", date: "03.05.26", passed: 15, total: 18, status: "failed", defects: 3 },
  { id: "ЧЛ-125", project: "ДОМ-229", stage: "Гарантийный осмотр", inspector: "Петренко А. (ОТК)", date: "01.05.26", passed: 30, total: 30, status: "passed", defects: 0 },
];

const defects = [
  { id: "ДФ-041", project: "ДОМ-238", desc: "Зазор в стыке профнастила > 5 мм", severity: "medium", assignee: "Бригада №1", status: "open", created: "05.05.26" },
  { id: "ДФ-040", project: "ДОМ-235", desc: "Уклон конька не соответствует проекту (17° вместо 20°)", severity: "high", assignee: "Бригада №4", status: "fixing", created: "03.05.26" },
  { id: "ДФ-039", project: "ДОМ-235", desc: "Недостаточная толщина утеплителя на скате Б", severity: "high", assignee: "Бригада №4", status: "fixing", created: "03.05.26" },
  { id: "ДФ-038", project: "ДОМ-231", desc: "Трещина цокольного ряда (длина 12 см)", severity: "low", assignee: "Бригада №2", status: "resolved", created: "29.04.26" },
];

const statusMap: Record<string, { label: string; cls: string }> = {
  passed: { label: "Принят", cls: "badge-success" },
  partial: { label: "Замечания", cls: "badge-warning" },
  failed: { label: "Отклонён", cls: "badge-error" },
};

const defectStatus: Record<string, { label: string; cls: string }> = {
  open: { label: "Открыт", cls: "badge-error" },
  fixing: { label: "Устраняется", cls: "badge-warning" },
  resolved: { label: "Устранён", cls: "badge-success" },
};

const severityColor: Record<string, string> = {
  high: "text-red-500",
  medium: "text-amber-500",
  low: "text-blue-500",
};

export default function Quality({ role }: Props) {
  return (
    <div className="space-y-6 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Контроль качества</h1>
          <p className="text-hint mt-0.5">Чек-листы, дефекты, приёмка этапов через Telegram-бот</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-[13px] hover:bg-secondary transition-colors">
            <Icon name="MessageCircle" size={13} />
            Telegram-бот
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors">
            <Icon name="Plus" size={14} />
            Новый чек-лист
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Чек-листов (май)", value: "38", sub: "23 — ОТК, 15 — Telegram", icon: "ClipboardCheck", color: "text-blue-600 bg-blue-50" },
          { label: "Прошли приёмку", value: "31", sub: "81.6%", icon: "CheckCircle", color: "text-emerald-600 bg-emerald-50" },
          { label: "Открытых дефектов", value: "4", sub: "2 критичных", icon: "AlertTriangle", color: "text-red-600 bg-red-50" },
          { label: "Устранено в срок", value: "87%", sub: "Целевой показатель 90%", icon: "Target", color: "text-amber-600 bg-amber-50" },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl border border-border p-4">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${c.color}`}>
              <Icon name={c.icon} size={18} />
            </div>
            <div className="text-[20px] font-bold text-foreground">{c.value}</div>
            <div className="text-hint mt-0.5">{c.label}</div>
            <div className="text-[11px] text-muted-foreground mt-1">{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Checklists */}
      <div className="bg-white rounded-xl border border-border">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-[15px]">Последние чек-листы</h2>
        </div>
        <div className="divide-y divide-border">
          {checklists.map(c => (
            <div key={c.id} className="px-5 py-4 flex items-center gap-4 hover:bg-background transition-colors cursor-pointer">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] text-primary font-medium">{c.id}</span>
                  <span className="text-hint">·</span>
                  <span className="text-[13px] font-medium">{c.project}</span>
                </div>
                <div className="text-hint mt-0.5">{c.stage} · {c.inspector}</div>
              </div>
              <div className="text-[13px] w-24 shrink-0">
                <span className="font-semibold text-foreground">{c.passed}/{c.total}</span>
                <span className="text-hint ml-1">пунктов</span>
              </div>
              {c.defects > 0 && (
                <span className="text-[11px] badge-error px-2 py-0.5 rounded-full font-medium">
                  {c.defects} дефекта
                </span>
              )}
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${statusMap[c.status].cls}`}>
                {statusMap[c.status].label}
              </span>
              <span className="text-hint shrink-0">{c.date}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Defects */}
      <div className="bg-white rounded-xl border border-border">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-[15px]">Журнал дефектов</h2>
          <span className="badge-error text-[11px] px-2 py-0.5 rounded-full font-medium">3 активных</span>
        </div>
        <div className="divide-y divide-border">
          {defects.map(d => (
            <div key={d.id} className="px-5 py-4 flex items-start gap-4 hover:bg-background transition-colors cursor-pointer">
              <Icon name="AlertCircle" size={15} className={`mt-0.5 shrink-0 ${severityColor[d.severity]}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] text-primary font-medium">{d.id}</span>
                  <span className="text-[13px] font-medium">{d.project}</span>
                </div>
                <div className="text-[13px] text-foreground mt-0.5">{d.desc}</div>
                <div className="text-hint mt-0.5">Назначен: {d.assignee} · {d.created}</div>
              </div>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0 ${defectStatus[d.status].cls}`}>
                {defectStatus[d.status].label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
