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
const fmt = (n: number) => `₽ ${n.toLocaleString("ru")}`;

interface Props {
  deal: Deal;
  saving: boolean;
  onClose: () => void;
  onSubmit: (body: object) => void;
}

export default function ContractModal({ deal, saving, onClose, onSubmit }: Props) {
  const [slots, setSlots]         = useState<SlotItem[]>([]);
  const [sloading, setSloading]   = useState(true);
  const [slotId, setSlotId]       = useState("");
  const [address, setAddress]     = useState(deal.address || "");
  const [budget, setBudget]       = useState(String(deal.budget || ""));
  const [signedDate, setSignedDate] = useState(new Date().toISOString().slice(0, 10));
  const [buffer, setBuffer]       = useState(deal.buffer_days || 7);
  const [error, setError]         = useState("");

  const isSerial = deal.project_type === "serial" || !deal.project_type;
  const cfgDur   = deal.configuration_duration || 62;

  useEffect(() => {
    if (isSerial) {
      api.slots.free().then(setSlots).finally(() => setSloading(false));
    } else {
      setSloading(false);
    }
  }, [isSerial]);

  const slotsByMonth: Record<string, SlotItem[]> = {};
  slots.forEach(s => {
    const key = `${s.year}-${s.month}`;
    if (!slotsByMonth[key]) slotsByMonth[key] = [];
    slotsByMonth[key].push(s);
  });

  const selectedSlot = slots.find(s => String(s.id) === slotId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSerial && !slotId) { setError("Выберите производственный слот"); return; }
    if (!budget) { setError("Подтвердите сумму договора"); return; }
    setError("");
    onSubmit({
      slot_id:     slotId ? Number(slotId) : null,
      address,
      budget:      Number(budget),
      signed_date: signedDate,
      buffer_days: buffer,
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
              <div className="text-[13px] font-semibold text-violet-900 mb-1">Выбранная комплектация</div>
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

          {/* Дата подписания */}
          <div>
            <label className="block text-[13px] font-medium mb-1">Дата подписания</label>
            <input type="date" value={signedDate} onChange={e => setSignedDate(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
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

          {/* Слот производства — только серийный */}
          {isSerial && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[13px] font-medium">
                  Производственный слот <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground">Буфер документов:</span>
                  <select value={buffer} onChange={e => setBuffer(Number(e.target.value))}
                    className="border border-border rounded px-2 py-0.5 text-[12px]">
                    {[5, 7, 10, 14].map(d => <option key={d} value={d}>{d} дн.</option>)}
                  </select>
                </div>
              </div>

              {sloading ? (
                <div className="space-y-2">
                  {[1,2].map(i => <div key={i} className="h-12 bg-secondary rounded-xl animate-pulse" />)}
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
                            const isSel = slotId === String(slot.id);
                            const startStr = slot.start_date;
                            const buildStart = addDays(startStr, buffer);
                            const buildEnd   = addDays(startStr, buffer + cfgDur);
                            return (
                              <button key={slot.id} type="button"
                                onClick={() => setSlotId(String(slot.id))}
                                className={`text-left px-3 py-2.5 rounded-lg border text-[12px] transition-all ${
                                  isSel
                                    ? "border-primary bg-primary/5 text-primary ring-1 ring-primary"
                                    : "border-border bg-white hover:border-primary/50"
                                }`}>
                                <div className="font-semibold">{fmtDate(startStr)}</div>
                                <div className={`text-[10px] mt-0.5 ${isSel ? "text-primary/70" : "text-hint"}`}>
                                  Старт строительства: {buildStart}
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
                  Слот выбран · строительство начнётся {addDays(selectedSlot.start_date, buffer)}
                </div>
              )}
            </div>
          )}

          {/* Инфо для индивидуальных */}
          {!isSerial && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
              <Icon name="Info" size={14} className="text-amber-600 shrink-0 mt-0.5" />
              <span className="text-[12px] text-amber-800">
                Для индивидуального проекта проект создастся без привязки к производственному слоту.
                Дата начала будет назначена после завершения проектирования.
              </span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-[13px]">
              <Icon name="AlertCircle" size={14} />{error}
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
            <Icon name="Zap" size={13} className="text-blue-500 shrink-0 mt-0.5" />
            <span className="text-[12px] text-blue-800">
              После сохранения автоматически создастся проект <strong>ДОМ-XXXX</strong> с {deal.selected_stages?.length || 11} этапами строительства и Гант-планом.
            </span>
          </div>

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
