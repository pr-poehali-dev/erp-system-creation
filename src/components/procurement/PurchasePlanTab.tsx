import { useEffect, useState } from "react";
import { api, PurchasePlan, Material } from "@/lib/api";
import Icon from "@/components/ui/icon";

const PERIOD_LABELS: Record<PurchasePlan["period"], string> = { неделя: "Неделя", месяц: "Месяц" };
const fmtDate = (s: string) => new Date(s).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });

const EMPTY_FORM = { material_id: "", planned_volume: "", period: "месяц" as PurchasePlan["period"], period_start: "" };

export default function PurchasePlanTab() {
  const [plan,      setPlan]      = useState<PurchasePlan[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form,      setForm]      = useState({ ...EMPTY_FORM });
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState("");
  const [deleting,  setDeleting]  = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([api.purchase_plan.list(), api.materials.list()])
      .then(([pl, mats]) => { setPlan(pl); setMaterials(mats); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setForm({ ...EMPTY_FORM }); setError(""); setModalOpen(true); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.material_id) { setError("Материал обязателен"); return; }
    if (!form.planned_volume || Number(form.planned_volume) <= 0) { setError("Укажите объём"); return; }
    if (!form.period_start) { setError("Укажите дату начала периода"); return; }
    setSaving(true); setError("");
    try {
      await api.purchase_plan.create({ material_id: Number(form.material_id), planned_volume: Number(form.planned_volume), period: form.period, period_start: form.period_start });
      setModalOpen(false); load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Удалить позицию из плана?")) return;
    setDeleting(id);
    try { await api.purchase_plan.delete(id); load(); }
    finally { setDeleting(null); }
  };

  // Группируем по периоду + дате начала
  const grouped = plan.reduce((acc, row) => {
    const key = `${row.period_start}-${row.period}`;
    if (!acc[key]) acc[key] = { period_start: row.period_start, period: row.period, rows: [] };
    acc[key].rows.push(row);
    return acc;
  }, {} as Record<string, { period_start: string; period: PurchasePlan["period"]; rows: PurchasePlan[] }>);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-[13px] text-muted-foreground">{plan.length} позиций в плане</div>
        <button onClick={openCreate}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors">
          <Icon name="Plus" size={14} />
          Добавить позицию
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1,2].map(i => <div key={i} className="h-24 bg-secondary rounded-xl animate-pulse" />)}
        </div>
      ) : plan.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-border py-12 text-center text-hint">
          <Icon name="CalendarRange" size={28} className="mx-auto mb-2 opacity-40" />
          <div className="text-[13px]">План закупок пуст</div>
          <div className="text-[11px] mt-1">Добавьте первую позицию</div>
        </div>
      ) : (
        Object.values(grouped).sort((a,b) => b.period_start.localeCompare(a.period_start)).map(group => (
          <div key={group.period_start + group.period} className="bg-white rounded-xl border border-border overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-secondary/30 flex items-center gap-2">
              <Icon name="Calendar" size={14} className="text-muted-foreground" />
              <span className="text-[13px] font-semibold">{PERIOD_LABELS[group.period]}: {fmtDate(group.period_start)}</span>
              <span className="text-[11px] text-hint ml-auto">{group.rows.length} позиций</span>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-secondary/20 text-left text-[11px] uppercase text-hint">
                  <th className="px-4 py-2 font-medium">Материал</th>
                  <th className="px-4 py-2 font-medium">Ед. изм.</th>
                  <th className="px-4 py-2 font-medium text-right">Плановый объём</th>
                  <th className="px-4 py-2 font-medium w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {group.rows.map(row => (
                  <tr key={row.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-3 text-[13px] font-medium">{row.material_name}</td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">{row.unit}</span>
                    </td>
                    <td className="px-4 py-3 text-[13px] font-semibold text-right">{row.planned_volume}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleDelete(row.id)} disabled={deleting === row.id}
                        className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-40">
                        {deleting === row.id ? <Icon name="Loader" size={12} className="animate-spin" /> : <Icon name="Trash2" size={12} />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        ))
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl border border-border shadow-xl w-full max-w-md animate-fade-in">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="font-semibold text-[15px]">Новая позиция плана</h2>
              <button onClick={() => setModalOpen(false)} className="text-muted-foreground hover:text-foreground"><Icon name="X" size={18} /></button>
            </div>
            <form onSubmit={handleSave} className="px-5 py-4 space-y-3">
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
                  <label className="block text-[13px] font-medium mb-1">Плановый объём <span className="text-red-500">*</span></label>
                  <input type="number" step="0.001" min="0" value={form.planned_volume} onChange={e => setForm(p => ({ ...p, planned_volume: e.target.value }))} placeholder="0"
                    className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-[13px] font-medium mb-1">Период</label>
                  <select value={form.period} onChange={e => setForm(p => ({ ...p, period: e.target.value as PurchasePlan["period"] }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-[13px] bg-white outline-none focus:ring-1 focus:ring-primary">
                    <option value="месяц">Месяц</option>
                    <option value="неделя">Неделя</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[13px] font-medium mb-1">Дата начала периода <span className="text-red-500">*</span></label>
                <input type="date" value={form.period_start} onChange={e => setForm(p => ({ ...p, period_start: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
              </div>
              {error && <div className="text-red-500 text-[12px]">{error}</div>}
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={saving}
                  className="flex-1 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1.5">
                  {saving && <Icon name="Loader" size={13} className="animate-spin" />}
                  Добавить
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