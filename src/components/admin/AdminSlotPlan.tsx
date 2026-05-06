import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { api, SlotPlan, SlotDetail, SlotMonth } from "@/lib/api";

const MONTH_NAMES = ["","Январь","Февраль","Март","Апрель","Май","Июнь",
  "Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];

const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

const STATUS_MAP: Record<string, { label: string; cls: string; dot: string }> = {
  free:   { label: "Свободен",       cls: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  booked: { label: "Зарезервирован", cls: "bg-amber-50 text-amber-700 border-amber-200",       dot: "bg-amber-400"  },
  busy:   { label: "Занят",          cls: "bg-red-50 text-red-700 border-red-200",              dot: "bg-red-500"    },
};

interface Props { readonly?: boolean; }

export default function AdminSlotPlan({ readonly }: Props) {
  const [plan, setPlan]           = useState<SlotPlan | null>(null);
  const [loading, setLoading]     = useState(true);
  const [editing, setEditing]     = useState<{ year: number; month: number; val: string } | null>(null);
  const [saving, setSaving]       = useState(false);
  const [deleting, setDeleting]   = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    year: CURRENT_YEAR, month: CURRENT_MONTH, count: 4, monthly_limit: 4,
  });
  const [creating, setCreating]   = useState(false);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api.slots.plan().then(setPlan).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const months: SlotMonth[]   = plan?.months ?? [];
  const slots: SlotDetail[]   = plan?.slots ?? [];

  const handleSaveLimit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await api.slots.updateLimit(editing.year, editing.month, Number(editing.val));
      setEditing(null);
      load();
    } finally { setSaving(false); }
  };

  const handleCreateSlots = async () => {
    setCreating(true);
    try {
      await api.slots.createSlots(
        createForm.year, createForm.month, createForm.count, createForm.monthly_limit
      );
      setShowCreate(false);
      load();
    } finally { setCreating(false); }
  };

  const handleDelete = async (slotId: number) => {
    setDeleting(slotId);
    try {
      await api.slots.deleteSlot(slotId);
      load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Ошибка";
      alert(msg);
    } finally { setDeleting(null); }
  };

  const getSlotsForMonth = (year: number, month: number) =>
    slots.filter(s => s.year === year && s.month === month);

  return (
    <div className="p-5 space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-[13px] text-hint">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />Свободен</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />Зарезервирован</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />Занят</span>
        </div>
        <div className="flex gap-2">
          {!readonly && (
            <button onClick={() => setShowCreate(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-[12px] font-medium hover:bg-primary/90 transition-colors">
              <Icon name="Plus" size={13} />Создать слоты
            </button>
          )}
          <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-[12px] hover:bg-secondary transition-colors">
            <Icon name="RefreshCw" size={12} className={loading ? "animate-spin" : ""} />
            Обновить
          </button>
        </div>
      </div>

      {/* Форма создания слотов */}
      {showCreate && !readonly && (
        <div className="border border-primary/30 bg-primary/5 rounded-xl p-4 space-y-3">
          <div className="text-[13px] font-semibold">Создать слоты на период</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="text-[11px] text-hint block mb-1">Год</label>
              <input type="number" min={CURRENT_YEAR} max={CURRENT_YEAR + 2}
                value={createForm.year}
                onChange={e => setCreateForm(f => ({ ...f, year: Number(e.target.value) }))}
                className="w-full border border-border rounded-lg px-2 py-1.5 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="text-[11px] text-hint block mb-1">Месяц</label>
              <select value={createForm.month}
                onChange={e => setCreateForm(f => ({ ...f, month: Number(e.target.value) }))}
                className="w-full border border-border rounded-lg px-2 py-1.5 text-[13px] outline-none focus:ring-1 focus:ring-primary">
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>{MONTH_NAMES[m]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-hint block mb-1">Кол-во слотов</label>
              <input type="number" min={1} max={10} value={createForm.count}
                onChange={e => setCreateForm(f => ({ ...f, count: Number(e.target.value) }))}
                className="w-full border border-border rounded-lg px-2 py-1.5 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="text-[11px] text-hint block mb-1">Лимит в месяц</label>
              <input type="number" min={1} max={20} value={createForm.monthly_limit}
                onChange={e => setCreateForm(f => ({ ...f, monthly_limit: Number(e.target.value) }))}
                className="w-full border border-border rounded-lg px-2 py-1.5 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>
          <div className="text-[11px] text-hint">
            Слоты создаются каждую неделю с первого понедельника месяца. Уже существующие даты пропускаются.
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreateSlots} disabled={creating}
              className="px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {creating ? "Создание..." : `Создать ${createForm.count} слота`}
            </button>
            <button onClick={() => setShowCreate(false)}
              className="px-4 py-2 border border-border rounded-lg text-[13px] hover:bg-secondary transition-colors">
              Отмена
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-14 bg-secondary rounded-xl animate-pulse" />)}
        </div>
      ) : months.length === 0 ? (
        <div className="text-center text-hint py-8">
          Нет данных по слотам. {!readonly && "Создайте слоты с помощью кнопки выше."}
        </div>
      ) : (
        <div className="space-y-3">
          {months.map(m => {
            const pct       = Math.min(m.load_pct, 100);
            const key       = `${m.year}-${m.month}`;
            const isEditing = editing?.year === m.year && editing?.month === m.month;
            const expanded  = expandedMonth === key;
            const monthSlots = getSlotsForMonth(m.year, m.month);

            return (
              <div key={key} className={`border rounded-xl overflow-hidden ${m.overloaded ? "border-red-200" : "border-border"}`}>
                {/* Строка месяца */}
                <div className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-secondary/30 transition-colors ${m.overloaded ? "bg-red-50" : "bg-background"}`}
                  onClick={() => setExpandedMonth(expanded ? null : key)}>
                  <div className="w-32 shrink-0">
                    <div className="text-[14px] font-semibold">{MONTH_NAMES[m.month]} {m.year}</div>
                    <div className="text-hint text-[11px]">{m.total_occupied} / {m.monthly_limit} занято</div>
                  </div>

                  <div className="flex-1">
                    <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-red-500" : pct >= 75 ? "bg-amber-400" : "bg-emerald-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex gap-3 mt-1 text-[11px] text-hint">
                      <span className="text-emerald-600">●&nbsp;{m.free_count} свободно</span>
                      <span className="text-amber-600">●&nbsp;{m.booked_count} бронь</span>
                      <span className="text-red-600">●&nbsp;{m.busy_count} занято</span>
                    </div>
                  </div>

                  {!readonly && (
                    <div className="shrink-0 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                      {isEditing ? (
                        <>
                          <input type="number" min={1} max={20} value={editing.val}
                            onChange={e => setEditing(prev => prev ? { ...prev, val: e.target.value } : null)}
                            className="w-14 border border-border rounded-lg px-2 py-1 text-[12px] outline-none focus:ring-1 focus:ring-primary text-center" />
                          <button onClick={handleSaveLimit} disabled={saving}
                            className="px-2.5 py-1 bg-primary text-white rounded-lg text-[11px] font-medium disabled:opacity-50">
                            {saving ? "..." : "OK"}
                          </button>
                          <button onClick={() => setEditing(null)} className="text-muted-foreground hover:text-foreground">
                            <Icon name="X" size={13} />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setEditing({ year: m.year, month: m.month, val: String(m.monthly_limit) })}
                          className="flex items-center gap-1 px-2.5 py-1.5 border border-border rounded-lg text-[11px] hover:bg-secondary transition-colors">
                          <Icon name="Edit2" size={11} />Лимит: {m.monthly_limit}
                        </button>
                      )}
                    </div>
                  )}

                  <Icon name={expanded ? "ChevronUp" : "ChevronDown"} size={14} className="text-muted-foreground shrink-0" />
                </div>

                {/* Детальная таблица слотов */}
                {expanded && (
                  <div className="border-t border-border">
                    {monthSlots.length === 0 ? (
                      <div className="px-4 py-3 text-[12px] text-hint">Нет слотов в этом месяце</div>
                    ) : (
                      <table className="w-full text-[12px]">
                        <thead>
                          <tr className="bg-secondary/40 text-hint text-[11px]">
                            <th className="text-left px-4 py-2 font-medium">Дата начала</th>
                            <th className="text-left px-4 py-2 font-medium">Статус</th>
                            <th className="text-left px-4 py-2 font-medium">Сделка</th>
                            <th className="text-left px-4 py-2 font-medium">Клиент</th>
                            <th className="text-left px-4 py-2 font-medium">Проект</th>
                            {!readonly && <th className="text-right px-4 py-2 font-medium">Действия</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {monthSlots.map(slot => {
                            const st = STATUS_MAP[slot.status] || STATUS_MAP.free;
                            return (
                              <tr key={slot.id} className="hover:bg-secondary/20 transition-colors">
                                <td className="px-4 py-2.5 font-medium">{fmtDate(slot.start_date)}</td>
                                <td className="px-4 py-2.5">
                                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-medium ${st.cls}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                                    {st.label}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 text-hint">{slot.deal_code || "—"}</td>
                                <td className="px-4 py-2.5 text-hint">{slot.client_name || "—"}</td>
                                <td className="px-4 py-2.5 text-hint">{slot.project_code || "—"}</td>
                                {!readonly && (
                                  <td className="px-4 py-2.5 text-right">
                                    {slot.status === "free" ? (
                                      <button
                                        onClick={() => handleDelete(slot.id)}
                                        disabled={deleting === slot.id}
                                        className="flex items-center gap-1 px-2.5 py-1 border border-red-200 text-red-600 rounded-lg text-[11px] hover:bg-red-50 transition-colors disabled:opacity-50 ml-auto">
                                        {deleting === slot.id
                                          ? <Icon name="Loader" size={11} className="animate-spin" />
                                          : <Icon name="Trash2" size={11} />
                                        }
                                        Удалить
                                      </button>
                                    ) : (
                                      <span className="text-[11px] text-hint">Нельзя удалить</span>
                                    )}
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!readonly && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
          <Icon name="Info" size={14} className="text-blue-500 shrink-0 mt-0.5" />
          <span className="text-[12px] text-blue-800">
            Изменение лимита применяется к будущим сделкам. Зарезервированные и занятые слоты не затрагиваются.
          </span>
        </div>
      )}
    </div>
  );
}
