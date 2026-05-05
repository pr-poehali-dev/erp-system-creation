import { useEffect, useState } from "react";
import { Role } from "@/App";
import Icon from "@/components/ui/icon";
import { api, Document, Contractor } from "@/lib/api";

interface Props { role: Role; }

const CATEGORIES = [
  { key: "",           label: "Все",          icon: "Files" },
  { key: "deal",       label: "Сделки",       icon: "PenLine" },
  { key: "supply",     label: "Поставщики",   icon: "Package" },
  { key: "contractor", label: "Подрядчики",   icon: "Hammer" },
  { key: "internal",   label: "Внутренние",   icon: "Shield" },
  { key: "general",    label: "Компания",     icon: "Globe" },
];

// Типы документов которые можно создать вручную в каждой категории
const DOC_TYPES_BY_CATEGORY: Record<string, { key: string; label: string }[]> = {
  deal:       [
    { key: "deal_kp",         label: "КП" },
    { key: "deal_contract",   label: "Договор подряда" },
    { key: "deal_act",        label: "Акт приёмки" },
    { key: "deal_supplement", label: "Доп. соглашение" },
  ],
  supply:     [
    { key: "supply_contract",    label: "Договор поставки" },
    { key: "supply_invoice",     label: "Счёт" },
    { key: "supply_upd",         label: "УПД" },
    { key: "supply_waybill",     label: "Товарная накладная" },
    { key: "supply_certificate", label: "Сертификат" },
  ],
  contractor: [
    { key: "contractor_contract", label: "Договор подряда" },
    { key: "ks2",                 label: "Акт КС-2" },
    { key: "ks3",                 label: "Справка КС-3" },
    { key: "contractor_invoice",  label: "Счёт" },
    { key: "contractor_estimate", label: "Смета" },
  ],
  internal:   [
    { key: "internal_regulation", label: "Регламент" },
    { key: "internal_order",      label: "Приказ" },
    { key: "internal_hr",         label: "Должностная инструкция" },
  ],
  general:    [
    { key: "company_license",     label: "Лицензия" },
    { key: "company_certificate", label: "Сертификат компании" },
    { key: "company_permit",      label: "Разрешение" },
  ],
};

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  draft:     { label: "Черновик",  cls: "bg-gray-100 text-gray-600 border-gray-200" },
  sent:      { label: "Отправлен", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  signed:    { label: "Подписан",  cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  paid:      { label: "Оплачен",   cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  cancelled: { label: "Отменён",   cls: "bg-red-50 text-red-600 border-red-200" },
  active:    { label: "Действует", cls: "bg-violet-50 text-violet-700 border-violet-200" },
};

const CATEGORY_COLOR: Record<string, string> = {
  deal:       "bg-blue-50 text-blue-700",
  supply:     "bg-amber-50 text-amber-700",
  contractor: "bg-violet-50 text-violet-700",
  internal:   "bg-emerald-50 text-emerald-700",
  general:    "bg-gray-100 text-gray-600",
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}
const fmtRub = (n: number | null) => n ? `₽ ${n.toLocaleString("ru")}` : "—";

export default function Documents({ role }: Props) {
  const [docs, setDocs]             = useState<Document[]>([]);
  const [loading, setLoading]       = useState(true);
  const [category, setCategory]     = useState("");
  const [search, setSearch]         = useState("");
  const [statusFilter, setStatus]   = useState("");
  const [modalOpen, setModalOpen]   = useState(false);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState("");

  const [form, setForm] = useState({
    doc_type: "", category: "", title: "", status: "draft",
    amount: "", doc_date: "", contractor_id: "", deal_id: "", notes: "",
  });

  const canEdit = ["director", "commercial", "supply_director", "finance_director"].includes(role);

  const load = () => {
    setLoading(true);
    api.documents.list(category ? { category } : {}).then(setDocs).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [category]);

  useEffect(() => {
    api.contractors.list().then(setContractors);
  }, []);

  const filtered = docs.filter(d => {
    if (statusFilter && d.status !== statusFilter) return false;
    if (search && !d.title.toLowerCase().includes(search.toLowerCase()) &&
        !(d.deal_code || "").toLowerCase().includes(search.toLowerCase()) &&
        !(d.contractor_name || "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const countsByCategory: Record<string, number> = {};
  docs.forEach(d => { countsByCategory[d.category] = (countsByCategory[d.category] || 0) + 1; });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.doc_type || !form.title) { setError("Заполните тип и название"); return; }
    setSaving(true);
    try {
      const cat = form.category || Object.keys(DOC_TYPES_BY_CATEGORY).find(k =>
        DOC_TYPES_BY_CATEGORY[k].some(t => t.key === form.doc_type)) || "general";
      await api.documents.create({
        ...form,
        category: cat,
        amount: form.amount ? Number(form.amount) : null,
        contractor_id: form.contractor_id ? Number(form.contractor_id) : null,
        deal_id: form.deal_id ? Number(form.deal_id) : null,
      });
      setModalOpen(false);
      load();
      setForm({ doc_type: "", category: "", title: "", status: "draft",
        amount: "", doc_date: "", contractor_id: "", deal_id: "", notes: "" });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally { setSaving(false); }
  };

  // Смена статуса документа
  const handleStatusChange = async (doc: Document, newStatus: string) => {
    await api.documents.updateStatus(doc.id, newStatus);
    load();
  };

  const availableDocTypes = category
    ? (DOC_TYPES_BY_CATEGORY[category] || [])
    : Object.values(DOC_TYPES_BY_CATEGORY).flat();

  return (
    <div className="space-y-5 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Документы</h1>
          <p className="text-hint mt-0.5">
            Все документы компании · сделки, поставщики, подрядчики, внутренние
          </p>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <button onClick={() => { setError(""); setModalOpen(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors">
              <Icon name="Plus" size={14} />
              Добавить документ
            </button>
          )}
        </div>
      </div>

      {/* Категории */}
      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map(cat => {
          const cnt = cat.key ? (countsByCategory[cat.key] || 0) : docs.length;
          return (
            <button key={cat.key}
              onClick={() => setCategory(cat.key)}
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
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по названию, сделке, контрагенту..."
            className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-[13px] outline-none focus:ring-1 focus:ring-primary bg-white" />
        </div>
        <select value={statusFilter} onChange={e => setStatus(e.target.value)}
          className="border border-border rounded-lg px-3 py-2 text-[13px] bg-white outline-none">
          <option value="">Все статусы</option>
          {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* Автоматические документы — подсказка */}
      {category === "deal" || category === "" ? (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-2">
          <Icon name="Zap" size={14} className="text-blue-500 shrink-0" />
          <span className="text-[12px] text-blue-800">
            <strong>Автоматически:</strong> при переводе сделки в КП создаётся черновик КП, при подписании договора — «Договор подряда» со статусом «Подписан».
          </span>
        </div>
      ) : null}

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
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-background">
                {["Категория", "Тип", "Название", "Контрагент", "Дата", "Сумма", ""].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-hint text-[12px] font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(d => {
                const status = STATUS_MAP[d.status] || { label: d.status, cls: "bg-gray-100 text-gray-600" };
                return (
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
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* МОДАЛКА создания */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl border border-border shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="font-semibold text-[15px]">Новый документ</h2>
              <button onClick={() => setModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <Icon name="X" size={18} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="px-5 py-4 space-y-4">

              {/* Категория → тип */}
              <div>
                <label className="block text-[13px] font-medium mb-2">Категория</label>
                <div className="grid grid-cols-3 gap-2">
                  {CATEGORIES.filter(c => c.key).map(cat => (
                    <button key={cat.key} type="button"
                      onClick={() => setForm(p => ({ ...p, category: cat.key, doc_type: "" }))}
                      className={`flex items-center gap-1.5 p-2 rounded-lg border text-[12px] transition-all ${
                        form.category === cat.key
                          ? "border-primary bg-primary/5 ring-1 ring-primary font-semibold"
                          : "border-border hover:border-primary/30"
                      }`}>
                      <Icon name={cat.icon as Parameters<typeof Icon>[0]["name"]} size={12} />
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-medium mb-1">Тип документа <span className="text-red-500">*</span></label>
                <select value={form.doc_type} onChange={e => setForm(p => ({ ...p, doc_type: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-[13px] bg-white outline-none focus:ring-1 focus:ring-primary">
                  <option value="">— Выберите тип —</option>
                  {availableDocTypes.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[13px] font-medium mb-1">Название <span className="text-red-500">*</span></label>
                <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="Договор поставки № 123 — ООО Поставщик"
                  className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[13px] font-medium mb-1">Дата документа</label>
                  <input type="date" value={form.doc_date} onChange={e => setForm(p => ({ ...p, doc_date: e.target.value }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-[13px] font-medium mb-1">Сумма (₽)</label>
                  <input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                    placeholder="0" min={0}
                    className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-medium mb-1">Контрагент</label>
                <select value={form.contractor_id} onChange={e => setForm(p => ({ ...p, contractor_id: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-[13px] bg-white outline-none focus:ring-1 focus:ring-primary">
                  <option value="">— Без контрагента —</option>
                  {contractors.map(c => (
                    <option key={c.id} value={c.id}>{c.type_label} · {c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[13px] font-medium mb-1">Статус</label>
                <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-[13px] bg-white outline-none focus:ring-1 focus:ring-primary">
                  {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[13px] font-medium mb-1">Примечания</label>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2}
                  className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary resize-none" />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-600 text-[13px]">
                  <Icon name="AlertCircle" size={14} />{error}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-border rounded-lg text-[13px] hover:bg-secondary transition-colors">
                  Отмена
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
                  {saving ? "Сохранение..." : "Создать"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}