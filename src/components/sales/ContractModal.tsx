import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { Deal, SlotItem, api } from "@/lib/api";

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
const MIN_BUFFER = 15; // минимум дней между подписанием и слотом

interface Props {
  deal: Deal;
  saving: boolean;
  onClose: () => void;
  onSubmit: (body: object) => void;
}

export default function ContractModal({ deal, saving, onClose, onSubmit }: Props) {
  const today = new Date().toISOString().slice(0, 10);

  const [slots, setSlots]           = useState<SlotItem[]>([]);
  const [sloading, setSloading]     = useState(false);
  const [slotId, setSlotId]         = useState("");
  const [address, setAddress]       = useState(deal.address || "");
  const [budget, setBudget]         = useState(String(deal.budget || ""));
  const [signedDate, setSignedDate] = useState(today);
  const [error, setError]           = useState("");

  const isSerial = deal.project_type === "serial" || !deal.project_type;
  const cfgDur   = deal.configuration_duration || 115;

  // Каждый раз когда меняется дата подписания — перезагружаем слоты
  useEffect(() => {
    if (!isSerial) return;
    setSloading(true);
    setSlotId(""); // сбрасываем выбранный слот при смене даты
    api.slots.free(signedDate).then(setSlots).finally(() => setSloading(false));
  }, [isSerial, signedDate]);

  const slotsByMonth: Record<string, SlotItem[]> = {};
  slots.forEach(s => {
    const key = `${s.year}-${s.month}`;
    if (!slotsByMonth[key]) slotsByMonth[key] = [];
    slotsByMonth[key].push(s);
  });

  const selectedSlot = slots.find(s => String(s.id) === slotId);

  // Минимальная допустимая дата слота = дата подписания + MIN_BUFFER
  const minSlotDate = (() => {
    const d = new Date(signedDate);
    d.setDate(d.getDate() + MIN_BUFFER);
    return d.toISOString().slice(0, 10);
  })();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSerial && !slotId) { setError("Выберите производственный слот"); return; }
    if (!budget) { setError("Подтвердите сумму договора"); return; }

    // Дополнительная проверка — слот должен быть не раньше подписания + MIN_BUFFER
    if (selectedSlot) {
      const diff = daysBetween(signedDate, selectedSlot.start_date);
      if (diff < MIN_BUFFER) {
        setError(`Слот должен быть минимум через ${MIN_BUFFER} дней после подписания договора`);
        return;
      }
    }

    setError("");
    onSubmit({
      slot_id:     slotId ? Number(slotId) : null,
      address,
      budget:      Number(budget),
      signed_date: signedDate,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl border border-border shadow-xl w-full max-w-lg max-h-[92vh] overflow-y-auto animate-fade-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="font-semibold text-[15px]">Договор подписан · {deal.code}</h2>
            <p className="text-hint text-[12px]">{deal.client_name} · {deal.serial_project_name || "Инд. проект"}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><Icon name="X" size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-5">

          {/* Инфо о КП */}
          {deal.configuration_name && (
            <div className="bg-violet-50 border border-violet-200 rounded-xl p-3">
              <div className="text-[13px] font-semibold text-violet-900 mb-1">Комплектация из КП</div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[13px] text-violet-800">{deal.configuration_name}</div>
                  <div className="text-[11px] text-violet-600">
                    {deal.selected_stages?.length || 0} этапов · {cfgDur} дней строительства
                  </div>
                </div>
                <div className="text-[14px] font-bold text-violet-900">{fmt(deal.budget)}</div>
              </div>
            </div>
          )}

          {/* Дата подписания — ключевой параметр */}
          <div>
            <label className="block text-[13px] font-medium mb-1">
              Дата подписания договора <span className="text-red-500">*</span>
            </label>
            <input type="date" value={signedDate}
              onChange={e => setSignedDate(e.target.value)}
              min={today}
              className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
            <div className="text-hint text-[11px] mt-1">
              Производственный слот будет доступен не ранее {fmtDate(minSlotDate)} (подписание + {MIN_BUFFER} дней)
            </div>
          </div>

          {/* Адрес */}
          <div>
            <label className="block text-[13px] font-medium mb-1">Адрес строительства</label>
            <input type="text" value={address} onChange={e => setAddress(e.target.value)}
              placeholder="Точный адрес участка"
              className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
          </div>

          {/* Сумма договора */}
          <div>
            <label className="block text-[13px] font-medium mb-1">
              Сумма договора (₽) <span className="text-red-500">*</span>
            </label>
            <input type="number" value={budget} onChange={e => setBudget(e.target.value)}
              placeholder="6500000" min={0}
              className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
          </div>

          {/* Слот производства */}
          {isSerial && (
            <div>
              <label className="block text-[13px] font-medium mb-1">
                Производственный слот <span className="text-red-500">*</span>
              </label>
              <div className="text-hint text-[11px] mb-2 flex items-center gap-1">
                <Icon name="Info" size={11} className="shrink-0" />
                Показаны слоты доступные после {fmtDate(minSlotDate)}
              </div>

              {sloading ? (
                <div className="space-y-2">
                  {[1,2].map(i => <div key={i} className="h-12 bg-secondary rounded-xl animate-pulse" />)}
                </div>
              ) : slots.length === 0 ? (
                <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 flex items-start gap-2">
                  <Icon name="AlertTriangle" size={15} className="text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-[13px] text-amber-800 font-medium">Нет доступных слотов</div>
                    <div className="text-[11px] text-amber-700 mt-0.5">
                      Нет свободных слотов позже {fmtDate(minSlotDate)}.
                      Измените дату подписания или обратитесь к директору для увеличения лимита.
                    </div>
                  </div>
                </div>
              ) : (
                <div className="border border-border rounded-xl overflow-hidden">
                  {Object.entries(slotsByMonth).map(([key, monthSlots]) => {
                    const [year, month] = key.split("-").map(Number);
                    const occupied = monthSlots[0]?.occupied_count ?? 0;
                    const limit    = monthSlots[0]?.monthly_limit ?? 4;
                    const pct      = Math.round((occupied / limit) * 100);
                    return (
                      <div key={key} className="border-b border-border last:border-0">
                        <div className="flex items-center justify-between px-4 py-2 bg-background">
                          <span className="text-[13px] font-semibold">{MONTH_NAMES[month]} {year}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-border rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${pct >= 100 ? "bg-red-500" : pct >= 75 ? "bg-amber-400" : "bg-emerald-500"}`}
                                style={{ width: `${Math.min(pct, 100)}%` }} />
                            </div>
                            <span className="text-[11px] text-hint">{occupied}/{limit}</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 p-3">
                          {monthSlots.map(slot => {
                            const isSel      = slotId === String(slot.id);
                            const diffDays   = daysBetween(signedDate, slot.start_date);
                            const buildEnd   = addDays(slot.start_date, cfgDur);
                            return (
                              <button key={slot.id} type="button"
                                onClick={() => setSlotId(String(slot.id))}
                                className={`text-left px-3 py-2.5 rounded-lg border text-[12px] transition-all ${
                                  isSel
                                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                                    : "border-border bg-white hover:border-primary/50"
                                }`}>
                                <div className="font-semibold">{fmtDate(slot.start_date)}</div>
                                <div className={`text-[10px] mt-0.5 ${isSel ? "text-primary/70" : "text-hint"}`}>
                                  +{diffDays} дн. от подписания
                                </div>
                                <div className={`text-[10px] ${isSel ? "text-primary/70" : "text-hint"}`}>
                                  Сдача: ~{buildEnd}
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
                  Слот {fmtDate(selectedSlot.start_date)} · через {daysBetween(signedDate, selectedSlot.start_date)} дн. после подписания
                </div>
              )}
            </div>
          )}

          {/* Инфо для индивидуальных */}
          {!isSerial && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
              <Icon name="Info" size={14} className="text-amber-600 shrink-0 mt-0.5" />
              <span className="text-[12px] text-amber-800">
                Для индивидуального проекта слот назначается после завершения проектирования.
              </span>
            </div>
          )}

          {/* Авто-действие */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
            <Icon name="Zap" size={13} className="text-blue-500 shrink-0 mt-0.5" />
            <span className="text-[12px] text-blue-800">
              Автоматически создастся проект <strong>ДОМ-XXXX</strong> с Гант-планом
              на основе выбранных в КП этапов.
            </span>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-[13px]">
              <Icon name="AlertCircle" size={14} />{error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 border border-border rounded-lg text-[13px] hover:bg-secondary transition-colors">
              Отмена
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2 bg-violet-600 text-white rounded-lg text-[13px] font-medium hover:bg-violet-700 transition-colors disabled:opacity-50">
              {saving ? "Создание проекта..." : "Подписать и создать проект"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
