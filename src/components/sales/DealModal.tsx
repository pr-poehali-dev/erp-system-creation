import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { Client, Staff, SlotItem, api } from "@/lib/api";

const SOURCES = ["Авито", "Сайт", "Рекомендация", "Инстаграм", "ВКонтакте", "Другое"];

const MONTH_NAMES = [
  "", "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

function formatSlotDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

export interface DealFormState {
  client_id: string;
  source: string;
  budget: string;
  slot_id: string;
  manager_id: string;
  realtor_id: string;
  notes: string;
}

interface Props {
  form: DealFormState;
  clients: Client[];
  managers: Staff[];
  realtors: Staff[];
  saving: boolean;
  formError: string;
  onClose: () => void;
  onField: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  onSlotSelect: (slotId: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function DealModal({
  form, clients, managers, realtors,
  saving, formError,
  onClose, onField, onSlotSelect, onSubmit,
}: Props) {
  const [slots, setSlots] = useState<SlotItem[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(true);

  useEffect(() => {
    setSlotsLoading(true);
    api.slots.free().then(setSlots).finally(() => setSlotsLoading(false));
  }, []);

  // Группируем слоты по месяцам
  const slotsByMonth: Record<string, SlotItem[]> = {};
  slots.forEach(s => {
    const key = `${s.year}-${s.month}`;
    if (!slotsByMonth[key]) slotsByMonth[key] = [];
    slotsByMonth[key].push(s);
  });

  const selectedSlot = slots.find(s => String(s.id) === form.slot_id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl border border-border shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-[15px]">Новая сделка</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <Icon name="X" size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="px-5 py-4 space-y-4">

          {/* Клиент */}
          <div>
            <label className="block text-[13px] font-medium text-foreground mb-1">
              Клиент <span className="text-red-500">*</span>
            </label>
            <select name="client_id" value={form.client_id} onChange={onField}
              className="w-full border border-border rounded-lg px-3 py-2 text-[13px] bg-white outline-none focus:ring-1 focus:ring-primary">
              <option value="">— Выберите клиента —</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
              ))}
            </select>
          </div>

          {/* Источник */}
          <div>
            <label className="block text-[13px] font-medium text-foreground mb-1">Источник</label>
            <select name="source" value={form.source} onChange={onField}
              className="w-full border border-border rounded-lg px-3 py-2 text-[13px] bg-white outline-none focus:ring-1 focus:ring-primary">
              <option value="">— Источник —</option>
              {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Бюджет */}
          <div>
            <label className="block text-[13px] font-medium text-foreground mb-1">
              Бюджет (₽) <span className="text-red-500">*</span>
            </label>
            <input type="number" name="budget" value={form.budget} onChange={onField}
              placeholder="6500000" min={0}
              className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
          </div>

          {/* Выбор слота */}
          <div>
            <label className="block text-[13px] font-medium text-foreground mb-2">
              Дата начала строительства (слот) <span className="text-red-500">*</span>
            </label>

            {slotsLoading ? (
              <div className="border border-border rounded-xl p-4 animate-pulse">
                <div className="h-4 bg-secondary rounded w-1/2 mb-3" />
                <div className="grid grid-cols-2 gap-2">
                  {[1,2,3,4].map(i => <div key={i} className="h-10 bg-secondary rounded-lg" />)}
                </div>
              </div>
            ) : slots.length === 0 ? (
              <div className="border border-red-200 bg-red-50 rounded-xl p-4 flex items-center gap-2">
                <Icon name="AlertTriangle" size={15} className="text-red-500 shrink-0" />
                <span className="text-[13px] text-red-700">Нет свободных слотов. Обратитесь к директору.</span>
              </div>
            ) : (
              <div className="border border-border rounded-xl overflow-hidden">
                {Object.entries(slotsByMonth).map(([key, monthSlots]) => {
                  const [year, month] = key.split("-").map(Number);
                  const monthTotal = slots.filter(s => s.year === year && s.month === month).length;
                  const occupied = monthSlots[0]?.occupied_count ?? 0;
                  const limit = monthSlots[0]?.monthly_limit ?? 4;
                  const loadPct = Math.round((occupied / limit) * 100);

                  return (
                    <div key={key} className="border-b border-border last:border-0">
                      {/* Month header */}
                      <div className="flex items-center justify-between px-4 py-2.5 bg-background">
                        <span className="text-[13px] font-semibold text-foreground">
                          {MONTH_NAMES[month]} {year}
                        </span>
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-border rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${loadPct >= 100 ? "bg-red-500" : loadPct >= 75 ? "bg-amber-400" : "bg-emerald-500"}`}
                              style={{ width: `${Math.min(loadPct, 100)}%` }}
                            />
                          </div>
                          <span className={`text-[11px] font-medium ${loadPct >= 100 ? "text-red-500" : "text-muted-foreground"}`}>
                            {occupied}/{limit}
                          </span>
                        </div>
                      </div>

                      {/* Slot grid */}
                      <div className="grid grid-cols-2 gap-2 p-3">
                        {monthSlots.map(slot => {
                          const isSelected = form.slot_id === String(slot.id);
                          return (
                            <button
                              key={slot.id}
                              type="button"
                              onClick={() => onSlotSelect(String(slot.id))}
                              className={`
                                text-left px-3 py-2.5 rounded-lg border text-[13px] transition-all
                                ${isSelected
                                  ? "border-primary bg-primary/5 text-primary font-semibold ring-1 ring-primary"
                                  : "border-border bg-white hover:border-primary/50 hover:bg-primary/3 text-foreground"
                                }
                              `}
                            >
                              <div className="font-medium">{formatSlotDate(slot.start_date)}</div>
                              <div className={`text-[11px] mt-0.5 ${isSelected ? "text-primary/70" : "text-muted-foreground"}`}>
                                Завершение ~{(() => {
                                  const d = new Date(slot.start_date);
                                  d.setDate(d.getDate() + 62);
                                  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
                                })()}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {selectedSlot && (
              <div className="mt-2 flex items-center gap-2 text-[12px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                <Icon name="CheckCircle" size={13} className="shrink-0" />
                Выбран слот: <strong>{formatSlotDate(selectedSlot.start_date)}</strong> — дом будет сдан ~{(() => {
                  const d = new Date(selectedSlot.start_date);
                  d.setDate(d.getDate() + 62);
                  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
                })()}
              </div>
            )}
          </div>

          {/* Менеджер */}
          <div>
            <label className="block text-[13px] font-medium text-foreground mb-1">
              Менеджер <span className="text-red-500">*</span>
            </label>
            <select name="manager_id" value={form.manager_id} onChange={onField}
              className="w-full border border-border rounded-lg px-3 py-2 text-[13px] bg-white outline-none focus:ring-1 focus:ring-primary">
              <option value="">— Выберите менеджера —</option>
              {managers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* Риэлтор */}
          <div>
            <label className="block text-[13px] font-medium text-foreground mb-1">Риэлтор (опционально)</label>
            <select name="realtor_id" value={form.realtor_id} onChange={onField}
              className="w-full border border-border rounded-lg px-3 py-2 text-[13px] bg-white outline-none focus:ring-1 focus:ring-primary">
              <option value="">— Без риэлтора —</option>
              {realtors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* Примечания */}
          <div>
            <label className="block text-[13px] font-medium text-foreground mb-1">Примечания</label>
            <textarea name="notes" value={form.notes} onChange={onField}
              rows={2} placeholder="Комментарии к сделке..."
              className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary resize-none" />
          </div>

          {formError && (
            <div className="flex items-center gap-2 text-red-600 text-[13px]">
              <Icon name="AlertCircle" size={14} />
              {formError}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 border border-border rounded-lg text-[13px] hover:bg-secondary transition-colors">
              Отмена
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
              {saving ? "Сохранение..." : "Сохранить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
