import Icon from "@/components/ui/icon";
import { SlotItem } from "@/lib/api";

const MONTH_NAMES = ["","Январь","Февраль","Март","Апрель","Май","Июнь",
  "Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}
function addDays(d: string, n: number) {
  const dt = new Date(d);
  dt.setDate(dt.getDate() + n);
  return dt.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}
function daysBetween(d1: string, d2: string) {
  return Math.round((new Date(d2).getTime() - new Date(d1).getTime()) / 86400000);
}

interface Props {
  slots: SlotItem[];
  sloading: boolean;
  slotId: string;
  signedDate: string;
  cfgDur: number;
  minSlotDate: string;
  selectedSlot: SlotItem | undefined;
  isSerial: boolean;
  // если слот уже выбран ранее (сделка уже в процессе) — режим чтения
  readOnly?: boolean;
  onSlotChange: (id: string) => void;
  onSignedDateChange: (v: string) => void;
  onClose: () => void;
  onNext: () => void;
}

export default function ContractStepSlot({
  slots, sloading, slotId, signedDate, cfgDur, minSlotDate,
  selectedSlot, isSerial, readOnly,
  onSlotChange, onSignedDateChange, onClose, onNext,
}: Props) {
  const today = new Date().toISOString().split("T")[0];

  const slotsByMonth: Record<string, SlotItem[]> = {};
  slots.forEach(s => {
    const k = `${s.year}-${s.month}`;
    if (!slotsByMonth[k]) slotsByMonth[k] = [];
    slotsByMonth[k].push(s);
  });

  const canProceed = !isSerial || !!slotId;

  // ── Режим чтения (слот уже выбран, документы в процессе) ─────────────────
  if (readOnly && selectedSlot) {
    return (
      <div className="px-5 py-5 space-y-4">
        <div className="text-[13px] font-semibold">Производственный слот</div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-emerald-700 font-semibold text-[14px]">
            <Icon name="Factory" size={16} />
            Слот зафиксирован
          </div>
          <div className="grid grid-cols-2 gap-3 text-[13px]">
            <div>
              <div className="text-hint text-[11px]">Месяц производства</div>
              <div className="font-medium">{MONTH_NAMES[selectedSlot.month]} {selectedSlot.year}</div>
            </div>
            <div>
              <div className="text-hint text-[11px]">Дата старта</div>
              <div className="font-medium">{fmtDate(selectedSlot.start_date)}</div>
            </div>
            <div>
              <div className="text-hint text-[11px]">Длительность строительства</div>
              <div className="font-medium">{cfgDur} дней</div>
            </div>
            <div>
              <div className="text-hint text-[11px]">Ориентировочная сдача</div>
              <div className="font-medium">{addDays(selectedSlot.start_date, cfgDur)}</div>
            </div>
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 flex items-center gap-2">
          <Icon name="Info" size={13} className="text-blue-500 shrink-0" />
          <span className="text-[12px] text-blue-800">Слот зафиксирован. Продолжите оформление документов.</span>
        </div>
        <button type="button" onClick={onNext}
          className="w-full px-4 py-2.5 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors">
          Далее — Скачать документы →
        </button>
      </div>
    );
  }

  return (
    <div className="px-5 py-5 space-y-4">
      <div className="text-[13px] font-semibold">Выберите производственный слот</div>

      <div className="bg-violet-50 border border-violet-200 rounded-lg px-3 py-2.5 flex items-start gap-2">
        <Icon name="Factory" size={14} className="text-violet-600 shrink-0 mt-0.5" />
        <span className="text-[12px] text-violet-800">
          Слот — это зарезервированное место в производстве. Лимиты на месяц устанавливаются директором в Настройках.
          Отображаются слоты ближайших 6 месяцев.
        </span>
      </div>

      {/* Дата подписания (влияет на минимальный слот) */}
      <div>
        <label className="block text-[13px] font-medium mb-1">
          Дата подписания договора <span className="text-red-500">*</span>
        </label>
        <input
          type="date" value={signedDate} min={today}
          onChange={e => onSignedDateChange(e.target.value)}
          className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary"
        />
        {signedDate && (
          <div className="text-hint text-[11px] mt-1">
            Слот доступен не ранее {fmtDate(minSlotDate)} (дата подписания + 15 дней)
          </div>
        )}
      </div>

      {/* Выбор слота (только для серийных) */}
      {isSerial && (
        <div>
          <label className="block text-[13px] font-medium mb-2">
            Производственный слот <span className="text-red-500">*</span>
          </label>

          {sloading ? (
            <div className="space-y-2">
              {[1,2].map(i => <div key={i} className="h-14 bg-secondary rounded-xl animate-pulse" />)}
            </div>
          ) : slots.length === 0 ? (
            <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 flex items-start gap-2">
              <Icon name="AlertTriangle" size={14} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <div className="text-[13px] font-medium text-amber-800">Нет свободных слотов</div>
                <div className="text-[12px] text-amber-700 mt-0.5">
                  Все слоты заняты на ближайшие 6 месяцев. Обратитесь к директору для увеличения лимита.
                </div>
              </div>
            </div>
          ) : (
            <div className="border border-border rounded-xl overflow-hidden">
              {Object.entries(slotsByMonth).map(([key, monthSlots]) => {
                const [year, month] = key.split("-").map(Number);
                const occupied = monthSlots[0]?.occupied_count ?? 0;
                const limit    = monthSlots[0]?.monthly_limit ?? 4;
                const pct      = Math.min(Math.round((occupied / limit) * 100), 100);
                const isFull   = pct >= 100;

                return (
                  <div key={key} className="border-b border-border last:border-0">
                    {/* Заголовок месяца */}
                    <div className={`flex items-center justify-between px-4 py-2.5 ${isFull ? "bg-red-50" : "bg-background"}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold">{MONTH_NAMES[month]} {year}</span>
                        {isFull && (
                          <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-md font-medium">Заполнен</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-border rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-red-500" : pct >= 75 ? "bg-amber-400" : "bg-emerald-500"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-hint font-medium">{occupied}/{limit}</span>
                      </div>
                    </div>

                    {/* Слоты внутри месяца */}
                    {!isFull && (
                      <div className="grid grid-cols-2 gap-2 p-3">
                        {monthSlots.filter(s => s.available).map(slot => {
                          const isSel       = slotId === String(slot.id);
                          const daysToSlot  = signedDate ? daysBetween(signedDate, slot.start_date) : 0;
                          return (
                            <button
                              key={slot.id} type="button"
                              onClick={() => onSlotChange(String(slot.id))}
                              className={`text-left px-3 py-2.5 rounded-xl border text-[12px] transition-all ${
                                isSel
                                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                                  : "border-border hover:border-primary/50 hover:bg-background"
                              }`}
                            >
                              <div className="font-semibold text-[13px]">{fmtDate(slot.start_date)}</div>
                              {signedDate && (
                                <div className={`text-[10px] mt-0.5 ${isSel ? "text-primary/70" : "text-hint"}`}>
                                  через {daysToSlot} дн. после подписания
                                </div>
                              )}
                              <div className={`text-[10px] ${isSel ? "text-primary/70" : "text-hint"}`}>
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

          {/* Итог выбора */}
          {selectedSlot && (
            <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-center gap-2">
              <Icon name="CheckCircle" size={13} className="text-emerald-600 shrink-0" />
              <span className="text-[12px] text-emerald-700 font-medium">
                Выбран: {fmtDate(selectedSlot.start_date)} — сдача ~{addDays(selectedSlot.start_date, cfgDur)}
              </span>
            </div>
          )}
        </div>
      )}

      {!isSerial && (
        <div className="bg-secondary border border-border rounded-xl p-3 flex items-start gap-2">
          <Icon name="Info" size={13} className="text-muted-foreground shrink-0 mt-0.5" />
          <span className="text-[12px] text-muted-foreground">
            Для индивидуального проекта производственный слот определяется отдельно при планировании.
          </span>
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onClose}
          className="px-4 py-2 border border-border rounded-lg text-[13px] hover:bg-secondary transition-colors">
          Отмена
        </button>
        <button type="button" onClick={onNext} disabled={!canProceed || !signedDate}
          className="flex-1 px-4 py-2.5 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
          Далее — Скачать документы →
        </button>
      </div>
    </div>
  );
}
