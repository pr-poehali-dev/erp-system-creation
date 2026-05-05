import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { Deal, SlotItem, ContractDocsPackage, api } from "@/lib/api";
import { Role } from "@/App";
import { StepDownload, StepUpload } from "./ContractStepsDownloadUpload";
import { StepReview, StepPayment } from "./ContractStepsReviewPayment";
import ContractStepData from "./ContractStepData";

const MIN_BUFFER = 15;

const STEPS = [
  { key: "download", num: 1, label: "Скачать пакет" },
  { key: "upload",   num: 2, label: "Загрузить сканы" },
  { key: "review",   num: 3, label: "Проверка директором" },
  { key: "payment",  num: 4, label: "Ожидание оплаты" },
];

type Step = "download" | "upload" | "review" | "payment" | "contract_data";

function stepFromStatus(status: string): Step {
  if (status === "docs_review")       return "review";
  if (status === "docs_approved" || status === "payment_pending") return "payment";
  if (status === "payment_confirmed") return "payment";
  return "download";
}

interface Props {
  deal: Deal;
  role: Role;
  saving: boolean;
  onClose: () => void;
  onSubmit: (body: object) => void;
}

export default function ContractModal({ deal, role, saving, onClose, onSubmit }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [step, setStep]               = useState<Step>("download");
  const [docPackage, setDocPackage]   = useState<ContractDocsPackage | null>(null);
  const [docsLoading, setDocsLoading] = useState(true);
  const [submitting, setSubmitting]   = useState(false);
  const [rejReason, setRejReason]     = useState("");
  const [showReject, setShowReject]   = useState(false);

  // Данные договора (финальный шаг)
  const [slots, setSlots]           = useState<SlotItem[]>([]);
  const [sloading, setSloading]     = useState(false);
  const [slotId, setSlotId]         = useState("");
  const [address, setAddress]       = useState(deal.address || "");
  const [budget, setBudget]         = useState(String(deal.budget || ""));
  const [signedDate, setSignedDate] = useState(today);
  const [error, setError]           = useState("");

  const isSerial   = deal.project_type === "serial" || !deal.project_type;
  const cfgDur     = deal.configuration_duration || 115;
  const isDirector = role === "director";

  const reloadDocs = () => {
    api.contract_docs.get(deal.id).then(pkg => {
      setDocPackage(pkg);
      const s = stepFromStatus(pkg.contract_status);
      if (s !== "download") setStep(s);
    });
  };

  useEffect(() => {
    api.contract_docs.get(deal.id).then(pkg => {
      setDocPackage(pkg);
      setStep(stepFromStatus(pkg.contract_status));
    }).finally(() => setDocsLoading(false));
  }, [deal.id]);

  useEffect(() => {
    if (step !== "contract_data" || !isSerial) return;
    setSloading(true); setSlotId("");
    api.slots.free(signedDate).then(setSlots).finally(() => setSloading(false));
  }, [step, isSerial, signedDate]);

  const minSlotDate = (() => {
    const d = new Date(signedDate); d.setDate(d.getDate() + MIN_BUFFER);
    return d.toISOString().slice(0, 10);
  })();
  const selectedSlot = slots.find(s => String(s.id) === slotId);

  const requiredDone   = docPackage?.all_required_done ?? false;
  const contractStatus = docPackage?.contract_status ?? "none";

  const handleSubmitReview = async () => {
    setSubmitting(true);
    try { await api.contract_docs.submitReview(deal.id); reloadDocs(); }
    finally { setSubmitting(false); }
  };

  const handleApprove = async () => {
    setSubmitting(true);
    try { await api.contract_docs.approve(deal.id, true); reloadDocs(); }
    finally { setSubmitting(false); }
  };

  const handleReject = async () => {
    if (!rejReason.trim()) return;
    setSubmitting(true);
    try {
      await api.contract_docs.approve(deal.id, false, rejReason);
      setShowReject(false); setRejReason(""); reloadDocs();
    } finally { setSubmitting(false); }
  };

  const handleConfirmPayment = async () => {
    setSubmitting(true);
    try { await api.contract_docs.confirmPayment(deal.id); reloadDocs(); }
    finally { setSubmitting(false); }
  };

  const handleSubmitContract = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSerial && !slotId) { setError("Выберите производственный слот"); return; }
    if (!budget) { setError("Укажите сумму договора"); return; }
    if (selectedSlot && (new Date(selectedSlot.start_date).getTime() - new Date(signedDate).getTime()) / 86400000 < MIN_BUFFER) {
      setError(`Слот — минимум через ${MIN_BUFFER} дней после подписания`); return;
    }
    setError("");
    onSubmit({ slot_id: slotId ? Number(slotId) : null, address, budget: Number(budget), signed_date: signedDate });
  };

  const doneSteps: Record<Step, boolean> = {
    download:      contractStatus !== "none",
    upload:        ["docs_review","docs_approved","payment_pending","payment_confirmed"].includes(contractStatus),
    review:        ["docs_approved","payment_pending","payment_confirmed"].includes(contractStatus),
    payment:       contractStatus === "payment_confirmed",
    contract_data: false,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl border border-border shadow-xl w-full max-w-xl max-h-[94vh] overflow-y-auto animate-fade-in">

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

        {/* Шаг-индикатор */}
        <div className="flex border-b border-border overflow-x-auto">
          {STEPS.map((s, i) => {
            const isDone   = doneSteps[s.key as Step];
            const isActive = step === s.key;
            return (
              <div key={s.key} className={`flex-1 min-w-[110px] flex flex-col items-center gap-1 px-2 py-3 text-center transition-colors border-b-2 ${
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

        {/* Шаги */}
        {step === "download" && (
          <StepDownload
            docsLoading={docsLoading}
            docPackage={docPackage}
            onClose={onClose}
            onNext={() => setStep("upload")}
          />
        )}

        {step === "upload" && (
          <StepUpload
            docsLoading={docsLoading}
            docPackage={docPackage}
            contractStatus={contractStatus}
            requiredDone={requiredDone}
            submitting={submitting}
            dealId={deal.id}
            onReload={reloadDocs}
            onBack={() => setStep("download")}
            onSubmitReview={handleSubmitReview}
          />
        )}

        {step === "review" && (
          <StepReview
            contractStatus={contractStatus}
            isDirector={isDirector}
            submitting={submitting}
            showReject={showReject}
            rejReason={rejReason}
            onApprove={handleApprove}
            onToggleReject={() => setShowReject(v => !v)}
            onReject={handleReject}
            onRejReasonChange={setRejReason}
            onBack={() => setStep("upload")}
            onNext={() => setStep("payment")}
          />
        )}

        {step === "payment" && (
          <StepPayment
            contractStatus={contractStatus}
            isDirector={isDirector}
            submitting={submitting}
            onConfirmPayment={handleConfirmPayment}
            onBack={() => setStep("review")}
            onNext={() => setStep("contract_data")}
          />
        )}

        {step === "contract_data" && (
          <ContractStepData
            deal={deal}
            today={today}
            isSerial={isSerial}
            cfgDur={cfgDur}
            saving={saving}
            slots={slots}
            sloading={sloading}
            slotId={slotId}
            address={address}
            budget={budget}
            signedDate={signedDate}
            error={error}
            minSlotDate={minSlotDate}
            selectedSlot={selectedSlot}
            onSlotChange={setSlotId}
            onAddressChange={setAddress}
            onBudgetChange={setBudget}
            onSignedDateChange={setSignedDate}
            onBack={() => setStep("payment")}
            onSubmit={handleSubmitContract}
          />
        )}
      </div>
    </div>
  );
}
