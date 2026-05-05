import { Role } from "@/App";
import Icon from "@/components/ui/icon";

interface Props { role: Role; }

const equipment = [
  { id: "ТЕХ-001", name: "Экскаватор CAT 320", type: "Экскаватор", plate: "А123ВС52", status: "busy", project: "ДОМ-238", operator: "Смирнов В.", toDate: "07.05.26", moHours: 1248, nextTO: "1300 м/ч" },
  { id: "ТЕХ-002", name: "Самосвал КАМАЗ 6520", type: "Грузовик", plate: "В456ЕН52", status: "free", project: "—", operator: "—", toDate: "—", moHours: 834, nextTO: "1000 м/ч" },
  { id: "ТЕХ-003", name: "Кран башенный КБ-408", type: "Кран", plate: "КБ-408", status: "service", project: "—", operator: "—", toDate: "—", moHours: 2100, nextTO: "⚠ ТО просрочено" },
  { id: "ТЕХ-004", name: "Бетономешалка WACKER 250", type: "Смеситель", plate: "—", status: "busy", project: "ДОМ-241", operator: "Захаров И.", toDate: "12.05.26", moHours: 312, nextTO: "500 м/ч" },
  { id: "ТЕХ-005", name: "Грейдер ДЗ-98В", type: "Спецтехника", plate: "Е789КМ52", status: "free", project: "—", operator: "—", toDate: "—", moHours: 567, nextTO: "700 м/ч" },
];

const statusMap: Record<string, { label: string; cls: string; dot: string }> = {
  busy: { label: "На объекте", cls: "badge-info", dot: "bg-blue-500" },
  free: { label: "Свободна", cls: "badge-success", dot: "bg-emerald-500" },
  service: { label: "На ТО", cls: "badge-warning", dot: "bg-amber-500" },
};

const calendar = [
  { date: "05.05", equip: "CAT 320", project: "ДОМ-238", hours: 8 },
  { date: "05.05", equip: "Бетономешалка", project: "ДОМ-241", hours: 6 },
  { date: "06.05", equip: "CAT 320", project: "ДОМ-238", hours: 8 },
  { date: "07.05", equip: "КАМАЗ 6520", project: "ДОМ-244", hours: 5 },
  { date: "08.05", equip: "Грейдер ДЗ-98В", project: "ДОМ-231", hours: 4 },
];

export default function Rental({ role }: Props) {
  return (
    <div className="space-y-6 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Аренда техники</h1>
          <p className="text-hint mt-0.5">Парк: 5 единиц · 2 на объектах · 1 на ТО</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors">
          <Icon name="Plus" size={14} />
          Назначить технику
        </button>
      </div>

      {/* Equipment list */}
      <div className="bg-white rounded-xl border border-border">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-[15px]">Парк техники</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {["ID", "Техника", "Гос. номер", "Статус", "Объект", "Оператор", "До", "Моточасы", "След. ТО"].map(h => (
                <th key={h} className="px-4 py-3 text-left text-hint font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {equipment.map(e => (
              <tr key={e.id} className="hover:bg-background transition-colors">
                <td className="px-4 py-3 text-[13px] text-primary font-medium">{e.id}</td>
                <td className="px-4 py-3">
                  <div className="text-[13px] font-medium">{e.name}</div>
                  <div className="text-hint">{e.type}</div>
                </td>
                <td className="px-4 py-3 text-hint">{e.plate}</td>
                <td className="px-4 py-3">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${statusMap[e.status].cls}`}>
                    {statusMap[e.status].label}
                  </span>
                </td>
                <td className="px-4 py-3 text-[13px]">{e.project}</td>
                <td className="px-4 py-3 text-[13px]">{e.operator}</td>
                <td className="px-4 py-3 text-hint">{e.toDate}</td>
                <td className="px-4 py-3 text-[13px] font-semibold">{e.moHours}</td>
                <td className="px-4 py-3">
                  <span className={`text-[12px] ${e.nextTO.startsWith("⚠") ? "text-red-500 font-semibold" : "text-hint"}`}>
                    {e.nextTO}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Calendar */}
      <div className="bg-white rounded-xl border border-border">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-[15px]">Расписание техники (май 2026)</h2>
        </div>
        <div className="divide-y divide-border">
          {calendar.map((c, i) => (
            <div key={i} className="px-5 py-3.5 flex items-center gap-4">
              <div className="text-hint w-16 shrink-0">{c.date}</div>
              <div className="flex-1">
                <span className="text-[13px] font-medium">{c.equip}</span>
                <span className="text-hint mx-2">→</span>
                <span className="text-[13px] text-primary">{c.project}</span>
              </div>
              <div className="text-[13px] text-hint">{c.hours} часов</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
