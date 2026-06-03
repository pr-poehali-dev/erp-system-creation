import { ReactNode } from "react";
import { Invoice, MaterialCategory } from "@/lib/api";
import Icon from "@/components/ui/icon";
import { buildCategoryPath } from "./CategoryTreeSelect";
import { EXT_ICON, STATUS_CFG, fmtMoney, fmtDate } from "./invoices.shared";

interface Props {
  loading: boolean;
  visible: Invoice[];
  categories: MaterialCategory[];
  Pager: ReactNode;
  onEdit: (inv: Invoice) => void;
}

export default function InvoicesTable({ loading, visible, categories, Pager, onEdit }: Props) {
  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      {loading ? (
        <div className="divide-y divide-border">
          {[1, 2, 3].map(i => <div key={i} className="h-12 animate-pulse bg-secondary/30" />)}
        </div>
      ) : visible.length === 0 ? (
        <div className="py-12 text-center text-hint">
          <Icon name="FileText" size={28} className="mx-auto mb-2 opacity-40" />
          <div className="text-[13px]">Счетов пока нет</div>
        </div>
      ) : (
        <>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-secondary/50 text-left text-[11px] uppercase text-hint">
                <th className="px-4 py-2.5 font-medium whitespace-nowrap">№ счёта</th>
                <th className="px-4 py-2.5 font-medium whitespace-nowrap">Поставщик</th>
                <th className="px-4 py-2.5 font-medium min-w-[240px]">Материал</th>
                <th className="px-4 py-2.5 font-medium whitespace-nowrap">Категория</th>
                <th className="px-4 py-2.5 font-medium whitespace-nowrap">Дата</th>
                <th className="px-4 py-2.5 font-medium whitespace-nowrap">Цена</th>
                <th className="px-4 py-2.5 font-medium whitespace-nowrap">Кол-во</th>
                <th className="px-4 py-2.5 font-medium whitespace-nowrap">Сумма</th>
                <th className="px-4 py-2.5 font-medium whitespace-nowrap">Файл</th>
                <th className="px-4 py-2.5 font-medium whitespace-nowrap">Статус</th>
                <th className="px-4 py-2.5 font-medium w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map(inv => {
                const st      = STATUS_CFG[inv.recognition_status];
                const fileExt = (inv.pdf_file_name || "").split(".").pop()?.toLowerCase() || "";
                const fileIco = EXT_ICON[fileExt] || "File";
                return (
                  <tr key={inv.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-3 text-[13px] font-medium">{inv.invoice_number || "—"}</td>
                    <td className="px-4 py-3 text-[13px]">
                      {inv.supplier_name || <span className="text-hint italic text-[12px]">не указан</span>}
                    </td>
                    <td className="px-4 py-3 text-[13px] min-w-[240px] max-w-[360px]">
                      {inv.material_name
                        ? <div
                            className="break-words leading-snug cursor-help"
                            title={`${inv.material_name} (${inv.unit})`}
                          >
                            {inv.material_name}{" "}
                            <span className="text-hint whitespace-nowrap">({inv.unit})</span>
                          </div>
                        : <span className="text-hint italic text-[12px]">не указан</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-[12px] max-w-[200px]">
                      {inv.category_name
                        ? <span className="inline-block px-2 py-0.5 rounded-md bg-secondary text-muted-foreground truncate max-w-full"
                            title={buildCategoryPath(categories, inv.category_id)}>
                            {inv.category_name}
                          </span>
                        : <span className="text-amber-600 text-[11px]">без категории</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-[12px] text-muted-foreground whitespace-nowrap">{fmtDate(inv.invoice_date)}</td>
                    <td className="px-4 py-3 text-[13px] text-right">{fmtMoney(inv.unit_price)}</td>
                    <td className="px-4 py-3 text-[13px] text-right">{inv.quantity ?? "—"}</td>
                    <td className="px-4 py-3 text-[13px] font-semibold text-right whitespace-nowrap">{fmtMoney(inv.total_amount)}</td>
                    <td className="px-4 py-3">
                      {inv.pdf_file_url
                        ? <a href={inv.pdf_file_url} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1 text-[11px] text-primary hover:underline whitespace-nowrap">
                            <Icon name={fileIco} size={12} />
                            {(inv.pdf_file_name || "файл").slice(0, 14)}
                          </a>
                        : <span className="text-hint text-[11px]">—</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 w-fit ${st.cls}`}>
                        <Icon name={st.icon} size={10} />
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => onEdit(inv)}
                        className="text-[12px] px-2 py-1 border border-border rounded hover:bg-secondary transition-colors">
                        <Icon name="Pencil" size={12} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {Pager}
        </>
      )}
    </div>
  );
}
