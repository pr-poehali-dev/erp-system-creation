import Icon from "@/components/ui/icon";
import { Deal, SlotItem } from "@/lib/api";

const MONTH_NAMES = ["","Январь","Февраль","Март","Апрель","Май","Июнь",
  "Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}
function addDays(d: string, n: number) {
  const dt = new Date(d); dt.setDate(dt.getDate() + n);
  return dt.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}
function daysBetween(d1: string, d2: string) {
  return Math.round((new Date(d2).getTime() - new Date(d1).getTime()) / 86400000);
}
const fmt = (n: number) => `₽ ${n.toLocaleString("ru")}`;

interface Props {
  deal: Deal;
  today: string;
  isSerial: boolean;
  cfgDur: number;
  saving: boolean;
  slots: SlotItem[];
  sloading: boolean;
  slotId: string;
  address: string;
  budget: string;
  signedDate: string;
  error: string;
  minSlotDate: string;
  selectedSlot: SlotItem | undefined;
  onSlotChange: (id: string) => void;
  onAddressChange: (v: string) => void;
  onBudgetChange: (v: string) => void;
  onSignedDateChange: (v: string) => void;
  onBack: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function ContractStepData({
  deal, today, isSerial, cfgDur, saving,
  slots, sloading, slotId, address, budget, signedDate, error,
  minSlotDate, selectedSlot,
  onSlotChange, onAddressChange, onBudgetChange, onSignedDateChange,
  onBack, onSubmit,
}: Props) {
  const slotsByMonth: Record<string, SlotItem[]> = {};
  slots.forEach(s => {
    const k = `${s.year}-${s.month}`;
    if (!slotsByMonth[k]) slotsByMonth[k] = [];
    slotsByMonth[k].push(s);
  });

  return (
    <form onSubmit={onSubmit} className="px-5 py-5 space-y-4">
      <div className="text-[13px] font-semibold">Зафиксировать договор и создать проект</div>

      {deal.configuration_name && (
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[13px] font-semibold text-violet-900">{deal.configuration_name}</div>
              <div className="text-[11px] text-violet-600">{cfgDur} дней строительства</div>
            </div>
            <div className="text-[14px] font-bold text-violet-900">{fmt(deal.budget)}</div>
          </div>
        </div>
      )}

      <div>
        <label className="block text-[13px] font-medium mb-1">Дата подписания <span className="text-red-500">*</span></label>
        <input type="date" value={signedDate} onChange={e => onSignedDateChange(e.target.value)} min={today}
          className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
        <div className="text-hint text-[11px] mt-1">Слот — не ранее {fmtDate(minSlotDate)}</div>
      </div>

      <div>
        <label className="block text-[13px] font-medium mb-1">Адрес строительства</label>
        <input type="text" value={address} onChange={e => onAddressChange(e.target.value)} placeholder="Точный адрес участка"
          className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
      </div>

      <div>
        <label className="block text-[13px] font-medium mb-1">Сумма договора (₽) <span className="text-red-500">*</span></label>
        <input type="number" value={budget} onChange={e => onBudgetChange(e.target.value)} placeholder="6500000" min={0}
          className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
      </div>

      {isSerial && (
        <div>
          <label className="block text-[13px] font-medium mb-1">Производственный слот <span className="text-red-500">*</span></label>
          <div className="text-hint text-[11px] mb-2">Показаны слоты после {fmtDate(minSlotDate)}</div>
          {sloading ? (
            <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-12 bg-secondary rounded-xl animate-pulse" />)}</div>
          ) : slots.length === 0 ? (
            <div className="border border-amber-200 bg-amber-50 rounded-xl p-3 text-[12px] text-amber-800">Нет свободных слотов.</div>
          ) : (
            <div className="border border-border rounded-xl overflow-hidden">
              {Object.entries(slotsByMonth).map(([key, monthSlots]) => {
                const [year, month] = key.split("-").map(Number);
                const pct = Math.min(
                  Math.round(((monthSlots[0]?.occupied_count ?? 0) / (monthSlots[0]?.monthly_limit ?? 4)) * 100),
                  100
                );
                return (
                  <div key={key} className="border-b border-border last:border-0">
                    <div className="flex items-center justify-between px-4 py-2 bg-background">
                      <span className="text-[13px] font-semibold">{MONTH_NAMES[month]} {year}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-border rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${pct >= 100 ? "bg-red-500" : pct >= 75 ? "bg-amber-400" : "bg-emerald-500"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-hint">{monthSlots[0]?.occupied_count ?? 0}/{monthSlots[0]?.monthly_limit ?? 4}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 p-3">
                      {monthSlots.map(slot => {
                        const isSel = slotId === String(slot.id);
                        return (
                          <button key={slot.id} type="button" onClick={() => onSlotChange(String(slot.id))}
                            className={`text-left px-3 py-2 rounded-lg border text-[12px] transition-all ${
                              isSel ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/50"
                            }`}>
                            <div className="font-semibold">{fmtDate(slot.start_date)}</div>
                            <div className={`text-[10px] mt-0.5 ${isSel ? "text-primary/70" : "text-hint"}`}>
                              +{daysBetween(signedDate, slot.start_date)} дн.
                            </div>
                            <div className={`text-[10px] ${isSel ? "text-primary/70" : "text-hint"}`}>
                              Сдача: ~{addDays(slot.start_date, cfgDur)}
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
            <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-center gap-2 text-[12px] text-emerald-700">
              <Icon name="CheckCircle" size={13} className="shrink-0" />
              {fmtDate(selectedSlot.start_date)} · через {daysBetween(signedDate, selectedSlot.start_date)} дн.
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-red-600 text-[13px]">
          <Icon name="AlertCircle" size={14} />{error}
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
        <Icon name="Zap" size={13} className="text-blue-500 shrink-0 mt-0.5" />
        <span className="text-[12px] text-blue-800">Автоматически создастся проект <strong>ДОМ-XXXX</strong> с Гант-планом.</span>
      </div>

      <div className="flex gap-3">
        <button type="button" onClick={onBack}
          className="px-4 py-2 border border-border rounded-lg text-[13px] hover:bg-secondary transition-colors">← Назад</button>
        <button type="submit" disabled={saving}
          className="flex-1 px-4 py-2 bg-violet-600 text-white rounded-lg text-[13px] font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors">
          {saving ? "Создание..." : "Создать проект"}
        </button>
      </div>
    </form>
  );
}
