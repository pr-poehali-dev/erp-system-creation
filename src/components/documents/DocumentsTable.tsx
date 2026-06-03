import Icon from "@/components/ui/icon";
import { Document } from "@/lib/api";
import { CATEGORIES, STATUS_MAP, CATEGORY_COLOR, fmtDate, fmtRub } from "./DocumentsConst";

interface Props {
  docs: Document[];
  loading: boolean;
  category: string;
  search: string;
  statusFilter: string;
  countsByCategory: Record<string, number>;
  onCategoryChange: (cat: string) => void;
  onSearchChange: (v: string) => void;
  onStatusFilterChange: (v: string) => void;
}

export default function DocumentsTable({
  docs, loading, category, search, statusFilter,
  countsByCategory, onCategoryChange, onSearchChange, onStatusFilterChange,
}: Props) {
  const filtered = docs.filter(d => {
    if (statusFilter && d.status !== statusFilter) return false;
    if (search && !d.title.toLowerCase().includes(search.toLowerCase()) &&
        !(d.deal_code || "").toLowerCase().includes(search.toLowerCase()) &&
        !(d.contractor_name || "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <>
      {/* Категории */}
      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map(cat => {
          const cnt = cat.key ? (countsByCategory[cat.key] || 0) : docs.length;
          return (
            <button key={cat.key}
              onClick={() => onCategoryChange(cat.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[13px] font-medium transition-all ${
                category === cat.key
                  ? "border-primary bg-primary text-white"
                  : "border-border bg-white text-foreground hover:border-primary/40"
              }`}>
              <Icon name={cat.icon as Parameters<typeof Icon>[0]["name"]} size={13} />
              {cat.label}
              {cnt > 0 && (
                <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${category === cat.key ? "bg-white/20" : "bg-secondary"}`}>
                  {cnt}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Поиск и фильтры */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => onSearchChange(e.target.value)}
            placeholder="Поиск по названию, сделке, контрагенту..."
            className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-[13px] outline-none focus:ring-1 focus:ring-primary bg-white" />
        </div>
        <select value={statusFilter} onChange={e => onStatusFilterChange(e.target.value)}
          className="border border-border rounded-lg px-3 py-2 text-[13px] bg-white outline-none">
          <option value="">Все статусы</option>
          {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* Подсказка по автодокументам */}
      {(category === "deal" || category === "") && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-2">
          <Icon name="Zap" size={14} className="text-blue-500 shrink-0" />
          <span className="text-[12px] text-blue-800">
            <strong>Автоматически:</strong> при переводе сделки в КП создаётся черновик КП, при подписании договора — «Договор подряда» со статусом «Подписан».
          </span>
        </div>
      )}

      {/* Таблица */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1,2,3,4,5].map(i => <div key={i} className="h-10 bg-secondary rounded-lg animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-hint py-16">
            <Icon name="FileX" size={36} className="mx-auto mb-3 opacity-30" />
            <div>Документов не найдено</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-background">
                {["Категория", "Тип", "Название", "Контрагент", "Дата", "Сумма", ""].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-hint text-[12px] font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(d => (
                <tr key={d.id} className="hover:bg-background/60 transition-colors">
                  <td className="px-4 py-3">
                    <span className={`text-[11px] px-2 py-0.5 rounded-md font-medium ${CATEGORY_COLOR[d.category] || "bg-gray-100 text-gray-600"}`}>
                      {CATEGORIES.find(c => c.key === d.category)?.label || d.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-muted-foreground">{d.doc_type_label}</td>
                  <td className="px-4 py-3">
                    <div className="text-[13px] font-medium text-foreground max-w-xs truncate">{d.title}</div>
                    {d.deal_code && (
                      <div className="text-[11px] text-primary">{d.deal_code}</div>
                    )}
                    {d.project_code && (
                      <div className="text-[11px] text-muted-foreground">{d.project_code}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[13px] text-muted-foreground max-w-[140px]">
                    <div className="truncate">{d.contractor_name || "—"}</div>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-hint whitespace-nowrap">{fmtDate(d.doc_date)}</td>
                  <td className="px-4 py-3 text-[13px] font-medium whitespace-nowrap">{fmtRub(d.amount)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {d.file_url ? (
                        <a href={d.file_url} target="_blank" rel="noreferrer"
                          className="text-muted-foreground hover:text-primary transition-colors" title="Скачать">
                          <Icon name="Download" size={14} />
                        </a>
                      ) : (
                        <span className="text-border cursor-default" title="Файл не прикреплён">
                          <Icon name="Paperclip" size={14} />
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </>
  );
}