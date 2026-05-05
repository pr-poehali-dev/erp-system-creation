import { Role } from "@/App";
import Icon from "@/components/ui/icon";

interface Props { role: Role; }

const plData = [
  { direction: "Строительство ИЖС", revenue: "10 420 000", cost: "6 890 000", profit: "3 530 000", margin: "33.9%" },
  { direction: "Розница / Склад", revenue: "2 840 000", cost: "1 980 000", profit: "860 000", margin: "30.3%" },
  { direction: "Аренда техники", revenue: "1 020 000", cost: "580 000", profit: "440 000", margin: "43.1%" },
  { direction: "Итого", revenue: "14 280 000", cost: "9 450 000", profit: "4 830 000", margin: "33.8%", total: true },
];

const dds = [
  { category: "Поступления от клиентов", plan: "16 000 000", fact: "14 280 000", diff: "-1 720 000", neg: true },
  { category: "Платежи поставщикам", plan: "8 000 000", fact: "8 340 000", diff: "+340 000", neg: true },
  { category: "ФОТ (все сотрудники)", plan: "2 800 000", fact: "2 780 000", diff: "-20 000", neg: false },
  { category: "Аренда и прочее", plan: "400 000", fact: "398 000", diff: "-2 000", neg: false },
  { category: "Чистый денежный поток", plan: "4 800 000", fact: "2 762 000", diff: "-2 038 000", neg: true, total: true },
];

const payments = [
  { date: "05.05.26", client: "Морозов К.В.", type: "Аванс 30%", sum: "1 860 000", status: "pending" },
  { date: "04.05.26", client: "Белов С.А.", type: "Аванс 30%", sum: "1 650 000", status: "received" },
  { date: "03.05.26", client: "Захарова Н.П.", type: "Этапный платёж", sum: "800 000", status: "received" },
  { date: "02.05.26", client: "СтройМат-НН", type: "Оплата поставки", sum: "328 000", status: "sent" },
];

const payStatus: Record<string, { label: string; cls: string }> = {
  pending: { label: "Ожидается", cls: "badge-warning" },
  received: { label: "Получен", cls: "badge-success" },
  sent: { label: "Отправлен", cls: "badge-info" },
};

export default function Finance({ role }: Props) {
  return (
    <div className="space-y-6 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Финансы</h1>
          <p className="text-hint mt-0.5">P&L, ДДС, баланс · май 2026</p>
        </div>
        <div className="flex gap-2">
          <select className="px-3 py-2 border border-border rounded-lg text-[13px] bg-white outline-none">
            <option>Май 2026</option>
            <option>Апрель 2026</option>
          </select>
          <button className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-[13px] hover:bg-secondary transition-colors">
            <Icon name="Download" size={13} />
            Экспорт
          </button>
        </div>
      </div>

      {/* P&L */}
      <div className="bg-white rounded-xl border border-border">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-[15px]">P&L — Прибыли и убытки по направлениям</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {["Направление", "Выручка", "Затраты", "Прибыль", "Маржа"].map(h => (
                <th key={h} className="px-5 py-3 text-left text-hint font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {plData.map(row => (
              <tr key={row.direction} className={`${row.total ? "bg-blue-50 font-semibold" : "hover:bg-background"} transition-colors`}>
                <td className="px-5 py-3.5 text-[13px] font-medium">{row.direction}</td>
                <td className="px-5 py-3.5 text-[13px] text-emerald-600 font-semibold">₽ {row.revenue}</td>
                <td className="px-5 py-3.5 text-[13px] text-red-500">₽ {row.cost}</td>
                <td className="px-5 py-3.5 text-[13px] font-bold text-foreground">₽ {row.profit}</td>
                <td className="px-5 py-3.5">
                  <span className="badge-success text-[12px] px-2 py-0.5 rounded-full font-semibold">{row.margin}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* DDS */}
      <div className="bg-white rounded-xl border border-border">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-[15px]">ДДС — Движение денежных средств (план / факт)</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {["Статья", "План", "Факт", "Отклонение"].map(h => (
                <th key={h} className="px-5 py-3 text-left text-hint font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {dds.map(row => (
              <tr key={row.category} className={`${row.total ? "bg-blue-50 font-semibold" : "hover:bg-background"} transition-colors`}>
                <td className="px-5 py-3.5 text-[13px] font-medium">{row.category}</td>
                <td className="px-5 py-3.5 text-[13px] text-muted-foreground">₽ {row.plan}</td>
                <td className="px-5 py-3.5 text-[13px] font-semibold">₽ {row.fact}</td>
                <td className="px-5 py-3.5 text-[13px]">
                  <span className={row.neg ? "text-red-500" : "text-emerald-600"}>{row.diff}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Payments */}
      <div className="bg-white rounded-xl border border-border">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-[15px]">Последние платежи</h2>
        </div>
        <div className="divide-y divide-border">
          {payments.map((p, i) => (
            <div key={i} className="px-5 py-3.5 flex items-center gap-4">
              <div className="text-hint w-20 shrink-0">{p.date}</div>
              <div className="flex-1">
                <div className="text-[13px] font-medium">{p.client}</div>
                <div className="text-hint">{p.type}</div>
              </div>
              <div className="text-[14px] font-bold">₽ {p.sum}</div>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${payStatus[p.status].cls}`}>
                {payStatus[p.status].label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
