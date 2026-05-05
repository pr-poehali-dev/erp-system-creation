import { useState } from "react";
import Icon from "@/components/ui/icon";
import { Deal } from "@/lib/api";

const STAGES: Record<string, string> = {
  new: "Новая",
  qualification: "Квалификация",
  proposal: "КП отправлено",
  negotiation: "Переговоры",
  contract: "Договор",
  lost: "Отказ",
};

const STAGE_CLS: Record<string, string> = {
  new: "badge-info",
  qualification: "badge-info",
  proposal: "badge-warning",
  negotiation: "badge-warning",
  contract: "badge-success",
  lost: "bg-gray-100 text-gray-600",
};

const fmt = (n: number) =>
  n >= 1_000_000
    ? `₽ ${(n / 1_000_000).toFixed(1)} млн`
    : n >= 1000
    ? `₽ ${n.toLocaleString("ru")}`
    : `₽ ${n}`;

interface Props {
  deals: Deal[];
  loading: boolean;
  stagingSaving: number | null;
  onRefresh: () => void;
  onStageChange: (deal: Deal, newStage: string) => void;
}

export default function DealsTable({ deals, loading, stagingSaving, onRefresh, onStageChange }: Props) {
  const [search, setSearch] = useState("");

  const filtered = deals.filter(
    (d) =>
      d.client_name.toLowerCase().includes(search.toLowerCase()) ||
      d.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bg-white rounded-xl border border-border">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
        <Icon name="Search" size={15} className="text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по клиенту или коду сделки..."
          className="flex-1 bg-transparent text-[13px] outline-none text-foreground placeholder:text-muted-foreground"
        />
        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-[12px] hover:bg-secondary transition-colors"
        >
          <Icon name="RefreshCw" size={12} className={loading ? "animate-spin" : ""} />
          Обновить
        </button>
      </div>

      {loading ? (
        <div className="divide-y divide-border">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="px-4 py-3.5 flex items-center gap-4 animate-pulse">
              <div className="h-4 bg-secondary rounded w-24" />
              <div className="h-4 bg-secondary rounded w-32 flex-1" />
              <div className="h-4 bg-secondary rounded w-20" />
              <div className="h-4 bg-secondary rounded w-20" />
              <div className="h-5 bg-secondary rounded-full w-24" />
              <div className="h-4 bg-secondary rounded w-28" />
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {["Код", "Клиент", "Телефон", "Источник", "Бюджет", "Менеджер", "Риэлтор", "Этап", ""].map(
                  (h) => (
                    <th key={h} className="px-4 py-3 text-left text-hint font-medium whitespace-nowrap">
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-hint">
                    Сделки не найдены
                  </td>
                </tr>
              ) : (
                filtered.map((d) => (
                  <tr key={d.id} className="hover:bg-background transition-colors">
                    <td className="px-4 py-3 text-[13px] text-primary font-medium whitespace-nowrap">
                      {d.code}
                    </td>
                    <td className="px-4 py-3 text-[13px] font-medium whitespace-nowrap">
                      {d.client_name}
                    </td>
                    <td className="px-4 py-3 text-hint whitespace-nowrap">
                      {d.client_phone}
                    </td>
                    <td className="px-4 py-3 text-[13px] whitespace-nowrap">
                      {d.source || "—"}
                    </td>
                    <td className="px-4 py-3 text-[13px] font-medium whitespace-nowrap">
                      {d.budget ? fmt(d.budget) : "—"}
                    </td>
                    <td className="px-4 py-3 text-[13px] whitespace-nowrap">
                      {d.manager_name || "—"}
                    </td>
                    <td className="px-4 py-3 text-[13px] whitespace-nowrap">
                      {d.realtor_name || "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                          STAGE_CLS[d.stage] || "badge-info"
                        }`}
                      >
                        {STAGES[d.stage] || d.stage}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <select
                        value={d.stage}
                        disabled={stagingSaving === d.id}
                        onChange={(e) => onStageChange(d, e.target.value)}
                        className="text-[12px] border border-border rounded-md px-2 py-1 bg-white outline-none cursor-pointer hover:bg-secondary transition-colors disabled:opacity-50"
                      >
                        {Object.entries(STAGES).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
