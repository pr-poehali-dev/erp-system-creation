import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { Deal, SlotItem, api } from "@/lib/api";

interface Props {
  deal: Deal;
  onClose: () => void;
  onChanged: () => void;
}

type StageKey = "lead" | "kp" | "contract" | "planning" | "closed";

const STAGES: { key: StageKey; label: string; icon: string }[] = [
  { key: "lead",     label: "Новый лид",     icon: "FileText" },
  { key: "kp",       label: "КП отправлено", icon: "Send" },
  { key: "contract", label: "Договор",       icon: "FileSignature" },
  { key: "planning", label: "Планирование",  icon: "CalendarRange" },
  { key: "closed",   label: "Закрыта",       icon: "CheckCircle2" },
];

const STAGE_ORDER: StageKey[] = ["lead", "kp", "contract", "planning", "closed"];

export default function RealtorDealActions({ deal, onClose, onChanged }: Props) {
  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState("");
  const [slots, setSlots]   = useState<SlotItem[]>([]);
  const [pickSlot, setPickSlot] = useState(false);
  const [slotId, setSlotId] = useState<number | null>(deal.kp_slot_id || null);

  const stage = (deal.stage as StageKey) || "lead";
  const stageIdx = STAGE_ORDER.indexOf(stage);

  useEffect(() => {
    if (pickSlot) {
      api.slots.free().then(setSlots);
    }
  }, [pickSlot]);

  const wrap = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      onChanged();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ошибка операции");
    } finally {
      setBusy(false);
    }
  };

  const sendKp        = () => wrap(() => api.deals.toKp(deal.id, {}));
  const saveSlot      = () => slotId && wrap(() => api.deals.saveKpSlot(deal.id, slotId));
  const confirmContract = () => wrap(() => api.deals.confirmKpContract(deal.id));
  const confirmPayment  = () => wrap(() => api.deals.confirmKpPayment(deal.id));
  const toPlanning      = () => wrap(() => api.deals.toPlanning(deal.id));
  const closeDeal       = () => wrap(() => api.deals.updateStage(deal.id, "closed"));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl border border-border shadow-xl w-full max-w-2xl max-h-[94vh] overflow-y-auto animate-fade-in">
        {/* Шапка */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="font-semibold text-[15px]">{deal.code} · {deal.client_name}</h2>
            <p className="text-hint text-[12px] mt-0.5">
              {deal.serial_project_name || (deal.project_type === "individual" ? "Индивидуальный" : "—")}
              {deal.budget ? ` · ₽ ${deal.budget.toLocaleString("ru")}` : ""}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <Icon name="X" size={18} />
          </button>
        </div>

        {/* Stepper */}
        <div className="flex items-center px-5 py-4 border-b border-border bg-secondary/30 overflow-x-auto">
          {STAGES.map((s, i) => {
            const passed = i < stageIdx;
            const active = i === stageIdx;
            return (
              <div key={s.key} className="flex items-center shrink-0">
                <div className={`flex flex-col items-center gap-1 ${i > 0 ? "ml-1" : ""}`}>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-bold ${
                    passed ? "bg-emerald-500 text-white"
                      : active ? "bg-primary text-white"
                      : "bg-white border border-border text-muted-foreground"
                  }`}>
                    {passed ? <Icon name="Check" size={15} /> : <Icon name={s.icon} size={15} />}
                  </div>
                  <span className={`text-[10px] font-medium ${active ? "text-primary" : passed ? "text-emerald-600" : "text-muted-foreground"}`}>
                    {s.label}
                  </span>
                </div>
                {i < STAGES.length - 1 && (
                  <div className={`h-0.5 w-8 mt-[-14px] ${i < stageIdx ? "bg-emerald-400" : "bg-border"}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Действия по этапу */}
        <div className="px-5 py-5">
          {error && (
            <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-[12px]">
              {error}
            </div>
          )}

          {stage === "lead" && (
            <div className="space-y-3">
              <div className="text-[13px] text-muted-foreground">
                Сделка создана. Следующий шаг — отправить клиенту коммерческое предложение.
              </div>
              <button onClick={sendKp} disabled={busy}
                className="w-full px-4 py-3 bg-primary text-white rounded-lg text-[14px] font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
                <Icon name="Send" size={15} />
                {busy ? "..." : "Отправить КП"}
              </button>
            </div>
          )}

          {stage === "kp" && (
            <div className="space-y-3">
              {!deal.kp_slot_id && !pickSlot && (
                <>
                  <div className="text-[13px] text-muted-foreground">
                    Выберите слот производства. Это плановая дата старта строительства.
                  </div>
                  <button onClick={() => setPickSlot(true)} disabled={busy}
                    className="w-full px-4 py-3 bg-primary text-white rounded-lg text-[14px] font-medium hover:bg-primary/90 flex items-center justify-center gap-2">
                    <Icon name="CalendarPlus" size={15} />
                    Выбрать слот
                  </button>
                </>
              )}

              {pickSlot && (
                <div className="space-y-2">
                  <div className="text-[12px] font-medium text-muted-foreground">Доступные слоты:</div>
                  <div className="grid grid-cols-2 gap-2 max-h-[260px] overflow-y-auto">
                    {slots.filter(s => s.available).slice(0, 30).map(s => (
                      <button key={s.id}
                        onClick={() => setSlotId(s.id)}
                        type="button"
                        className={`text-left px-3 py-2 border rounded-lg text-[12px] transition-colors ${
                          slotId === s.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                        }`}>
                        <div className="font-semibold">
                          {s.start_date ? new Date(s.start_date).toLocaleDateString("ru") : `${s.month}/${s.year}`}
                        </div>
                        <div className="text-hint text-[11px]">Свободно</div>
                      </button>
                    ))}
                  </div>
                  <button onClick={saveSlot} disabled={busy || !slotId}
                    className="w-full px-4 py-2.5 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 disabled:opacity-50">
                    {busy ? "..." : "Сохранить слот"}
                  </button>
                </div>
              )}

              {deal.kp_slot_id && !pickSlot && (
                <>
                  <div className="px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-[12px] text-emerald-700">
                    <Icon name="CalendarCheck" size={13} className="inline mr-1" />
                    Слот выбран: {deal.kp_slot_start_date
                      ? new Date(deal.kp_slot_start_date).toLocaleDateString("ru")
                      : `${deal.kp_slot_month}/${deal.kp_slot_year}`}
                  </div>

                  {!deal.contract_signed && (
                    <button onClick={confirmContract} disabled={busy}
                      className="w-full px-4 py-3 bg-primary text-white rounded-lg text-[14px] font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
                      <Icon name="FileSignature" size={15} />
                      {busy ? "..." : "Договор подписан"}
                    </button>
                  )}

                  {deal.contract_signed && !deal.payment_confirmed && (
                    <button onClick={confirmPayment} disabled={busy}
                      className="w-full px-4 py-3 bg-emerald-600 text-white rounded-lg text-[14px] font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2">
                      <Icon name="Wallet" size={15} />
                      {busy ? "..." : "Подтвердить оплату"}
                    </button>
                  )}

                  {deal.contract_signed && deal.payment_confirmed && (
                    <button onClick={toPlanning} disabled={busy}
                      className="w-full px-4 py-3 bg-emerald-600 text-white rounded-lg text-[14px] font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2">
                      <Icon name="ArrowRight" size={15} />
                      {busy ? "..." : "В планирование"}
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {stage === "contract" && (
            <div className="space-y-3">
              <div className="text-[13px] text-muted-foreground">
                Договор подписан. Запустите проект в планирование.
              </div>
              <button onClick={toPlanning} disabled={busy}
                className="w-full px-4 py-3 bg-emerald-600 text-white rounded-lg text-[14px] font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2">
                <Icon name="CalendarRange" size={15} />
                {busy ? "..." : "В планирование"}
              </button>
            </div>
          )}

          {stage === "planning" && (
            <div className="space-y-3">
              <div className="text-[13px] text-muted-foreground">
                Проект в планировании. Когда дом сдан и расчёты с клиентом завершены — закрывайте сделку.
                В этот момент будет начислена ваша комиссия по текущей квалификации.
              </div>
              <button onClick={closeDeal} disabled={busy}
                className="w-full px-4 py-3 bg-emerald-600 text-white rounded-lg text-[14px] font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2">
                <Icon name="CheckCircle2" size={15} />
                {busy ? "..." : "Закрыть сделку"}
              </button>
            </div>
          )}

          {stage === "closed" && (
            <div className="space-y-2">
              <div className="px-4 py-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-[13px]">
                <Icon name="Trophy" size={14} className="inline mr-1.5" />
                Сделка закрыта. Комиссия зафиксирована: {deal.commission_rate ?? "—"}%
                {deal.commission_amount != null && (
                  <span className="font-bold"> · ₽ {Math.round(deal.commission_amount).toLocaleString("ru")}</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
