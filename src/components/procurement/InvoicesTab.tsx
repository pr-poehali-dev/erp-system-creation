import { useEffect, useState } from "react";
import { api, Invoice, Supplier, Material } from "@/lib/api";
import Icon from "@/components/ui/icon";

const STATUS_CFG = {
  новый:              { label: "Новый",              cls: "bg-amber-100 text-amber-700" },
  обработан:          { label: "Обработан",          cls: "bg-emerald-100 text-emerald-700" },
  требуется_проверка: { label: "Требует проверки",   cls: "bg-red-100 text-red-700" },
};

const fmtMoney = (n: number | null) => n == null ? "—" : new Intl.NumberFormat("ru-RU",{maximumFractionDigits:2}).format(n) + " ₽";
const fmtDate  = (s: string | null) => s ? new Date(s).toLocaleDateString("ru-RU") : "—";

const EMPTY_FORM = {
  supplier_id: "", material_id: "", invoice_date: "", invoice_number: "",
  unit_price: "", quantity: "", recognition_status: "новый" as Invoice["recognition_status"],
  recognized_data: "",
};

export default function InvoicesTab() {
  const [invoices,   setInvoices]   = useState<Invoice[]>([]);
  const [suppliers,  setSuppliers]  = useState<Supplier[]>([]);
  const [materials,  setMaterials]  = useState<Material[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [modalOpen,  setModalOpen]  = useState(false);
  const [editItem,   setEditItem]   = useState<Invoice | null>(null);
  const [form,       setForm]       = useState({ ...EMPTY_FORM });
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState("");
  const [filterSt,   setFilterSt]   = useState<Invoice["recognition_status"] | "">("");

  const load = () => {
    setLoading(true);
    Promise.all([api.invoices.list(), api.suppliers.list(), api.materials.list()])
      .then(([inv, sup, mat]) => { setInvoices(inv); setSuppliers(sup); setMaterials(mat); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditItem(null); setForm({ ...EMPTY_FORM }); setError(""); setModalOpen(true); };
  const openEdit = (inv: Invoice) => {
    setEditItem(inv);
    setForm({
      supplier_id: String(inv.supplier_id), material_id: String(inv.material_id),
      invoice_date: inv.invoice_date || "", invoice_number: inv.invoice_number || "",
      unit_price: inv.unit_price != null ? String(inv.unit_price) : "",
      quantity: inv.quantity != null ? String(inv.quantity) : "",
      recognition_status: inv.recognition_status,
      recognized_data: inv.recognized_data || "",
    });
    setError(""); setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.supplier_id || !form.material_id) { setError("Поставщик и материал обязательны"); return; }
    setSaving(true); setError("");
    try {
      const body = {
        supplier_id: Number(form.supplier_id), material_id: Number(form.material_id),
        invoice_date: form.invoice_date || null, invoice_number: form.invoice_number || null,
        unit_price: form.unit_price ? Number(form.unit_price) : null,
        quantity: form.quantity ? Number(form.quantity) : null,
        recognition_status: form.recognition_status,
        recognized_data: form.recognized_data || null,
      };
      if (editItem) await api.invoices.update(editItem.id, body);
      else await api.invoices.create(body);
      setModalOpen(false); load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally { setSaving(false); }
  };

  const totalSum = invoices.reduce((s, i) => s + (i.total_amount || 0), 0);
  const visible = filterSt ? invoices.filter(i => i.recognition_status === filterSt) : invoices;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <select value={filterSt} onChange={e => setFilterSt(e.target.value as Invoice["recognition_status"] | "")}
            className="border border-border rounded-lg px-3 py-1.5 text-[13px] bg-white outline-none focus:ring-1 focus:ring-primary">
            <option value="">Все статусы</option>
            {Object.entries(STATUS_CFG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <div className="text-[13px] text-muted-foreground">
            Итого: <span className="font-semibold text-foreground">{fmtMoney(totalSum)}</span>
          </div>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors">
          <Icon name="Plus" size={14} />
          Добавить счёт
        </button>
      </div>

      <div className="bg-white rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="divide-y divide-border">
            {[1,2,3].map(i => <div key={i} className="h-12 animate-pulse bg-secondary/30" />)}
          </div>
        ) : visible.length === 0 ? (
          <div className="py-12 text-center text-hint">
            <Icon name="FileText" size={28} className="mx-auto mb-2 opacity-40" />
            <div className="text-[13px]">Счетов пока нет</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-secondary/50 text-left text-[11px] uppercase text-hint">
                  {["№ счёта","Поставщик","Материал","Дата","Цена","Кол-во","Сумма","Статус",""].map(h => (
                    <th key={h} className="px-4 py-2.5 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visible.map(inv => {
                  const st = STATUS_CFG[inv.recognition_status];
                  return (
                    <tr key={inv.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="px-4 py-3 text-[13px] font-medium">{inv.invoice_number || "—"}</td>
                      <td className="px-4 py-3 text-[13px]">{inv.supplier_name}</td>
                      <td className="px-4 py-3 text-[13px]">{inv.material_name} <span className="text-hint">({inv.unit})</span></td>
                      <td className="px-4 py-3 text-[12px] text-muted-foreground whitespace-nowrap">{fmtDate(inv.invoice_date)}</td>
                      <td className="px-4 py-3 text-[13px] text-right">{fmtMoney(inv.unit_price)}</td>
                      <td className="px-4 py-3 text-[13px] text-right">{inv.quantity ?? "—"}</td>
                      <td className="px-4 py-3 text-[13px] font-semibold text-right whitespace-nowrap">{fmtMoney(inv.total_amount)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => openEdit(inv)} className="text-[12px] px-2 py-1 border border-border rounded hover:bg-secondary transition-colors">
                          <Icon name="Pencil" size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl border border-border shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="font-semibold text-[15px]">{editItem ? "Редактировать счёт" : "Новый счёт"}</h2>
              <button onClick={() => setModalOpen(false)} className="text-muted-foreground hover:text-foreground"><Icon name="X" size={18} /></button>
            </div>
            <form onSubmit={handleSave} className="px-5 py-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[13px] font-medium mb-1">Поставщик <span className="text-red-500">*</span></label>
                  <select value={form.supplier_id} onChange={e => setForm(p => ({ ...p, supplier_id: e.target.value }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-[13px] bg-white outline-none focus:ring-1 focus:ring-primary">
                    <option value="">—</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[13px] font-medium mb-1">Материал <span className="text-red-500">*</span></label>
                  <select value={form.material_id} onChange={e => setForm(p => ({ ...p, material_id: e.target.value }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-[13px] bg-white outline-none focus:ring-1 focus:ring-primary">
                    <option value="">—</option>
                    {materials.map(m => <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[13px] font-medium mb-1">Дата счёта</label>
                  <input type="date" value={form.invoice_date} onChange={e => setForm(p => ({ ...p, invoice_date: e.target.value }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-[13px] font-medium mb-1">Номер счёта</label>
                  <input value={form.invoice_number} onChange={e => setForm(p => ({ ...p, invoice_number: e.target.value }))} placeholder="СФ-0001"
                    className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[13px] font-medium mb-1">Цена за единицу</label>
                  <input type="number" step="0.01" min="0" value={form.unit_price} onChange={e => setForm(p => ({ ...p, unit_price: e.target.value }))} placeholder="0.00"
                    className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-[13px] font-medium mb-1">Количество</label>
                  <input type="number" step="0.001" min="0" value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} placeholder="0"
                    className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
                </div>
              </div>
              {form.unit_price && form.quantity && (
                <div className="text-[13px] font-semibold text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
                  Сумма: {fmtMoney(Number(form.unit_price) * Number(form.quantity))}
                </div>
              )}
              <div>
                <label className="block text-[13px] font-medium mb-1">Статус распознавания</label>
                <select value={form.recognition_status} onChange={e => setForm(p => ({ ...p, recognition_status: e.target.value as Invoice["recognition_status"] }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-[13px] bg-white outline-none focus:ring-1 focus:ring-primary">
                  {Object.entries(STATUS_CFG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[13px] font-medium mb-1">Распознанные данные (JSON / текст)</label>
                <textarea value={form.recognized_data} onChange={e => setForm(p => ({ ...p, recognized_data: e.target.value }))} rows={3}
                  className="w-full border border-border rounded-lg px-3 py-2 text-[12px] font-mono outline-none focus:ring-1 focus:ring-primary resize-none" />
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
