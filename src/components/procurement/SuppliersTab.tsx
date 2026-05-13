import { useEffect, useRef, useState } from "react";
import { api, Supplier, SupplierCategory, SUPPLIER_CATEGORIES } from "@/lib/api";
import Icon from "@/components/ui/icon";
import { usePagination } from "@/hooks/usePagination";

const CATEGORY_LABELS: Record<SupplierCategory, string> = {
  бетон: "Бетон", пиломатериалы: "Пиломатериалы", металл: "Металл",
  кровля: "Кровля", инженерия: "Инженерия", отделка: "Отделка", прочее: "Прочее",
};

const RATING_STARS = (r: number | null) => r ? "★".repeat(r) + "☆".repeat(5 - r) : "—";

const EMPTY_FORM = { name: "", inn: "", category: "прочее" as SupplierCategory, contact: "", rating: "" };

export default function SuppliersTab() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Supplier | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [filterCat, setFilterCat] = useState<SupplierCategory | "">("");
  const [csvImporting, setCsvImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    api.suppliers.list().then(setSuppliers).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditItem(null);
    setForm({ ...EMPTY_FORM });
    setError("");
    setModalOpen(true);
  };
  const openEdit = (s: Supplier) => {
    setEditItem(s);
    setForm({ name: s.name, inn: s.inn || "", category: s.category, contact: s.contact || "", rating: s.rating ? String(s.rating) : "" });
    setError("");
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError("Название обязательно"); return; }
    setSaving(true); setError("");
    try {
      const body = { name: form.name.trim(), inn: form.inn.trim() || null, category: form.category, contact: form.contact.trim() || null, rating: form.rating ? Number(form.rating) : null };
      if (editItem) await api.suppliers.update(editItem.id, body);
      else await api.suppliers.create(body);
      setModalOpen(false);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally { setSaving(false); }
  };

  // CSV-импорт
  const handleCsvFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvImporting(true);
    try {
      const text = await file.text();
      const lines = text.split("\n").filter(l => l.trim());
      const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
      const rows = lines.slice(1).map(line => {
        const vals = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
        return Object.fromEntries(headers.map((h, i) => [h, vals[i] || ""]));
      }).filter(r => r["name"]);
      await api.suppliers.importCsv(rows);
      load();
    } finally {
      setCsvImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const filtered = filterCat ? suppliers.filter(s => s.category === filterCat) : suppliers;
  const { pageItems: visible, Pager } = usePagination(filtered);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <select value={filterCat} onChange={e => setFilterCat(e.target.value as SupplierCategory | "")}
            className="border border-border rounded-lg px-3 py-1.5 text-[13px] bg-white outline-none focus:ring-1 focus:ring-primary">
            <option value="">Все категории</option>
            {SUPPLIER_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCsvFile} />
          <button onClick={() => fileRef.current?.click()} disabled={csvImporting}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-[13px] hover:bg-secondary transition-colors disabled:opacity-50">
            {csvImporting ? <Icon name="Loader" size={13} className="animate-spin" /> : <Icon name="Upload" size={13} />}
            Импорт CSV
          </button>
          <button onClick={openCreate}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors">
            <Icon name="Plus" size={14} />
            Добавить поставщика
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="divide-y divide-border">
            {[1,2,3].map(i => <div key={i} className="px-5 py-3.5 h-12 animate-pulse bg-secondary/30" />)}
          </div>
        ) : visible.length === 0 ? (
          <div className="py-12 text-center text-hint">
            <Icon name="Building2" size={28} className="mx-auto mb-2 opacity-40" />
            <div className="text-[13px]">Поставщиков пока нет</div>
            <div className="text-[11px] mt-1">Нажмите «Добавить поставщика» или импортируйте из CSV</div>
          </div>
        ) : (
          <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-secondary/50 text-left text-[11px] uppercase text-hint">
                  {["Название","ИНН","Категория","Контакт","Рейтинг",""].map(h => (
                    <th key={h} className="px-4 py-2.5 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visible.map(s => (
                  <tr key={s.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-3 text-[13px] font-medium">{s.name}</td>
                    <td className="px-4 py-3 text-[13px] text-muted-foreground">{s.inn || "—"}</td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-secondary font-medium">{CATEGORY_LABELS[s.category]}</span>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-muted-foreground">{s.contact || "—"}</td>
                    <td className="px-4 py-3 text-[13px] text-amber-500 font-medium whitespace-nowrap">{RATING_STARS(s.rating)}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => openEdit(s)} className="text-[12px] px-2 py-1 border border-border rounded hover:bg-secondary transition-colors">
                        <Icon name="Pencil" size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {Pager}
          </>
        )}
      </div>

      {/* Модалка */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl border border-border shadow-xl w-full max-w-md animate-fade-in">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="font-semibold text-[15px]">{editItem ? "Редактировать поставщика" : "Новый поставщик"}</h2>
              <button onClick={() => setModalOpen(false)} className="text-muted-foreground hover:text-foreground"><Icon name="X" size={18} /></button>
            </div>
            <form onSubmit={handleSave} className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-[13px] font-medium mb-1">Название <span className="text-red-500">*</span></label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="ООО Бетон Строй"
                  className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[13px] font-medium mb-1">ИНН</label>
                  <input value={form.inn} onChange={e => setForm(p => ({ ...p, inn: e.target.value }))} placeholder="7700000000"
                    className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-[13px] font-medium mb-1">Рейтинг (1–5)</label>
                  <select value={form.rating} onChange={e => setForm(p => ({ ...p, rating: e.target.value }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-[13px] bg-white outline-none focus:ring-1 focus:ring-primary">
                    <option value="">—</option>
                    {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[13px] font-medium mb-1">Категория</label>
                <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value as SupplierCategory }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-[13px] bg-white outline-none focus:ring-1 focus:ring-primary">
                  {SUPPLIER_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[13px] font-medium mb-1">Контакт</label>
                <input value={form.contact} onChange={e => setForm(p => ({ ...p, contact: e.target.value }))} placeholder="+7 900 000-00-00"
                  className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
              </div>
              {error && <div className="text-red-500 text-[12px]">{error}</div>}
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={saving}
                  className="flex-1 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1.5">
                  {saving && <Icon name="Loader" size={13} className="animate-spin" />}
                  {editItem ? "Сохранить" : "Добавить"}
                </button>
                <button type="button" onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-border rounded-lg text-[13px] text-muted-foreground hover:bg-secondary transition-colors">
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}