import Icon from "@/components/ui/icon";
import { SlotItem } from "@/lib/api";

const MONTH_NAMES = ["","Январь","Февраль","Март","Апрель","Май","Июнь",
  "Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];

export function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}
export function addDays(d: string, n: number) {
  const dt = new Date(d); dt.setDate(dt.getDate() + n);
  return dt.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

interface Props {
  slots: SlotItem[];
  sloading: boolean;
  slotId: string;
  cfgDur: number;
  saving: boolean;
  error: string;
  onSlotChange: (id: string) => void;
  onSave: () => void;
  onClose: () => void;
}

export default function KpFlowSlotStep({
  slots, sloading, slotId, cfgDur, saving, error,
  onSlotChange, onSave, onClose,
}: Props) {
  const slotsByMonth: Record<string, SlotItem[]> = {};
  slots.forEach(s => {
    const k = `${s.year}-${s.month}`;
    if (!slotsByMonth[k]) slotsByMonth[k] = [];
    slotsByMonth[k].push(s);
  });

  const selectedSlot = slots.find(s => String(s.id) === slotId);

  return (
    <div className="px-5 py-5 space-y-4">
      <div className="text-[13px] font-semibold">Выберите производственный слот</div>
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 flex items-start gap-2">
        <Icon name="Info" size={13} className="text-blue-500 shrink-0 mt-0.5" />
        <span className="text-[12px] text-blue-800">
          Слот бронируется только при финальном переводе в производство. Сейчас — выбор даты для договора.
          Доступны слоты не ранее чем через 10 дней от сегодня.
        </span>
      </div>

      {sloading ? (
        <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-12 bg-secondary rounded-xl animate-pulse" />)}</div>
      ) : slots.length === 0 ? (
        <div className="border border-amber-200 bg-amber-50 rounded-xl p-3 flex items-start gap-2">
          <Icon name="AlertTriangle" size={14} className="text-amber-600 shrink-0" />
          <div className="text-[12px] text-amber-800">Нет свободных слотов с нужным плечом (10+ дней). Обратитесь к директору.</div>
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden max-h-72 overflow-y-auto">
          {Object.entries(slotsByMonth).map(([key, monthSlots]) => {
            const [year, month] = key.split("-").map(Number);
            const occupied = monthSlots[0]?.occupied_count ?? 0;
            const limit    = monthSlots[0]?.monthly_limit ?? 4;
            const pct      = Math.min(Math.round((occupied / limit) * 100), 100);
            const isFull   = pct >= 100;
            return (
              <div key={key} className="border-b border-border last:border-0">
                <div className={`flex items-center justify-between px-4 py-2.5 ${isFull ? "bg-red-50" : "bg-background"}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold">{MONTH_NAMES[month]} {year}</span>
                    {isFull && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">Заполнен</span>}
                  </div>
                  <span className="text-[11px] text-hint">{occupied}/{limit}</span>
                </div>
                {!isFull && (
                  <div className="grid grid-cols-2 gap-2 p-3">
                    {monthSlots.filter(s => s.available).map(slot => {
                      const isSel = slotId === String(slot.id);
                      return (
                        <button key={slot.id} type="button" onClick={() => onSlotChange(String(slot.id))}
                          className={`text-left px-3 py-2 rounded-xl border text-[12px] transition-all ${
                            isSel ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/50"
                          }`}>
                          <div className="font-semibold text-[13px]">{fmtDate(slot.start_date)}</div>
                          <div className={`text-[10px] mt-0.5 ${isSel ? "text-primary/70" : "text-hint"}`}>
                            Сдача: ~{addDays(slot.start_date, cfgDur)}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {selectedSlot && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-center gap-2">
          <Icon name="CheckCircle" size={13} className="text-emerald-600 shrink-0" />
          <span className="text-[12px] text-emerald-700 font-medium">
            Выбран: {fmtDate(selectedSlot.start_date)} — сдача ~{addDays(selectedSlot.start_date, cfgDur)}
          </span>
        </div>
      )}

      {error && <div className="text-red-600 text-[13px] flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2"><Icon name="AlertCircle" size={14} />{error}</div>}

      <div className="flex gap-3">
        <button type="button" onClick={onClose} className="px-4 py-2 border border-border rounded-lg text-[13px] hover:bg-secondary">Отмена</button>
        <button type="button" onClick={onSave} disabled={!slotId || saving}
          className="flex-1 px-4 py-2.5 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
          {saving ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Сохранение...</> : "Сохранить слот → к документам"}
        </button>
      </div>
    </div>
  );
}
