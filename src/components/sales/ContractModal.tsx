import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { Deal, SlotItem, api } from "@/lib/api";
import { Role } from "@/App";

const MIN_BUFFER = 15;
const MONTH_NAMES = ["","Январь","Февраль","Март","Апрель","Май","Июнь",
  "Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}
function addDays(d: string, n: number) {
  const dt = new Date(d); dt.setDate(dt.getDate() + n);
  return dt.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

interface Props {
  deal: Deal;
  role: Role;
  saving: boolean;
  onClose: () => void;
  onSubmit: (body: object) => void;
}

export default function ContractModal({ deal, role, saving, onClose, onSubmit }: Props) {
  const today      = new Date().toISOString().slice(0, 10);
  const isSerial   = deal.project_type === "serial" || !deal.project_type;
  const cfgDur     = deal.configuration_duration || 115;

  const [slots, setSlots]           = useState<SlotItem[]>([]);
  const [sloading, setSloading]     = useState(false);
  const [slotId, setSlotId]         = useState(deal.slot_id ? String(deal.slot_id) : "");
  const [address, setAddress]       = useState(deal.address || "");
  const [budget, setBudget]         = useState(String(deal.budget || ""));
  const [signedDate, setSignedDate] = useState(today);
  const [error, setError]           = useState("");

  // Уже переведена в договор — показываем информацию о слоте
  const alreadySigned = deal.stage === "contract" || deal.stage === "planning";

  // Минимальная дата слота
  const minSlotDate = (() => {
    const d = new Date(signedDate); d.setDate(d.getDate() + MIN_BUFFER);
    return d.toISOString().slice(0, 10);
  })();

  const selectedSlot = slots.find(s => String(s.id) === slotId);

  // Группируем по месяцам
  const slotsByMonth: Record<string, SlotItem[]> = {};
  slots.forEach(s => {
    const k = `${s.year}-${s.month}`;
    if (!slotsByMonth[k]) slotsByMonth[k] = [];
    slotsByMonth[k].push(s);
  });

  useEffect(() => {
    if (alreadySigned) return;
    if (!isSerial) return;
    setSloading(true);
    api.slots.free(signedDate).then(setSlots).finally(() => setSloading(false));
  }, [signedDate, isSerial, alreadySigned]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!budget) { setError("Укажите сумму договора"); return; }
    if (isSerial && !slotId) { setError("Выберите производственный слот"); return; }
    if (selectedSlot) {
      const diffDays = (new Date(selectedSlot.start_date).getTime() - new Date(signedDate).getTime()) / 86400000;
      if (diffDays < MIN_BUFFER) {
        setError(`Слот должен быть минимум через ${MIN_BUFFER} дней после даты подписания`); return;
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

  // ── Режим чтения: договор уже подписан ──────────────────────────────────
  if (alreadySigned) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="bg-white rounded-xl border border-border shadow-xl w-full max-w-md animate-fade-in">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div>
              <h2 className="font-semibold text-[15px]">Договор · {deal.code}</h2>
              <p className="text-hint text-[12px]">{deal.client_name}</p>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <Icon name="X" size={18} />
            </button>
          </div>
          <div className="px-5 py-5 space-y-3">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
              <Icon name="CheckCircle" size={20} className="text-emerald-600 shrink-0" />
              <div>
                <div className="text-[14px] font-bold text-emerald-900">Договор подписан</div>
                <div className="text-[12px] text-emerald-700 mt-0.5">
                  Проект создан в разделе «Строительство»
                </div>
              </div>
            </div>

            {deal.slot_start_date && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                  <span className="text-[13px] font-semibold text-amber-800">Производственный слот</span>
                </div>
                <div className="text-[12px] text-amber-700">
                  Старт: <strong>{fmtDate(deal.slot_start_date)}</strong>
                </div>
                <div className="text-[12px] text-amber-700">
                  Плановое завершение: <strong>{addDays(deal.slot_start_date, cfgDur)}</strong>
                </div>
                <div className="text-[11px] text-amber-600 flex items-center gap-1 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                  Статус слота: Зарезервирован
                </div>
              </div>
            )}

            {deal.budget > 0 && (
              <div className="flex items-center justify-between px-3 py-2 bg-secondary rounded-lg">
                <span className="text-[13px] text-hint">Сумма договора</span>
                <span className="text-[14px] font-bold">₽ {deal.budget.toLocaleString("ru")}</span>
              </div>
            )}

            {deal.address && (
              <div className="flex items-start gap-2 text-[13px]">
                <Icon name="MapPin" size={13} className="text-hint shrink-0 mt-0.5" />
                <span className="text-foreground">{deal.address}</span>
              </div>
            )}

            <button onClick={onClose}
              className="w-full px-4 py-2.5 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors">
              Закрыть
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Форма подписания ─────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl border border-border shadow-xl w-full max-w-lg max-h-[94vh] overflow-y-auto animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="font-semibold text-[15px]">Подписание договора · {deal.code}</h2>
            <p className="text-hint text-[12px]">{deal.client_name} · {deal.serial_project_name || "Инд. проект"}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <Icon name="X" size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-5 space-y-4">
          {/* Инфо */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 flex items-start gap-2">
            <Icon name="Info" size={13} className="text-blue-500 shrink-0 mt-0.5" />
            <span className="text-[12px] text-blue-800">
              Заполните данные — сделка перейдёт в «Договор подписан» и проект появится в разделе Строительство.
            </span>
          </div>

          {/* Дата подписания */}
          <div>
            <label className="block text-[13px] font-medium mb-1">
              Дата подписания договора <span className="text-red-500">*</span>
            </label>
            <input type="date" value={signedDate} min={today}
              onChange={e => setSignedDate(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
          </div>

          {/* Сумма */}
          <div>
            <label className="block text-[13px] font-medium mb-1">
              Сумма договора (₽) <span className="text-red-500">*</span>
            </label>
            <input type="number" value={budget} onChange={e => setBudget(e.target.value)}
              placeholder="6500000" min={0}
              className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
          </div>

          {/* Адрес */}
          <div>
            <label className="block text-[13px] font-medium mb-1">Адрес строительства</label>
            <input type="text" value={address} onChange={e => setAddress(e.target.value)}
              placeholder="Точный адрес участка"
              className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
          </div>

          {/* Слот — только для серийных */}
          {isSerial && (
            <div>
              <label className="block text-[13px] font-medium mb-1">
                Производственный слот <span className="text-red-500">*</span>
              </label>
              <div className="text-hint text-[11px] mb-2">
                Доступны слоты не ранее {fmtDate(minSlotDate)} (+{MIN_BUFFER} дн. от подписания)
              </div>

              {sloading ? (
                <div className="space-y-2">
                  {[1,2].map(i => <div key={i} className="h-12 bg-secondary rounded-xl animate-pulse" />)}
                </div>
              ) : slots.length === 0 ? (
                <div className="border border-amber-200 bg-amber-50 rounded-xl p-3 flex items-start gap-2">
                  <Icon name="AlertTriangle" size={14} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-[13px] font-medium text-amber-800">Нет свободных слотов</div>
                    <div className="text-[12px] text-amber-700 mt-0.5">
                      Обратитесь к директору для добавления слотов в Администрировании.
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
                        <div className={`flex items-center justify-between px-4 py-2.5 ${isFull ? "bg-red-50" : "bg-background"}`}>
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-semibold">{MONTH_NAMES[month]} {year}</span>
                            {isFull && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">Заполнен</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 bg-border rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${pct >= 100 ? "bg-red-500" : pct >= 75 ? "bg-amber-400" : "bg-emerald-500"}`}
                                style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-[11px] text-hint">{occupied}/{limit}</span>
                          </div>
                        </div>

                        {!isFull && (
                          <div className="grid grid-cols-2 gap-2 p-3">
                            {monthSlots.filter(s => s.available).map(slot => {
                              const isSel = slotId === String(slot.id);
                              return (
                                <button key={slot.id} type="button"
                                  onClick={() => setSlotId(String(slot.id))}
                                  className={`text-left px-3 py-2.5 rounded-xl border text-[12px] transition-all ${
                                    isSel
                                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                                      : "border-border hover:border-primary/50 hover:bg-background"
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
            <div className="bg-secondary border border-border rounded-lg p-3 flex items-start gap-2">
              <Icon name="Info" size={13} className="text-muted-foreground shrink-0 mt-0.5" />
              <span className="text-[12px] text-muted-foreground">
                Для индивидуального проекта производственный слот определяется отдельно.
              </span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-[13px] bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <Icon name="AlertCircle" size={14} className="shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="px-4 py-2 border border-border rounded-lg text-[13px] hover:bg-secondary transition-colors">
              Отмена
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2.5 bg-violet-600 text-white rounded-lg text-[13px] font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
              {saving
                ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Создание проекта...</>
                : <><Icon name="PenLine" size={14} />Подписать договор и создать проект</>
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
