import { Role } from "@/App";
import Icon from "@/components/ui/icon";

interface Props { role: Role; }

const docs = [
  { id: "ДГВ-0184", type: "Договор", name: "Договор подряда № 2244 — Морозов К.В.", project: "ДОМ-244", date: "05.05.26", sum: "6 200 000", status: "signed" },
  { id: "СЧТ-0291", type: "Счёт", name: "Счёт на оплату № 291 — аванс 30%", project: "ДОМ-244", date: "05.05.26", sum: "1 860 000", status: "sent" },
  { id: "ДГВ-0183", type: "Договор", name: "Договор подряда № 2241 — Белов С.А.", project: "ДОМ-241", date: "01.05.26", sum: "5 500 000", status: "signed" },
  { id: "АКТ-0112", type: "Акт", name: "Акт выполненных работ — фундамент", project: "ДОМ-238", date: "30.04.26", sum: "890 000", status: "signed" },
  { id: "СЧТ-0289", type: "Счёт", name: "Счёт № 289 — финальный платёж", project: "ДОМ-229", date: "28.04.26", sum: "1 340 000", status: "paid" },
  { id: "ДГВ-0181", type: "Договор", name: "Доп. соглашение № 1 — изменение проекта", project: "ДОМ-235", date: "25.04.26", sum: "—", status: "draft" },
];

const typeColor: Record<string, string> = {
  Договор: "badge-info",
  Счёт: "badge-warning",
  Акт: "badge-success",
};

const statusMap: Record<string, { label: string; cls: string }> = {
  signed: { label: "Подписан", cls: "badge-success" },
  sent: { label: "Отправлен", cls: "badge-info" },
  paid: { label: "Оплачен", cls: "badge-success" },
  draft: { label: "Черновик", cls: "bg-gray-100 text-gray-600" },
};

export default function Documents({ role }: Props) {
  return (
    <div className="space-y-6 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Документы</h1>
          <p className="text-hint mt-0.5">Договоры, счета, акты · отправка на email клиентам</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-[13px] hover:bg-secondary transition-colors">
            <Icon name="Mail" size={13} />
            Отправить
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors">
            <Icon name="Plus" size={14} />
            Создать документ
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {["Все", "Договоры", "Счета", "Акты", "Черновики"].map(tab => (
          <button
            key={tab}
            className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
              tab === "Все" ? "bg-primary text-white" : "bg-white border border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Docs table */}
      <div className="bg-white rounded-xl border border-border">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {["№", "Тип", "Название", "Проект", "Дата", "Сумма", "Статус", ""].map(h => (
                <th key={h} className="px-4 py-3 text-left text-hint font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {docs.map(d => (
              <tr key={d.id} className="hover:bg-background transition-colors cursor-pointer">
                <td className="px-4 py-3 text-[13px] text-primary font-medium">{d.id}</td>
                <td className="px-4 py-3">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${typeColor[d.type]}`}>
                    {d.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-[13px] font-medium max-w-xs">{d.name}</td>
                <td className="px-4 py-3 text-[13px] text-primary">{d.project}</td>
                <td className="px-4 py-3 text-hint">{d.date}</td>
                <td className="px-4 py-3 text-[13px] font-medium">{d.sum !== "—" ? `₽ ${d.sum}` : "—"}</td>
                <td className="px-4 py-3">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${statusMap[d.status].cls}`}>
                    {statusMap[d.status].label}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button className="text-muted-foreground hover:text-primary transition-colors">
                      <Icon name="Download" size={14} />
                    </button>
                    <button className="text-muted-foreground hover:text-primary transition-colors">
                      <Icon name="Send" size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <Icon name="Info" size={16} className="text-blue-500 mt-0.5 shrink-0" />
        <div>
          <div className="text-[13px] font-medium text-blue-800">Автоматическая отправка документов</div>
          <div className="text-[13px] text-blue-700 mt-0.5">
            При подписании договора система автоматически отправляет PDF на email клиента и создаёт проект в разделе «Строительство».
          </div>
        </div>
      </div>
    </div>
  );
}
