import { useEffect, useState } from "react";
import { api, Material, MaterialCategory, MaterialUnit, SupplierCategory, MATERIAL_UNITS, SUPPLIER_CATEGORIES } from "@/lib/api";
import Icon from "@/components/ui/icon";
import { usePagination } from "@/hooks/usePagination";
import CategoryTreeSelect, { buildCategoryPath } from "./CategoryTreeSelect";

const CAT_LABELS: Record<SupplierCategory, string> = {
  бетон: "Бетон", пиломатериалы: "Пиломатериалы", металл: "Металл",
  кровля: "Кровля", инженерия: "Инженерия", отделка: "Отделка", прочее: "Прочее",
};

const EMPTY_FORM = { name: "", unit: "шт" as MaterialUnit, supplier_category: "" as SupplierCategory | "", category_id: null as number | null };

export default function MaterialsTab() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [categories, setCategories] = useState<MaterialCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Material | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const load = () => {
    setLoading(true);
    Promise.all([api.materials.list(), api.material_categories.list()])
      .then(([mats, cats]) => { setMaterials(mats); setCategories(cats); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditItem(null); setForm({ ...EMPTY_FORM }); setError(""); setModalOpen(true); };
  const openEdit = (m: Material) => {
    setEditItem(m);
    setForm({ name: m.name, unit: m.unit, supplier_category: m.supplier_category || "", category_id: m.category_id ?? null });
    setError(""); setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError("Наименование обязательно"); return; }
    setSaving(true); setError("");
    try {
      const body = { name: form.name.trim(), unit: form.unit, supplier_category: form.supplier_category || null, category_id: form.category_id };
      if (editItem) await api.materials.update(editItem.id, body);
      else await api.materials.create(body);
      setModalOpen(false); load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally { setSaving(false); }
  };

  const filtered = search
    ? materials.filter(m => m.name.toLowerCase().includes(search.toLowerCase()))
    : materials;
  const { pageItems: visible, Pager } = usePagination(filtered);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по названию..."
          className="border border-border rounded-lg px-3 py-1.5 text-[13px] outline-none focus:ring-1 focus:ring-primary w-64" />
        <button onClick={openCreate}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors">
          <Icon name="Plus" size={14} />
          Добавить материал
        </button>
      </div>

      <div className="bg-white rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="divide-y divide-border">
            {[1,2,3].map(i => <div key={i} className="h-12 animate-pulse bg-secondary/30" />)}
          </div>
        ) : visible.length === 0 ? (
          <div className="py-12 text-center text-hint">
            <Icon name="Package" size={28} className="mx-auto mb-2 opacity-40" />
            <div className="text-[13px]">Материалов пока нет</div>
          </div>
        ) : (
          <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-secondary/50 text-left text-[11px] uppercase text-hint">
                  {["Наименование","Ед. изм.","Категория","Категория поставщика",""].map(h => (
                    <th key={h} className="px-4 py-2.5 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visible.map(m => (
                  <tr key={m.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-3 text-[13px] font-medium">{m.name}</td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">{m.unit}</span>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-muted-foreground max-w-[260px]">
                      <span className="truncate block" title={m.category_id ? buildCategoryPath(categories, m.category_id) : ""}>
                        {m.category_id ? buildCategoryPath(categories, m.category_id) : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-muted-foreground">
                      {m.supplier_category ? CAT_LABELS[m.supplier_category] : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => openEdit(m)} className="text-[12px] px-2 py-1 border border-border rounded hover:bg-secondary transition-colors">
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

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl border border-border shadow-xl w-full max-w-md animate-fade-in">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="font-semibold text-[15px]">{editItem ? "Редактировать материал" : "Новый материал"}</h2>
              <button onClick={() => setModalOpen(false)} className="text-muted-foreground hover:text-foreground"><Icon name="X" size={18} /></button>
            </div>
            <form onSubmit={handleSave} className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-[13px] font-medium mb-1">Наименование <span className="text-red-500">*</span></label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Блок газобетонный D400"
                  className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[13px] font-medium mb-1">Единица измерения</label>
                  <select value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value as MaterialUnit }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-[13px] bg-white outline-none focus:ring-1 focus:ring-primary">
                    {MATERIAL_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[13px] font-medium mb-1">Категория поставщика</label>
                  <select value={form.supplier_category} onChange={e => setForm(p => ({ ...p, supplier_category: e.target.value as SupplierCategory | "" }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-[13px] bg-white outline-none focus:ring-1 focus:ring-primary">
                    <option value="">—</option>
                    {SUPPLIER_CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[13px] font-medium mb-1">Категория материала</label>
                <CategoryTreeSelect categories={categories} value={form.category_id}
                  onChange={id => setForm(p => ({ ...p, category_id: id }))} />
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