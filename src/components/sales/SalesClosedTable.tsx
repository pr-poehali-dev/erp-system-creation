import Icon from "@/components/ui/icon";
import { Deal } from "@/lib/api";
import { fmt } from "./sales.shared";

interface Props {
  loading: boolean;
  visibleClosed: Deal[];
}

export default function SalesClosedTable({ loading, visibleClosed }: Props) {
  return (
    <div className="space-y-3">
      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-14 bg-secondary rounded-xl animate-pulse" />)}</div>
      ) : visibleClosed.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-border p-12 flex flex-col items-center gap-3 text-muted-foreground">
          <Icon name="CheckCircle2" size={32} />
          <span className="text-[14px] font-medium">Закрытых сделок пока нет</span>
        </div>
      ) : (
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          {/* Итоговая строка */}
          <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-200 flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Icon name="CheckCircle2" size={14} className="text-emerald-600" />
              <span className="text-[13px] font-semibold text-emerald-800">
                {visibleClosed.length} закрытых сделок
              </span>
            </div>
            <div className="text-[13px] text-emerald-700">
              Выручка: <b>{fmt(visibleClosed.reduce((s, d) => s + (d.budget || 0), 0))}</b>
            </div>
            {visibleClosed.some(d => d.commission_amount != null) && (
              <div className="text-[13px] text-emerald-700">
                Комиссии: <b>{fmt(visibleClosed.reduce((s, d) => s + (d.commission_amount || 0), 0))}</b>
              </div>
            )}
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-secondary/50 text-left text-[11px] uppercase text-hint">
                <th className="px-4 py-2.5 font-medium">Код</th>
                <th className="px-4 py-2.5 font-medium">Клиент</th>
                <th className="px-4 py-2.5 font-medium">Проект</th>
                <th className="px-4 py-2.5 font-medium">Менеджер / Риэлтор</th>
                <th className="px-4 py-2.5 font-medium text-right">Сумма</th>
                <th className="px-4 py-2.5 font-medium text-right">Комиссия</th>
                <th className="px-4 py-2.5 font-medium text-right">Дата</th>
              </tr>
            </thead>
            <tbody>
              {visibleClosed.map(d => (
                <tr key={d.id} className="border-t border-border hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3 text-[13px] font-bold text-primary">{d.code}</td>
                  <td className="px-4 py-3 text-[13px]">
                    <div className="font-medium">{d.client_name}</div>
                    <div className="text-hint text-[11px]">{d.client_phone}</div>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-muted-foreground">
                    {d.serial_project_name || (d.project_type === "individual" ? "Индивидуальный" : "—")}
                  </td>
                  <td className="px-4 py-3 text-[12px]">
                    <div>{d.manager_name || "—"}</div>
                    {d.realtor_name && <div className="text-hint text-[11px]">риэлтор: {d.realtor_name}</div>}
                  </td>
                  <td className="px-4 py-3 text-[13px] font-semibold text-right">
                    {d.budget ? fmt(d.budget) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {d.commission_amount != null ? (
                      <>
                        <div className="text-[13px] font-bold text-emerald-600">{fmt(d.commission_amount)}</div>
                        <div className="text-[10px] text-hint">{d.commission_rate}%</div>
                      </>
                    ) : (
                      <span className="text-hint text-[12px]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-hint text-right">
                    {d.closed_at ? new Date(d.closed_at).toLocaleDateString("ru") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
