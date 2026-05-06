import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { Deal, SlotItem, ContractDocsPackage, api } from "@/lib/api";
import { Role } from "@/App";
import ContractStepData from "./ContractStepData";
import ContractDirectorPanel from "./ContractDirectorPanel";
import ContractManagerSteps, { Step, stepFromStatus } from "./ContractManagerSteps";

const MIN_BUFFER = 15;

interface Props {
  deal: Deal;
  role: Role;
  saving: boolean;
  onClose: () => void;
  onSubmit: (body: object) => void;
}

export default function ContractModal({ deal, role, saving, onClose, onSubmit }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [step, setStep]               = useState<Step>("slot");
  const [docPackage, setDocPackage]   = useState<ContractDocsPackage | null>(null);
  const [docsLoading, setDocsLoading] = useState(true);
  const [submitting, setSubmitting]   = useState(false);
  const [rejReason, setRejReason]     = useState("");
  const [showReject, setShowReject]   = useState(false);

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
    });
  };

  useEffect(() => {
    api.contract_docs.get(deal.id).then(pkg => {
      setDocPackage(pkg);
      if (!isDirector) setStep(stepFromStatus(pkg.contract_status, !!deal.slot_id));
    }).finally(() => setDocsLoading(false));
  }, [deal.id]);

  useEffect(() => {
    if (!isSerial) return;
    if (step === "slot" || step === "contract_data") {
      setSloading(true);
      api.slots.free(signedDate).then(setSlots).finally(() => setSloading(false));
    }
  }, [step, isSerial, signedDate]);

  useEffect(() => {
    if (deal.slot_id && !slotId) setSlotId(String(deal.slot_id));
  }, [deal.slot_id]);

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
    slot:          !!deal.slot_id,
    download:      contractStatus !== "none",
    upload:        ["docs_approved","payment_pending","payment_confirmed"].includes(contractStatus),
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

        {/* ДИРЕКТОР — отдельный интерфейс без шагов */}
        {isDirector && (
          step !== "contract_data" ? (
            <ContractDirectorPanel
              deal={deal}
              docPackage={docPackage}
              docsLoading={docsLoading}
              submitting={submitting}
              showReject={showReject}
              rejReason={rejReason}
              onReload={reloadDocs}
              onApprove={handleApprove}
              onToggleReject={() => setShowReject(v => !v)}
              onReject={handleReject}
              onRejReasonChange={setRejReason}
              onConfirmPayment={handleConfirmPayment}
              onNext={() => setStep("contract_data")}
            />
          ) : (
            <ContractStepData
              deal={deal} today={today} isSerial={isSerial} cfgDur={cfgDur} saving={saving}
              slots={slots} sloading={sloading} slotId={slotId} address={address}
              budget={budget} signedDate={signedDate} error={error} minSlotDate={minSlotDate}
              selectedSlot={selectedSlot}
              onSlotChange={setSlotId} onAddressChange={setAddress} onBudgetChange={setBudget}
              onSignedDateChange={setSignedDate} onBack={() => setStep("payment")} onSubmit={handleSubmitContract}
            />
          )
        )}

        {/* МЕНЕДЖЕР — шаги */}
        {!isDirector && (
          <ContractManagerSteps
            step={step}
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
            docPackage={docPackage}
            docsLoading={docsLoading}
            contractStatus={contractStatus}
            requiredDone={requiredDone}
            submitting={submitting}
            doneSteps={doneSteps}
            onStep={setStep}
            onSlotChange={setSlotId}
            onSignedDateChange={setSignedDate}
            onAddressChange={setAddress}
            onBudgetChange={setBudget}
            onClose={onClose}
            onReloadDocs={reloadDocs}
            onSubmitReview={handleSubmitReview}
            onConfirmPayment={handleConfirmPayment}
            onSubmitContract={handleSubmitContract}
          />
        )}
      </div>
    </div>
  );
}
