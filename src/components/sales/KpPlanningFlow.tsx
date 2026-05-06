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

interface Props {
  deal: Deal;
  cfgDur: number;
  onDone: () => void;  // вызывается при переходе в planning
  onClose: () => void;
}

type FlowStep = "slot" | "contract" | "payment" | "planning";

export default function KpPlanningFlow({ deal, cfgDur, onDone, onClose }: Props) {
  const [slots, setSlots]       = useState<SlotItem[]>([]);
  const [sloading, setSloading] = useState(false);
  const [slotId, setSlotId]     = useState(deal.kp_slot_id ? String(deal.kp_slot_id) : "");
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");

  // Определяем текущий шаг из состояния сделки
  const currentStep: FlowStep =
    deal.payment_confirmed ? "planning" :
    deal.contract_signed   ? "payment"  :
    deal.kp_slot_id        ? "contract" : "slot";

  const slotsByMonth: Record<string, SlotItem[]> = {};
  slots.forEach(s => {
    const k = `${s.year}-${s.month}`;
    if (!slotsByMonth[k]) slotsByMonth[k] = [];
    slotsByMonth[k].push(s);
  });

  const selectedSlot = slots.find(s => String(s.id) === slotId);

  useEffect(() => {
    setSloading(true);
    api.slots.free().then(setSlots).finally(() => setSloading(false));
  }, []);

  // Шаг 1: Сохранить слот
  const handleSaveSlot = async () => {
    if (!slotId) { setError("Выберите слот"); return; }
    setSaving(true); setError("");
    try {
      await api.deals.saveKpSlot(deal.id, Number(slotId));
      onDone();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally { setSaving(false); }
  };

  // Шаг 2: Отметить договор подписанным
  const handleConfirmContract = async () => {
    setSaving(true); setError("");
    try {
      await api.deals.confirmKpContract(deal.id);
      onDone();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally { setSaving(false); }
  };

  // Шаг 3: Подтвердить оплату
  const handleConfirmPayment = async () => {
    setSaving(true); setError("");
    try {
      await api.deals.confirmKpPayment(deal.id);
      onDone();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally { setSaving(false); }
  };

  // Шаг 4: Перевести в планирование
  const handleToPlanning = async () => {
    setSaving(true); setError("");
    try {
      await api.deals.toPlanning(deal.id);
      onDone();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally { setSaving(false); }
  };

  const STEPS = [
    { key: "slot",     num: 1, label: "Слот" },
    { key: "contract", num: 2, label: "Договор" },
    { key: "payment",  num: 3, label: "Оплата" },
    { key: "planning", num: 4, label: "Планирование" },
  ];

  const stepDone = (k: string) => {
    if (k === "slot")     return !!deal.kp_slot_id;
    if (k === "contract") return deal.contract_signed;
    if (k === "payment")  return deal.payment_confirmed;
    return false;
  };

  const kpSlotDate = deal.kp_slot_start_date;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl border border-border shadow-xl w-full max-w-lg max-h-[92vh] overflow-y-auto animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="font-semibold text-[15px]">Подготовка к планированию · {deal.code}</h2>
            <p className="text-hint text-[12px]">{deal.client_name}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <Icon name="X" size={18} />
          </button>
        </div>

        {/* Шаг-индикатор */}
        <div className="flex border-b border-border overflow-x-auto">
          {STEPS.map(s => {
            const isDone   = stepDone(s.key);
            const isActive = currentStep === s.key;
            return (
              <div key={s.key} className={`flex-1 min-w-[90px] flex flex-col items-center gap-1 px-2 py-3 text-center border-b-2 transition-colors ${
                isActive ? "border-primary text-primary" : isDone ? "border-emerald-400 text-emerald-600" : "border-transparent text-muted-foreground"
              }`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                  isDone ? "bg-emerald-500 text-white" : isActive ? "bg-primary text-white" : "bg-secondary text-muted-foreground"
                }`}>
                  {isDone ? "✓" : s.num}
                </span>
                <span className="text-[11px] font-medium leading-tight">{s.label}</span>
              </div>
            );
          })}
        </div>

        <div className="px-5 py-5 space-y-4">
          {/* ШАГ 1: Выбор слота */}
          {currentStep === "slot" && (
            <>
              <div className="text-[13px] font-semibold">Выберите производственный слот</div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 flex items-start gap-2">
                <Icon name="Info" size={13} className="text-blue-500 shrink-0 mt-0.5" />
                <span className="text-[12px] text-blue-800">
                  Слот остаётся свободным до финального шага. Дата прописывается в договоре.
                </span>
              </div>

              {sloading ? (
                <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-12 bg-secondary rounded-xl animate-pulse" />)}</div>
              ) : slots.length === 0 ? (
                <div className="border border-amber-200 bg-amber-50 rounded-xl p-3 flex items-start gap-2">
                  <Icon name="AlertTriangle" size={14} className="text-amber-600 shrink-0" />
                  <div className="text-[12px] text-amber-800">Нет свободных слотов. Обратитесь к директору.</div>
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
                                <button key={slot.id} type="button"
                                  onClick={() => setSlotId(String(slot.id))}
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

              {error && <div className="text-red-600 text-[13px] flex items-center gap-2"><Icon name="AlertCircle" size={14} />{error}</div>}

              <div className="flex gap-3">
                <button type="button" onClick={onClose}
                  className="px-4 py-2 border border-border rounded-lg text-[13px] hover:bg-secondary">Отмена</button>
                <button type="button" onClick={handleSaveSlot} disabled={!slotId || saving}
                  className="flex-1 px-4 py-2.5 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Сохранение...</> : <>Сохранить слот → Скачать договор</>}
                </button>
              </div>
            </>
          )}

          {/* ШАГ 2: Договор подписан */}
          {currentStep === "contract" && (
            <>
              <div className="text-[13px] font-semibold">Подписание договора</div>

              {kpSlotDate && (
                <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 space-y-1">
                  <div className="text-[12px] font-semibold text-violet-800">Выбранный слот</div>
                  <div className="text-[13px] text-violet-900">Старт: <strong>{fmtDate(kpSlotDate)}</strong></div>
                  <div className="text-[12px] text-violet-700">Плановая сдача: ~{addDays(kpSlotDate, cfgDur)}</div>
                  <div className="text-[11px] text-violet-600 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                    Статус слота: Свободен (забронируется при переводе в планирование)
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
                  <Icon name="Download" size={14} className="text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-[13px] font-medium text-blue-800">Скачайте договор с датой слота</div>
                    <div className="text-[12px] text-blue-700 mt-0.5">Договор содержит дату начала строительства согласно выбранному слоту</div>
                    <button type="button"
                      className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[12px] font-medium hover:bg-blue-700 transition-colors">
                      <Icon name="Download" size={12} />
                      Скачать договор (PDF)
                    </button>
                  </div>
                </div>

                <div className="border border-border rounded-xl p-4 space-y-3">
                  <div className="text-[13px] font-medium">Подписанный скан загружен?</div>
                  <div className="text-[12px] text-hint">Распечатайте, подпишите с клиентом, сфотографируйте или отсканируйте и загрузите.</div>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-2">
                    <Icon name="Info" size={13} className="text-amber-600 shrink-0" />
                    <span className="text-[12px] text-amber-800">После подтверждения можно перейти к следующему шагу</span>
                  </div>
                  <button type="button" onClick={handleConfirmContract} disabled={saving}
                    className="w-full px-4 py-2.5 bg-violet-600 text-white rounded-lg text-[13px] font-medium hover:bg-violet-700 disabled:opacity-50 flex items-center justify-center gap-2">
                    {saving ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Icon name="PenLine" size={14} />}
                    {saving ? "Сохранение..." : "Договор подписан — далее"}
                  </button>
                </div>
              </div>

              {error && <div className="text-red-600 text-[13px] flex items-center gap-2"><Icon name="AlertCircle" size={14} />{error}</div>}
            </>
          )}

          {/* ШАГ 3: Оплата */}
          {currentStep === "payment" && (
            <>
              <div className="text-[13px] font-semibold">Подтверждение аванса</div>

              {kpSlotDate && (
                <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-violet-500 shrink-0" />
                  <span className="text-[12px] text-violet-800">
                    Слот: {fmtDate(kpSlotDate)} · договор подписан ✓
                  </span>
                </div>
              )}

              <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 space-y-3">
                <div className="text-[13px] font-semibold text-amber-900">Ожидание аванса от клиента</div>
                <div className="text-[12px] text-amber-800">
                  После получения авансового платежа нажмите кнопку. Это даст возможность перевести сделку в производство.
                </div>
                <button type="button" onClick={handleConfirmPayment} disabled={saving}
                  className="w-full px-4 py-2.5 bg-amber-500 text-white rounded-lg text-[13px] font-semibold hover:bg-amber-600 disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Icon name="BadgeCheck" size={16} />}
                  {saving ? "Сохранение..." : "Аванс получен — подтвердить"}
                </button>
              </div>

              {error && <div className="text-red-600 text-[13px] flex items-center gap-2"><Icon name="AlertCircle" size={14} />{error}</div>}
            </>
          )}

          {/* ШАГ 4: Перевести в планирование */}
          {currentStep === "planning" && (
            <>
              <div className="text-[13px] font-semibold">Перевести в планирование</div>

              <div className="space-y-2 text-[12px]">
                <div className="flex items-center gap-2 text-emerald-700">
                  <Icon name="CheckCircle" size={14} className="shrink-0" />
                  Слот выбран{kpSlotDate ? `: ${fmtDate(kpSlotDate)}` : ""}
                </div>
                <div className="flex items-center gap-2 text-emerald-700">
                  <Icon name="CheckCircle" size={14} className="shrink-0" />
                  Договор подписан
                </div>
                <div className="flex items-center gap-2 text-emerald-700">
                  <Icon name="CheckCircle" size={14} className="shrink-0" />
                  Аванс подтверждён
                </div>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
                <div className="text-[13px] font-semibold text-emerald-900">Всё готово к запуску</div>
                <div className="text-[12px] text-emerald-800">
                  При нажатии кнопки:
                  <ul className="mt-1.5 space-y-1 list-disc list-inside">
                    <li>Слот получит статус <strong>«Зарезервирован»</strong> (жёлтый)</li>
                    <li>В разделе «Строительство» появится карточка проекта</li>
                    <li>Сделка перейдёт в статус «Планирование»</li>
                  </ul>
                </div>
                <button type="button" onClick={handleToPlanning} disabled={saving}
                  className="w-full px-4 py-3 bg-emerald-600 text-white rounded-lg text-[14px] font-bold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Icon name="PlayCircle" size={18} />}
                  {saving ? "Создание проекта..." : "Перевести в планирование"}
                </button>
              </div>

              {error && <div className="text-red-600 text-[13px] flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2"><Icon name="AlertCircle" size={14} />{error}</div>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
