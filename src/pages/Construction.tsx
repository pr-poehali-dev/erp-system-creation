import { Role } from "@/App";
import Icon from "@/components/ui/icon";

interface Props { role: Role; }

const projects = [
  {
    id: "ДОМ-241", client: "Иванов А.П.", address: "г. Нижний Новгород, ул. Садовая, 14",
    started: "15.03.26", deadline: "15.06.26", daysLeft: 41, progress: 18,
    status: "warning", brigade: "Бригада №3 (Захаров)", currentStage: "Фундамент — монтаж опалубки",
    stages: [
      { name: "Проектирование", done: true, days: 5 },
      { name: "Геология / Разбивка", done: true, days: 3 },
      { name: "Фундамент", done: false, days: 14, current: true, progress: 45 },
      { name: "Стены / перекрытия", done: false, days: 18 },
      { name: "Кровля", done: false, days: 10 },
      { name: "Отделка", done: false, days: 12 },
    ]
  },
  {
    id: "ДОМ-238", client: "Петрова С.В.", address: "г. Кстово, ул. Луговая, 7",
    started: "10.02.26", deadline: "10.05.26", daysLeft: 5, progress: 72,
    status: "error", brigade: "Бригада №1 (Соколов)", currentStage: "Кровля — монтаж стропил",
    stages: [
      { name: "Проектирование", done: true, days: 5 },
      { name: "Геология / Разбивка", done: true, days: 3 },
      { name: "Фундамент", done: true, days: 14 },
      { name: "Стены / перекрытия", done: true, days: 18 },
      { name: "Кровля", done: false, days: 10, current: true, progress: 30 },
      { name: "Отделка", done: false, days: 12 },
    ]
  },
];

const statusMap: Record<string, { label: string; cls: string; icon: string }> = {
  success: { label: "В норме", cls: "badge-success", icon: "CheckCircle" },
  warning: { label: "Внимание", cls: "badge-warning", icon: "AlertTriangle" },
  error: { label: "Отставание", cls: "badge-error", icon: "AlertCircle" },
};

export default function Construction({ role }: Props) {
  return (
    <div className="space-y-6 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Строительство (Проекты ИЖС)</h1>
          <p className="text-hint mt-0.5">Гант-план · 62 дня на дом · 23 активных проекта</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors">
          <Icon name="Plus" size={14} />
          Новый проект
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Активных домов", value: "23", icon: "Home" },
          { label: "Завершено в 2026", value: "11", icon: "CheckCircle" },
          { label: "В срок", value: "19", icon: "Clock" },
          { label: "С отставанием", value: "4", icon: "AlertTriangle" },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl border border-border p-4 flex items-center gap-3">
            <Icon name={c.icon} size={20} className="text-primary shrink-0" />
            <div>
              <div className="text-[22px] font-bold text-foreground">{c.value}</div>
              <div className="text-hint">{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Projects */}
      <div className="space-y-4">
        {projects.map(p => (
          <div key={p.id} className="bg-white rounded-xl border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <span className="text-[13px] text-primary font-semibold">{p.id}</span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${statusMap[p.status].cls}`}>
                    {statusMap[p.status].label}
                  </span>
                </div>
                <div className="text-[14px] font-semibold mt-0.5">{p.client}</div>
                <div className="text-hint">{p.address}</div>
              </div>
              <div className="text-right text-[13px] shrink-0">
                <div className="text-hint">Бригада</div>
                <div className="font-medium">{p.brigade}</div>
              </div>
              <div className="text-right text-[13px] shrink-0">
                <div className="text-hint">Дедлайн</div>
                <div className={`font-medium ${p.daysLeft <= 7 ? "text-red-500" : "text-foreground"}`}>
                  {p.deadline} ({p.daysLeft} дн.)
                </div>
              </div>
              <div className="w-28 shrink-0">
                <div className="flex justify-between mb-1">
                  <span className="text-hint">Готовность</span>
                  <span className="text-[13px] font-semibold">{p.progress}%</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${p.progress}%` }} />
                </div>
              </div>
            </div>

            {/* Gantt mini */}
            <div className="px-5 py-4">
              <div className="text-hint mb-3">Этапы строительства (62 дня)</div>
              <div className="flex items-center gap-2">
                {p.stages.map((s, i) => (
                  <div key={i} className="flex-1 min-w-0">
                    <div
                      className={`h-7 rounded flex items-center justify-center text-[10px] font-medium truncate px-1 transition-all
                        ${s.done ? "bg-emerald-100 text-emerald-700" : s.current ? "bg-blue-100 text-blue-700 ring-1 ring-blue-400" : "bg-gray-100 text-gray-400"}
                      `}
                      title={s.name}
                    >
                      {s.current ? `${s.progress}%` : s.done ? "✓" : ""}
                    </div>
                    <div className="text-[10px] text-hint mt-1 truncate text-center">{s.name.split(" ")[0]}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}

        <div className="bg-white rounded-xl border border-dashed border-border p-8 flex flex-col items-center gap-2 text-muted-foreground">
          <Icon name="Plus" size={20} />
          <span className="text-[13px]">+ 21 активный проект · нажмите для просмотра всех</span>
        </div>
      </div>
    </div>
  );
}
