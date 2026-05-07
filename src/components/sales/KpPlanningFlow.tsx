import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { Deal, SlotItem, ContractDocsPackage, api } from "@/lib/api";
import { Role } from "@/App";
import KpFlowSlotStep from "./KpFlowSlotStep";
import KpFlowManagerDocs from "./KpFlowManagerDocs";
import KpFlowDirectorReview from "./KpFlowDirectorReview";
import PaymentScheduleEditor from "./PaymentScheduleEditor";

export type Step = "slot" | "download" | "upload" | "review" | "payment" | "planning" | "schedule";

export function resolveStep(deal: Deal, cs: string, role: Role): Step {
  if (!deal.kp_slot_id) return "slot";
  if (cs === "payment_confirmed") return role === "director" ? "payment" : "planning";
  if (cs === "payment_pending")   return "payment";
  if (cs === "docs_approved")     return role === "director" ? "review" : "upload";
  if (cs === "docs_review")       return role === "director" ? "review" : "upload";
  if (cs === "docs_uploaded")     return "upload";
  return "download";
}

const STEP_LABELS: Record<Step, string> = {
  slot: "Слот", download: "Скачать", upload: "Загрузить",
  review: "Проверка", payment: "Оплата", planning: "Запуск", schedule: "График",
};
const ALL_STEPS: Step[] = ["slot","download","upload","review","payment","planning"];
const EXTRA_TABS: Step[] = ["schedule"]; // всегда видимые боковые вкладки

interface Props {
  deal: Deal;
  role: Role;
  cfgDur: number;
  onDone: () => void;
  onClose: () => void;
}

export default function KpPlanningFlow({ deal, role, cfgDur, onDone, onClose }: Props) {
  const isDirector = role === "director";
  const isManager  = !isDirector;

  const [slots, setSlots]             = useState<SlotItem[]>([]);
  const [sloading, setSloading]       = useState(false);
  const [slotId, setSlotId]           = useState(deal.kp_slot_id ? String(deal.kp_slot_id) : "");
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState("");

  const [docPackage, setDocPackage]   = useState<ContractDocsPackage | null>(null);
  const [docsLoading, setDocsLoading] = useState(true);
  const [submitting, setSubmitting]   = useState(false);
  const [showReject, setShowReject]   = useState(false);
  const [rejReason, setRejReason]     = useState("");

  const cs   = docPackage?.contract_status ?? deal.contract_status ?? "none";
  const [step, setStep] = useState<Step>(() => resolveStep(deal, deal.contract_status ?? "none", role));

  const kpSlotDate = deal.kp_slot_start_date;

  const STEP_ORDER: Step[] = ["slot","download","upload","review","payment","planning"];
  const reloadDocs = () => {
    api.contract_docs.get(deal.id).then(pkg => {
      setDocPackage(pkg);
      const next = resolveStep(deal, pkg.contract_status, role);
      setStep(prev => {
        const prevIdx = STEP_ORDER.indexOf(prev);
        const nextIdx = STEP_ORDER.indexOf(next);
        return nextIdx >= prevIdx ? next : prev;
      });
    });
  };

  useEffect(() => {
    api.contract_docs.get(deal.id).then(pkg => {
      setDocPackage(pkg);
      setStep(resolveStep(deal, pkg.contract_status, role));
    }).finally(() => setDocsLoading(false));
  }, [deal.id]);

  useEffect(() => {
    if (deal.kp_slot_id) return;
    setSloading(true);
    api.slots.free().then(setSlots).finally(() => setSloading(false));
  }, [deal.kp_slot_id]);

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

  const handleSubmitReview = async () => {
    setSubmitting(true);
    try { await api.contract_docs.submitReview(deal.id); reloadDocs(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Ошибка"); }
    finally { setSubmitting(false); }
  };

  const handleApprove = async () => {
    setSubmitting(true);
    try { await api.contract_docs.approve(deal.id); reloadDocs(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Ошибка"); }
    finally { setSubmitting(false); }
  };

  const handleReject = async () => {
    if (!rejReason.trim()) return;
    setSubmitting(true);
    try { await api.contract_docs.reject(deal.id, rejReason); setShowReject(false); reloadDocs(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Ошибка"); }
    finally { setSubmitting(false); }
  };

  const handleConfirmPayment = async () => {
    setSubmitting(true);
    try { await api.contract_docs.confirmPayment(deal.id); reloadDocs(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Ошибка"); }
    finally { setSubmitting(false); }
  };

  const stepDone = (s: Step): boolean => {
    if (s === "slot")     return !!deal.kp_slot_id;
    if (s === "download") return !!deal.kp_slot_id && cs !== "none";
    if (s === "upload")   return ["docs_review","docs_approved","payment_pending","payment_confirmed"].includes(cs);
    if (s === "review")   return ["docs_approved","payment_pending","payment_confirmed"].includes(cs);
    if (s === "payment")  return cs === "payment_confirmed";
    if (s === "planning") return deal.stage === "planning";
    return false;
  };

  const items        = docPackage?.items || [];
  const requiredDone = items.filter(it => it.is_required).every(it => ["uploaded","approved","review"].includes(it.status));
  const allSigned    = items.length > 0 && items.every(it => it.signed_file_url);
  const isApproved   = ["docs_approved","payment_pending","payment_confirmed"].includes(cs);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl border border-border shadow-xl w-full max-w-xl max-h-[94vh] overflow-y-auto animate-fade-in">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="font-semibold text-[15px]">Подготовка к производству · {deal.code}</h2>
            <p className="text-hint text-[12px]">{deal.client_name} · {deal.serial_project_name || "Инд. проект"}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <Icon name="X" size={18} />
          </button>
        </div>

        {/* Шаг-индикатор + вкладка «График» */}
        <div className="flex border-b border-border overflow-x-auto">
          {ALL_STEPS.map((s, i) => {
            const isDone   = stepDone(s);
            const isActive = step === s;
            return (
              <div key={s} onClick={() => setStep(s)} className={`flex-1 min-w-[72px] flex flex-col items-center gap-1 px-1 py-2.5 text-center border-b-2 transition-colors cursor-pointer ${
                isActive ? "border-primary text-primary" : isDone ? "border-emerald-400 text-emerald-600" : "border-transparent text-muted-foreground"
              }`}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  isDone ? "bg-emerald-500 text-white" : isActive ? "bg-primary text-white" : "bg-secondary text-muted-foreground"
                }`}>{isDone ? "✓" : i + 1}</span>
                <span className="text-[10px] font-medium leading-tight">{STEP_LABELS[s]}</span>
              </div>
            );
          })}
          {/* Вкладка График — отдельно */}
          {EXTRA_TABS.map(s => (
            <div key={s} onClick={() => setStep(s)} className={`flex-1 min-w-[72px] flex flex-col items-center gap-1 px-1 py-2.5 text-center border-b-2 transition-colors cursor-pointer ${
              step === s ? "border-violet-500 text-violet-600" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                step === s ? "bg-violet-500 text-white" : "bg-secondary text-muted-foreground"
              }`}>
                <Icon name="CreditCard" size={10} />
              </span>
              <span className="text-[10px] font-medium leading-tight">{STEP_LABELS[s]}</span>
            </div>
          ))}
        </div>

        {/* ── ШАГ 1: Выбор слота ── */}
        {step === "slot" && (
          <KpFlowSlotStep
            slots={slots}
            sloading={sloading}
            slotId={slotId}
            cfgDur={cfgDur}
            saving={saving}
            error={error}
            onSlotChange={setSlotId}
            onSave={handleSaveSlot}
            onClose={onClose}
          />
        )}

        {/* ── Шаги 2–4: Менеджер — документы + запуск ── */}
        {isManager && ["download","upload","planning"].includes(step) && (
          <KpFlowManagerDocs
            step={step}
            cs={cs}
            kpSlotDate={kpSlotDate}
            docPackage={docPackage}
            docsLoading={docsLoading}
            items={items}
            requiredDone={requiredDone}
            isApproved={isApproved}
            submitting={submitting}
            error={error}
            dealId={deal.id}
            onSetStep={setStep}
            onReloadDocs={reloadDocs}
            onSubmitReview={handleSubmitReview}
            onClose={onClose}
          />
        )}

        {/* ── Директор — проверка + оплата ── */}
        {isDirector && ["download","upload","review","payment"].includes(step) && (
          <KpFlowDirectorReview
            cs={cs}
            items={items}
            docsLoading={docsLoading}
            isApproved={isApproved}
            allSigned={allSigned}
            submitting={submitting}
            error={error}
            showReject={showReject}
            rejReason={rejReason}
            dealId={deal.id}
            onReloadDocs={reloadDocs}
            onApprove={handleApprove}
            onToggleReject={() => setShowReject(v => !v)}
            onReject={handleReject}
            onRejReasonChange={setRejReason}
            onConfirmPayment={handleConfirmPayment}
            onClose={onClose}
          />
        )}

        {/* ── График оплат ── */}
        {step === "schedule" && (
          <div className="px-5 py-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-[13px] font-semibold">График оплат</div>
                <div className="text-hint text-[12px] mt-0.5">
                  {deal.stage === "planning"
                    ? "Договор подписан — редактирование недоступно"
                    : "Добавьте строки до подписания договора"}
                </div>
              </div>
            </div>
            <PaymentScheduleEditor deal={deal} readonly={deal.stage === "planning" || deal.stage === "closed"} />
          </div>
        )}

      </div>
    </div>
  );
}