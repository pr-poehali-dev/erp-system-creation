import { useEffect, useState } from "react";
import { api, PurchaseRequest, Material, Staff } from "@/lib/api";
import Icon from "@/components/ui/icon";

const STATUS_CFG = {
  новая:    { label: "Новая",    cls: "bg-amber-100 text-amber-700" },
  в_работе: { label: "В работе", cls: "bg-blue-100 text-blue-700" },
  закрыта:  { label: "Закрыта", cls: "bg-gray-100 text-gray-500" },
};

const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString("ru-RU") : "—";

const EMPTY_FORM = { staff_id: "", material_id: "", quantity: "", needed_by: "", status: "новая" as PurchaseRequest["status"] };

export default function PurchaseRequestsTab() {
  const [requests,  setRequests]  = useState<PurchaseRequest[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [staff,     setStaff]     = useState<Staff[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem,  setEditItem]  = useState<PurchaseRequest | null>(null);
  const [form,      setForm]      = useState({ ...EMPTY_FORM });
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState("");
  const [filterSt,  setFilterSt]  = useState<PurchaseRequest["status"] | "">("");

  const load = () => {
    setLoading(true);
    Promise.all([api.purchase_requests.list(), api.materials.list(), api.staff()])
      .then(([reqs, mats, stf]) => { setRequests(reqs); setMaterials(mats); setStaff(stf); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditItem(null); setForm({ ...EMPTY_FORM }); setError(""); setModalOpen(true); };
  const openEdit = (r: PurchaseRequest) => {
    setEditItem(r);
    setForm({ staff_id: String(r.staff_id), material_id: String(r.material_id), quantity: String(r.quantity), needed_by: r.needed_by || "", status: r.status });
    setError(""); setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.staff_id || !form.material_id) { setError("Отправитель и материал обязательны"); return; }
    if (!form.quantity || Number(form.quantity) <= 0) { setError("Укажите количество"); return; }
    setSaving(true); setError("");
    try {
      const body = { staff_id: Number(form.staff_id), material_id: Number(form.material_id), quantity: Number(form.quantity), needed_by: form.needed_by || null, status: form.status };
      if (editItem) await api.purchase_requests.update(editItem.id, body);
      else await api.purchase_requests.create(body);
      setModalOpen(false); load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally { setSaving(false); }
  };

  const visible = filterSt ? requests.filter(r => r.status === filterSt) : requests;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <select value={filterSt} onChange={e => setFilterSt(e.target.value as PurchaseRequest["status"] | "")}
          className="border border-border rounded-lg px-3 py-1.5 text-[13px] bg-white outline-none focus:ring-1 focus:ring-primary">
          <option value="">Все статусы</option>
          {Object.entries(STATUS_CFG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button onClick={openCreate}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors">
          <Icon name="Plus" size={14} />
          Новая заявка
        </button>
      </div>

      <div className="bg-white rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="divide-y divide-border">
            {[1,2,3].map(i => <div key={i} className="h-12 animate-pulse bg-secondary/30" />)}
          </div>
        ) : visible.length === 0 ? (
          <div className="py-12 text-center text-hint">
            <Icon name="ClipboardList" size={28} className="mx-auto mb-2 opacity-40" />
            <div className="text-[13px]">Заявок пока нет</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-secondary/50 text-left text-[11px] uppercase text-hint">
                  {["Дата","Отправитель","Материал","Кол-во","Срок","Поставщики","Статус",""].map(h => (
                    <th key={h} className="px-4 py-2.5 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visible.map(r => {
                  const st = STATUS_CFG[r.status];
                  return (
                    <tr key={r.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="px-4 py-3 text-[12px] text-muted-foreground whitespace-nowrap">{fmtDate(r.created_at)}</td>
                      <td className="px-4 py-3 text-[13px]">{r.staff_name}</td>
                      <td className="px-4 py-3 text-[13px] font-medium">{r.material_name} <span className="text-hint font-normal">({r.unit})</span></td>
                      <td className="px-4 py-3 text-[13px]">{r.quantity}</td>
                      <td className="px-4 py-3 text-[12px] text-muted-foreground whitespace-nowrap">{fmtDate(r.needed_by)}</td>
                      <td className="px-4 py-3">
                        {r.suppliers.length === 0
                          ? <span className="text-hint text-[12px]">—</span>
                          : <div className="flex flex-col gap-0.5">
                              {r.suppliers.slice(0,3).map(s => (
                                <span key={s.id} className="text-[11px] text-muted-foreground">{s.name}</span>
                              ))}
                              {r.suppliers.length > 3 && <span className="text-[10px] text-hint">+{r.suppliers.length - 3} ещё</span>}
                            </div>
                        }
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => openEdit(r)} className="text-[12px] px-2 py-1 border border-border rounded hover:bg-secondary transition-colors">
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
          <div className="bg-white rounded-xl border border-border shadow-xl w-full max-w-md animate-fade-in">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="font-semibold text-[15px]">{editItem ? "Редактировать заявку" : "Новая заявка на закупку"}</h2>
              <button onClick={() => setModalOpen(false)} className="text-muted-foreground hover:text-foreground"><Icon name="X" size={18} /></button>
            </div>
            <form onSubmit={handleSave} className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-[13px] font-medium mb-1">Отправитель <span className="text-red-500">*</span></label>
                <select value={form.staff_id} onChange={e => setForm(p => ({ ...p, staff_id: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-[13px] bg-white outline-none focus:ring-1 focus:ring-primary">
                  <option value="">—</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.name} ({s.role})</option>)}
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[13px] font-medium mb-1">Количество <span className="text-red-500">*</span></label>
                  <input type="number" step="0.001" min="0" value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} placeholder="0"
                    className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-[13px] font-medium mb-1">Срок нужности</label>
                  <input type="date" value={form.needed_by} onChange={e => setForm(p => ({ ...p, needed_by: e.target.value }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
                </div>
              </div>
              {editItem && (
                <div>
                  <label className="block text-[13px] font-medium mb-1">Статус</label>
                  <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as PurchaseRequest["status"] }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-[13px] bg-white outline-none focus:ring-1 focus:ring-primary">
                    {Object.entries(STATUS_CFG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              )}
              {!editItem && (
                <div className="text-[12px] text-muted-foreground bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 flex items-start gap-2">
                  <Icon name="Info" size={13} className="shrink-0 mt-0.5 text-blue-600" />
                  Поставщики будут подобраны автоматически по категории материала
                </div>
              )}
              {error && <div className="text-red-500 text-[12px]">{error}</div>}
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={saving}
                  className="flex-1 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1.5">
                  {saving && <Icon name="Loader" size={13} className="animate-spin" />}
                  {editItem ? "Сохранить" : "Создать"}
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
