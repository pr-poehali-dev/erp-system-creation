import { Role } from "@/App";
import Icon from "@/components/ui/icon";
import { useState } from "react";

interface Props { role: Role; }

const leads = [
  { id: "ЛД-091", name: "Морозов К.В.", phone: "+7 912 345-67-89", source: "Авито", stage: "Квалификация", budget: "6 200 000", manager: "Тихонов А.", created: "03.05.26" },
  { id: "ЛД-090", name: "Захарова Н.П.", phone: "+7 905 123-45-67", source: "Сайт", stage: "КП отправлено", budget: "7 800 000", manager: "Кузнецова В.", created: "02.05.26" },
  { id: "ЛД-089", name: "Белов С.А.", phone: "+7 916 789-01-23", source: "Рекомендация", stage: "Договор", budget: "5 500 000", manager: "Тихонов А.", created: "01.05.26" },
  { id: "ЛД-088", name: "Орлов Д.М.", phone: "+7 903 456-78-90", source: "Инстаграм", stage: "Первый контакт", budget: "9 100 000", manager: "Кузнецова В.", created: "30.04.26" },
  { id: "ЛД-087", name: "Волкова А.С.", phone: "+7 926 654-32-10", source: "Авито", stage: "Договор", budget: "6 700 000", manager: "Алексеев П.", created: "29.04.26" },
];

const funnelStages = [
  { stage: "Новые лиды", count: 34, color: "bg-blue-500" },
  { stage: "Квалификация", count: 22, color: "bg-indigo-500" },
  { stage: "КП отправлено", count: 15, color: "bg-violet-500" },
  { stage: "Переговоры", count: 9, color: "bg-amber-500" },
  { stage: "Договор", count: 4, color: "bg-emerald-500" },
];

const stageColor: Record<string, string> = {
  "Первый контакт": "badge-info",
  "Квалификация": "badge-info",
  "КП отправлено": "badge-warning",
  "Переговоры": "badge-warning",
  "Договор": "badge-success",
};

export default function Sales({ role }: Props) {
  const [search, setSearch] = useState("");
  const filtered = leads.filter(l =>
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    l.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Продажи и CRM</h1>
          <p className="text-hint mt-0.5">Воронка продаж, лиды, договоры</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors">
          <Icon name="Plus" size={14} />
          Новый лид
        </button>
      </div>

      {/* Funnel */}
      <div className="bg-white rounded-xl border border-border p-5">
        <h2 className="font-semibold text-[15px] mb-4">Воронка продаж</h2>
        <div className="flex items-end gap-3 h-32">
          {funnelStages.map((s, i) => (
            <div key={s.stage} className="flex-1 flex flex-col items-center gap-2">
              <span className="text-[13px] font-semibold text-foreground">{s.count}</span>
              <div
                className={`w-full rounded-t-md ${s.color} transition-all`}
                style={{ height: `${(s.count / 34) * 100}%` }}
              />
              <span className="text-hint text-[11px] text-center leading-tight">{s.stage}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-4 mt-5 pt-4 border-t border-border">
          <div><div className="text-hint">Конверсия (лид→договор)</div><div className="text-[18px] font-bold text-foreground mt-1">11.8%</div></div>
          <div><div className="text-hint">Средний чек</div><div className="text-[18px] font-bold text-foreground mt-1">₽ 7 060 000</div></div>
          <div><div className="text-hint">В работе (млн ₽)</div><div className="text-[18px] font-bold text-foreground mt-1">₽ 284.3 млн</div></div>
        </div>
      </div>

      {/* Leads table */}
      <div className="bg-white rounded-xl border border-border">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <Icon name="Search" size={15} className="text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по имени или номеру лида..."
            className="flex-1 bg-transparent text-[13px] outline-none text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {["ID", "Клиент", "Телефон", "Источник", "Этап", "Бюджет", "Менеджер", "Создан"].map(h => (
                <th key={h} className="px-4 py-3 text-left text-hint font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map(l => (
              <tr key={l.id} className="hover:bg-background transition-colors cursor-pointer">
                <td className="px-4 py-3 text-[13px] text-primary font-medium">{l.id}</td>
                <td className="px-4 py-3 text-[13px] font-medium">{l.name}</td>
                <td className="px-4 py-3 text-hint">{l.phone}</td>
                <td className="px-4 py-3 text-[13px]">{l.source}</td>
                <td className="px-4 py-3">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${stageColor[l.stage] || "badge-info"}`}>
                    {l.stage}
                  </span>
                </td>
                <td className="px-4 py-3 text-[13px] font-medium">₽ {l.budget}</td>
                <td className="px-4 py-3 text-[13px]">{l.manager}</td>
                <td className="px-4 py-3 text-hint">{l.created}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
