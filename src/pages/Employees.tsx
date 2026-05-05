import { Role } from "@/App";
import Icon from "@/components/ui/icon";

interface Props { role: Role; }

const employees = [
  { id: "СТ-001", name: "Тихонов Андрей Викторович", role: "Менеджер CRM", dept: "Продажи", status: "active", phone: "+7 912 000-11-22", deals: 14, kpi: 94 },
  { id: "СТ-002", name: "Кузнецова Виктория Игоревна", role: "Менеджер CRM", dept: "Продажи", status: "active", phone: "+7 916 111-22-33", deals: 11, kpi: 88 },
  { id: "СТ-003", name: "Захаров Иван Петрович", role: "Прораб", dept: "Строительство", status: "active", phone: "+7 903 222-33-44", deals: null, kpi: 82 },
  { id: "СТ-004", name: "Соколов Геннадий Львович", role: "Прораб", dept: "Строительство", status: "active", phone: "+7 926 333-44-55", deals: null, kpi: 91 },
  { id: "СТ-005", name: "Петренко Алексей Романович", role: "Инспектор ОТК", dept: "Качество", status: "active", phone: "+7 905 444-55-66", deals: null, kpi: 96 },
  { id: "СТ-006", name: "Смирнов Вадим Олегович", role: "Механик / Оператор", dept: "Техника", status: "active", phone: "+7 921 555-66-77", deals: null, kpi: 78 },
  { id: "СТ-007", name: "Алексеев Павел Дмитриевич", role: "Риэлтор", dept: "Продажи", status: "vacation", phone: "+7 908 666-77-88", deals: 7, kpi: 85 },
];

const depts = ["Все", "Продажи", "Строительство", "Качество", "Техника", "Снабжение"];

export default function Employees({ role }: Props) {
  return (
    <div className="space-y-6 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Сотрудники</h1>
          <p className="text-hint mt-0.5">Список, роли, KPI · 7 из 24 показано</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors">
          <Icon name="Plus" size={14} />
          Добавить сотрудника
        </button>
      </div>

      {/* Dept filter */}
      <div className="flex gap-2 flex-wrap">
        {depts.map(d => (
          <button key={d} className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all ${d === "Все" ? "bg-primary text-white" : "bg-white border border-border text-muted-foreground hover:text-foreground hover:bg-secondary"}`}>
            {d}
          </button>
        ))}
      </div>

      {/* Employee cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {employees.map(emp => (
          <div key={emp.id} className="bg-white rounded-xl border border-border p-5 hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-[15px] shrink-0">
                {emp.name.split(" ").slice(0, 2).map(n => n[0]).join("")}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold truncate">{emp.name}</div>
                <div className="text-hint">{emp.role}</div>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium mt-1 inline-block ${emp.status === "active" ? "badge-success" : "badge-warning"}`}>
                  {emp.status === "active" ? "Активен" : "Отпуск"}
                </span>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${emp.kpi >= 90 ? "bg-emerald-500" : emp.kpi >= 80 ? "bg-blue-500" : "bg-amber-500"}`}
                  style={{ width: `${emp.kpi}%` }}
                />
              </div>
              <span className={`text-[12px] font-bold ${emp.kpi >= 90 ? "text-emerald-600" : emp.kpi >= 80 ? "text-blue-600" : "text-amber-600"}`}>
                KPI {emp.kpi}%
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <span className="text-hint">{emp.dept}</span>
              {emp.deals !== null && <span className="text-hint">{emp.deals} сделок</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
