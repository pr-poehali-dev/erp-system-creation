import { Role } from "@/App";
import Icon from "@/components/ui/icon";

interface Props { role: Role; }

const requests = [
  { id: "ЗМ-0312", project: "ДОМ-241", material: "Блок газобетонный D400, 40 м³", urgency: "Срочно", status: "pending", foreman: "Захаров И.", created: "05.05.26", sum: "128 000" },
  { id: "ЗМ-0311", project: "ДОМ-238", material: "Арматура А500С Ø12, 2 т", urgency: "Обычно", status: "ordered", foreman: "Соколов Г.", created: "04.05.26", sum: "156 000" },
  { id: "ЗМ-0310", project: "ДОМ-244", material: "Цемент М500 Д0, 50 мешков", urgency: "Срочно", status: "delivered", foreman: "Романов С.", created: "03.05.26", sum: "26 000" },
  { id: "ЗМ-0309", project: "ДОМ-235", material: "Профнастил НС-35 RAL 3011, 200 м²", urgency: "Обычно", status: "pending", foreman: "Захаров И.", created: "02.05.26", sum: "136 000" },
];

const suppliers = [
  { name: "СтройМат-НН", rating: 4.8, delivTime: "2-3 дня", quality: 4.9, price: "★ Лучшая цена", orders: 42 },
  { name: "МеталлТорг", rating: 4.5, delivTime: "3-5 дней", quality: 4.3, price: "Средняя", orders: 28 },
  { name: "ОкноГрупп", rating: 4.2, delivTime: "7-10 дней", quality: 4.6, price: "Выше рынка", orders: 15 },
  { name: "КровМаркет", rating: 3.9, delivTime: "5-7 дней", quality: 3.8, price: "Ниже рынка", orders: 9 },
];

const statusMap: Record<string, { label: string; cls: string }> = {
  pending: { label: "Ожидает", cls: "badge-warning" },
  ordered: { label: "Заказан", cls: "badge-info" },
  delivered: { label: "Доставлен", cls: "badge-success" },
};

export default function Procurement({ role }: Props) {
  return (
    <div className="space-y-6 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Снабжение и Закупки</h1>
          <p className="text-hint mt-0.5">Заявки на материалы, тендеры, поставщики</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors">
          <Icon name="Plus" size={14} />
          Новая заявка
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Ожидают обработки", value: "8", icon: "Clock", color: "text-amber-600 bg-amber-50" },
          { label: "В пути", value: "5", icon: "Truck", color: "text-blue-600 bg-blue-50" },
          { label: "Сумма заказов (май)", value: "₽ 1.4 млн", icon: "ShoppingCart", color: "text-emerald-600 bg-emerald-50" },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl border border-border p-4 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.color}`}>
              <Icon name={c.icon} size={20} />
            </div>
            <div>
              <div className="text-[20px] font-bold text-foreground">{c.value}</div>
              <div className="text-hint">{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Requests */}
      <div className="bg-white rounded-xl border border-border">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-[15px]">Заявки на материалы</h2>
          <button className="text-primary text-[13px] hover:underline">Все заявки →</button>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {["№", "Проект", "Материал", "Срочность", "Сумма", "Прораб", "Статус", "Дата"].map(h => (
                <th key={h} className="px-4 py-3 text-left text-hint font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {requests.map(r => (
              <tr key={r.id} className="hover:bg-background transition-colors cursor-pointer">
                <td className="px-4 py-3 text-[13px] text-primary font-medium">{r.id}</td>
                <td className="px-4 py-3 text-[13px] font-medium">{r.project}</td>
                <td className="px-4 py-3 text-[13px] max-w-[200px] truncate">{r.material}</td>
                <td className="px-4 py-3">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${r.urgency === "Срочно" ? "badge-error" : "badge-info"}`}>
                    {r.urgency}
                  </span>
                </td>
                <td className="px-4 py-3 text-[13px] font-semibold">₽ {r.sum}</td>
                <td className="px-4 py-3 text-[13px]">{r.foreman}</td>
                <td className="px-4 py-3">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${statusMap[r.status].cls}`}>
                    {statusMap[r.status].label}
                  </span>
                </td>
                <td className="px-4 py-3 text-hint">{r.created}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Suppliers */}
      <div className="bg-white rounded-xl border border-border">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-[15px]">Рейтинг поставщиков</h2>
        </div>
        <div className="divide-y divide-border">
          {suppliers.map((s, i) => (
            <div key={s.name} className="px-5 py-4 flex items-center gap-4">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0 ${i === 0 ? "bg-amber-100 text-amber-700" : "bg-secondary text-muted-foreground"}`}>
                #{i + 1}
              </div>
              <div className="flex-1">
                <div className="text-[13px] font-semibold">{s.name}</div>
                <div className="text-hint">Заказов: {s.orders} · Срок: {s.delivTime} · {s.price}</div>
              </div>
              <div className="flex items-center gap-1">
                <Icon name="Star" size={13} className="text-amber-400 fill-amber-400" />
                <span className="text-[13px] font-semibold">{s.rating}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
