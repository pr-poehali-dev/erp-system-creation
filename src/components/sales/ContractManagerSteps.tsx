import { Deal, SlotItem, ContractDocsPackage } from "@/lib/api";
import { StepDownload, StepUpload } from "./ContractStepsDownloadUpload";
import { StepPayment } from "./ContractStepsReviewPayment";
import ContractStepData from "./ContractStepData";
import ContractStepSlot from "./ContractStepSlot";

export type Step = "slot" | "download" | "upload" | "payment" | "contract_data";

export const MANAGER_STEPS = [
  { key: "slot",     num: 0, label: "Производство" },
  { key: "download", num: 1, label: "Скачать пакет" },
  { key: "upload",   num: 2, label: "Документы" },
  { key: "payment",  num: 3, label: "Оплата" },
];

export function stepFromStatus(status: string, hasSlot: boolean): Step {
  if (!hasSlot) return "slot";
  if (status === "docs_review") return "upload";
  if (["docs_approved","payment_pending","payment_confirmed"].includes(status)) return "payment";
  return "download";
}

interface Props {
  step: Step;
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
  docPackage: ContractDocsPackage | null;
  docsLoading: boolean;
  contractStatus: string;
  requiredDone: boolean;
  submitting: boolean;
  doneSteps: Record<Step, boolean>;
  onStep: (s: Step) => void;
  onSlotChange: (id: string) => void;
  onSignedDateChange: (v: string) => void;
  onAddressChange: (v: string) => void;
  onBudgetChange: (v: string) => void;
  onClose: () => void;
  onReloadDocs: () => void;
  onSubmitReview: () => void;
  onConfirmPayment: () => void;
  onSubmitContract: (e: React.FormEvent) => void;
}

export default function ContractManagerSteps({
  step, deal, today, isSerial, cfgDur, saving,
  slots, sloading, slotId, address, budget, signedDate, error,
  minSlotDate, selectedSlot, docPackage, docsLoading,
  contractStatus, requiredDone, submitting, doneSteps,
  onStep, onSlotChange, onSignedDateChange, onAddressChange, onBudgetChange,
  onClose, onReloadDocs, onSubmitReview, onConfirmPayment, onSubmitContract,
}: Props) {
  return (
    <>
      {/* Шаг-индикатор */}
      <div className="flex border-b border-border overflow-x-auto">
        {MANAGER_STEPS.map(s => {
          const isDone   = doneSteps[s.key as Step];
          const isActive = step === s.key;
          return (
            <div key={s.key} className={`flex-1 min-w-[100px] flex flex-col items-center gap-1 px-2 py-3 text-center border-b-2 transition-colors ${
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

      {/* ШАГ 0: Производственный слот */}
      {step === "slot" && (
        <ContractStepSlot
          slots={slots} sloading={sloading} slotId={slotId}
          signedDate={signedDate} cfgDur={cfgDur} minSlotDate={minSlotDate}
          selectedSlot={selectedSlot} isSerial={isSerial}
          readOnly={!!deal.slot_id}
          onSlotChange={onSlotChange}
          onSignedDateChange={onSignedDateChange}
          onClose={onClose}
          onNext={() => onStep("download")}
        />
      )}

      {/* ШАГ 1: Скачать документы */}
      {step === "download" && (
        <StepDownload docsLoading={docsLoading} docPackage={docPackage}
          onClose={onClose} onNext={() => onStep("upload")} />
      )}

      {/* ШАГ 2: Загрузить подписанные */}
      {step === "upload" && (
        <StepUpload docsLoading={docsLoading} docPackage={docPackage}
          contractStatus={contractStatus} requiredDone={requiredDone}
          submitting={submitting} dealId={deal.id} onReload={onReloadDocs}
          onBack={() => onStep("download")} onNext={() => onStep("payment")}
          onSubmitReview={onSubmitReview} />
      )}

      {/* ШАГ 3: Ожидание оплаты */}
      {step === "payment" && (
        <StepPayment contractStatus={contractStatus} isDirector={false}
          submitting={submitting} onConfirmPayment={onConfirmPayment}
          onBack={() => onStep("upload")} onNext={() => onStep("contract_data")} />
      )}

      {/* ШАГ 4: Зафиксировать договор */}
      {step === "contract_data" && (
        <ContractStepData
          deal={deal} today={today} isSerial={isSerial} cfgDur={cfgDur} saving={saving}
          slots={slots} sloading={sloading} slotId={slotId} address={address}
          budget={budget} signedDate={signedDate} error={error} minSlotDate={minSlotDate}
          selectedSlot={selectedSlot}
          onSlotChange={onSlotChange} onAddressChange={onAddressChange}
          onBudgetChange={onBudgetChange} onSignedDateChange={onSignedDateChange}
          onBack={() => onStep("payment")} onSubmit={onSubmitContract}
        />
      )}
    </>
  );
}
