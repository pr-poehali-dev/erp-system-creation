import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { api, SlotMonth } from "@/lib/api";

const MONTH_NAMES = ["","Январь","Февраль","Март","Апрель","Май","Июнь",
  "Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];

interface Props { readonly?: boolean; }

export default function AdminSlotPlan({ readonly }: Props) {
  const [plan, setPlan] = useState<SlotMonth[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ year: number; month: number; val: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api.slots.plan().then(setPlan).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSaveLimit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await api.slots.updateLimit(editing.year, editing.month, Number(editing.val));
      setEditing(null);
      load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-border">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Icon name="CalendarDays" size={16} className="text-primary" />
          <h2 className="font-semibold text-[15px]">Слот-план производства</h2>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-[12px] hover:bg-secondary transition-colors">
          <Icon name="RefreshCw" size={12} className={loading ? "animate-spin" : ""} />
          Обновить
        </button>
      </div>

      {loading ? (
        <div className="p-5 space-y-3">
          {[1,2,3,4].map(i => <div key={i} className="h-14 bg-secondary rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="p-5 space-y-3">
          {plan.map(m => {
            const pct = Math.min(m.load_pct, 100);
            const isEditing = editing?.year === m.year && editing?.month === m.month;
            return (
              <div key={`${m.year}-${m.month}`} className={`border rounded-xl p-4 ${m.overloaded ? "border-red-200 bg-red-50" : "border-border"}`}>
                <div className="flex items-center gap-4">
                  <div className="w-28 shrink-0">
                    <div className="text-[14px] font-semibold text-foreground">{MONTH_NAMES[m.month]} {m.year}</div>
                    <div className="text-hint text-[11px]">{m.total_occupied} / {m.monthly_limit} занято</div>
                  </div>

                  <div className="flex-1">
                    <div className="h-3 bg-secondary rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-red-500" : pct >= 75 ? "bg-amber-400" : "bg-emerald-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <div className="flex gap-3 text-[11px] text-hint">
                        <span className="text-emerald-600">●&nbsp;Свободно: {m.free_count}</span>
                        <span className="text-amber-600">●&nbsp;Бронь: {m.booked_count}</span>
                        <span className="text-blue-600">●&nbsp;В работе: {m.busy_count}</span>
                      </div>
                      <span className={`text-[11px] font-bold ${pct >= 100 ? "text-red-500" : pct >= 75 ? "text-amber-600" : "text-emerald-600"}`}>
                        {pct}%
                      </span>
                    </div>
                  </div>

                  {!readonly && (
                    <div className="shrink-0 flex items-center gap-2">
                      {isEditing ? (
                        <>
                          <input
                            type="number" min={1} max={20}
                            value={editing.val}
                            onChange={e => setEditing(prev => prev ? { ...prev, val: e.target.value } : null)}
                            className="w-16 border border-border rounded-lg px-2 py-1.5 text-[13px] outline-none focus:ring-1 focus:ring-primary text-center"
                          />
                          <button onClick={handleSaveLimit} disabled={saving}
                            className="px-3 py-1.5 bg-primary text-white rounded-lg text-[12px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
                            {saving ? "..." : "OK"}
                          </button>
                          <button onClick={() => setEditing(null)}
                            className="text-muted-foreground hover:text-foreground">
                            <Icon name="X" size={14} />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setEditing({ year: m.year, month: m.month, val: String(m.monthly_limit) })}
                          className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-[12px] hover:bg-secondary transition-colors"
                        >
                          <Icon name="Edit2" size={12} />
                          Лимит: {m.monthly_limit}
                        </button>
                      )}
                    </div>
                  )}

                  {m.overloaded && (
                    <span className="badge-error text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0">Перегруз</span>
                  )}
                </div>
              </div>
            );
          })}

          {plan.length === 0 && (
            <div className="text-center text-hint py-8">Нет данных по слотам</div>
          )}
        </div>
      )}

      {!readonly && (
        <div className="px-5 pb-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
            <Icon name="Info" size={14} className="text-blue-500 shrink-0 mt-0.5" />
            <span className="text-[12px] text-blue-800">
              Изменение лимита применяется только к будущим сделкам. Уже забронированные слоты не затрагиваются.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
