import { Role } from "@/App";
import Icon from "@/components/ui/icon";

interface Props { role: Role; }

const items = [
  { sku: "СБ-001", name: "Блок газобетонный D400 600×250×100", unit: "м³", stock: 142, reserved: 30, price: "3 200", category: "Стеновые материалы", status: "ok" },
  { sku: "СБ-002", name: "Цемент М500 Д0 (мешок 50 кг)", unit: "шт", stock: 18, reserved: 0, price: "520", category: "Вяжущие", status: "low" },
  { sku: "АР-014", name: "Арматура А500С Ø12 мм (6м)", unit: "т", stock: 0, reserved: 0, price: "78 000", category: "Металлопрокат", status: "out" },
  { sku: "КР-003", name: "Профнастил НС-35 RAL 3011", unit: "м²", stock: 560, reserved: 120, price: "680", category: "Кровля", status: "ok" },
  { sku: "УТ-007", name: "Минвата ROCKWOOL 100мм", unit: "м²", stock: 800, reserved: 200, price: "310", category: "Утеплитель", status: "ok" },
  { sku: "ОК-022", name: "Окно ПВХ 1200×1400 (двойной стеклопакет)", unit: "шт", stock: 4, reserved: 4, price: "18 500", category: "Окна", status: "low" },
];

const statusMap: Record<string, { label: string; cls: string }> = {
  ok: { label: "В наличии", cls: "badge-success" },
  low: { label: "Мало", cls: "badge-warning" },
  out: { label: "Нет", cls: "badge-error" },
};

const receipts = [
  { date: "05.05.26", supplier: "СтройМат-НН", items: "Блок газобетонный, 40 м³", sum: "128 000", status: "Ожидается" },
  { date: "04.05.26", supplier: "МеталлТорг", items: "Арматура А500С, 2 т", sum: "156 000", status: "Принят" },
  { date: "03.05.26", supplier: "ОкноГрупп", items: "Окна ПВХ, 12 шт", sum: "222 000", status: "Принят" },
];

export default function Warehouse({ role }: Props) {
  return (
    <div className="space-y-6 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Розница / Склад</h1>
          <p className="text-hint mt-0.5">Остатки МойСклад · синхронизация: 08:03</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-[13px] hover:bg-secondary transition-colors">
            <Icon name="RefreshCw" size={13} />
            Синхронизировать МС
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors">
            <Icon name="Plus" size={14} />
            Приход
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Позиций на складе", value: "1 284", icon: "Package", color: "text-blue-600 bg-blue-50" },
          { label: "Товаров мало / нет", value: "3", icon: "AlertTriangle", color: "text-red-600 bg-red-50" },
          { label: "Общая стоимость", value: "₽ 8.4 млн", icon: "DollarSign", color: "text-emerald-600 bg-emerald-50" },
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

      {/* Stock table */}
      <div className="bg-white rounded-xl border border-border">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-[15px]">Остатки склада</h2>
          <span className="text-hint">Показано 6 из 1 284</span>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {["Артикул", "Наименование", "Ед.", "На складе", "Резерв", "Цена", "Статус"].map(h => (
                <th key={h} className="px-4 py-3 text-left text-hint font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map(item => (
              <tr key={item.sku} className="hover:bg-background transition-colors">
                <td className="px-4 py-3 text-[13px] text-primary font-medium">{item.sku}</td>
                <td className="px-4 py-3 text-[13px] font-medium max-w-xs truncate">{item.name}</td>
                <td className="px-4 py-3 text-hint">{item.unit}</td>
                <td className="px-4 py-3 text-[13px] font-semibold">{item.stock}</td>
                <td className="px-4 py-3 text-hint">{item.reserved}</td>
                <td className="px-4 py-3 text-[13px]">₽ {item.price}</td>
                <td className="px-4 py-3">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${statusMap[item.status].cls}`}>
                    {statusMap[item.status].label}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Receipts */}
      <div className="bg-white rounded-xl border border-border">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-[15px]">Последние поступления</h2>
        </div>
        <div className="divide-y divide-border">
          {receipts.map((r, i) => (
            <div key={i} className="px-5 py-4 flex items-center gap-4">
              <div className="text-hint w-20 shrink-0">{r.date}</div>
              <div className="flex-1">
                <div className="text-[13px] font-medium">{r.supplier}</div>
                <div className="text-hint">{r.items}</div>
              </div>
              <div className="text-[13px] font-semibold">₽ {r.sum}</div>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${r.status === "Принят" ? "badge-success" : "badge-warning"}`}>
                {r.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
