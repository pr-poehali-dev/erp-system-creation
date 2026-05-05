import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import { Deal, SlotItem, ContractDocsPackage, ContractDocItem, api } from "@/lib/api";
import { Role } from "@/App";
import { StepDownload, StepUpload } from "./ContractStepsDownloadUpload";
import { StepPayment } from "./ContractStepsReviewPayment";
import ContractStepData from "./ContractStepData";

const MIN_BUFFER = 15;

// ─── Утилита ─────────────────────────────────────────────────────────────────
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Строка документа для директора ──────────────────────────────────────────
function DirectorDocRow({ item, dealId, onUploaded }: {
  item: ContractDocItem; dealId: number; onUploaded: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const b64 = await fileToBase64(file);
      await api.contract_docs.uploadSigned(dealId, item.template_id, b64, file.name);
      onUploaded();
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const hasSigned = !!item.signed_file_url;

  return (
    <div className={`rounded-xl border p-3 transition-all ${
      hasSigned ? "border-emerald-200 bg-emerald-50" : "border-blue-200 bg-blue-50/50"
    }`}>
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
          hasSigned ? "bg-emerald-500" : "bg-blue-400"
        }`}>
          {hasSigned
            ? <Icon name="CheckCheck" size={14} className="text-white" />
            : uploading
              ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Icon name="Pen" size={13} className="text-white" />
          }
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold">{item.template_name}</div>
          {hasSigned
            ? <div className="text-[11px] text-emerald-700 flex items-center gap-1 mt-0.5"><Icon name="Paperclip" size={9} />{item.signed_file_name || "Подписан"}</div>
            : <div className="text-[11px] text-blue-700 mt-0.5">Ожидает вашей подписи</div>
          }
        </div>

        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          {/* Документ от менеджера */}
          {item.file_url && (
            <a href={item.file_url} target="_blank" rel="noreferrer"
              className="flex items-center gap-1 px-2.5 py-1.5 border border-blue-200 bg-white rounded-lg text-[11px] text-blue-700 hover:bg-blue-50 transition-colors font-medium">
              <Icon name="Download" size={11} />От менеджера
            </a>
          )}
          {/* Уже подписанный */}
          {hasSigned && (
            <a href={item.signed_file_url!} target="_blank" rel="noreferrer"
              className="flex items-center gap-1 px-2.5 py-1.5 border border-emerald-200 bg-emerald-50 rounded-lg text-[11px] text-emerald-700 hover:bg-emerald-100 transition-colors">
              <Icon name="FileCheck" size={11} />Подписанный
            </a>
          )}
          {/* Кнопка загрузки */}
          <button type="button" disabled={uploading} onClick={() => inputRef.current?.click()}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
              hasSigned
                ? "border border-border text-muted-foreground hover:bg-secondary"
                : "bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            }`}>
            {uploading ? <><div className="w-3 h-3 border-2 border-white/60 border-t-white rounded-full animate-spin" />Загрузка...</>
              : hasSigned ? <><Icon name="RefreshCw" size={10} />Заменить</>
              : <><Icon name="Upload" size={11} />Загрузить подписанный</>}
          </button>
          <input ref={inputRef} type="file" className="hidden"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={handleFile} />
        </div>
      </div>
    </div>
  );
}

// ─── Панель директора (показывается вместо шагов менеджера) ──────────────────
function DirectorPanel({ deal, docPackage, submitting, showReject, rejReason, onReload,
  onApprove, onToggleReject, onReject, onRejReasonChange, onConfirmPayment, onNext
}: {
  deal: Deal;
  docPackage: ContractDocsPackage | null;
  submitting: boolean;
  showReject: boolean;
  rejReason: string;
  onReload: () => void;
  onApprove: () => void;
  onToggleReject: () => void;
  onReject: () => void;
  onRejReasonChange: (v: string) => void;
  onConfirmPayment: () => void;
  onNext: () => void;
}) {
  const cs       = docPackage?.contract_status ?? "none";
  const items    = docPackage?.items || [];
  const allSigned = items.length > 0 && items.every(it => it.signed_file_url);

  const STATUS_INFO: Record<string, { label: string; cls: string; icon: string }> = {
    none:              { label: "Менеджер ещё не отправил документы",    cls: "bg-secondary border-border text-muted-foreground", icon: "Clock" },
    docs_uploaded:     { label: "Менеджер загрузил документы",           cls: "bg-blue-50 border-blue-200 text-blue-700",        icon: "FileText" },
    docs_review:       { label: "Документы на вашей проверке",           cls: "bg-amber-50 border-amber-200 text-amber-800",     icon: "FileSearch" },
    docs_approved:     { label: "Вы подтвердили — ожидание оплаты",      cls: "bg-emerald-50 border-emerald-200 text-emerald-700", icon: "CheckCircle" },
    payment_pending:   { label: "Ожидание оплаты от заказчика",          cls: "bg-amber-50 border-amber-200 text-amber-800",     icon: "Clock" },
    payment_confirmed: { label: "Оплата подтверждена — проект запущен",  cls: "bg-emerald-50 border-emerald-200 text-emerald-700", icon: "BadgeCheck" },
  };
  const statusInfo = STATUS_INFO[cs] || STATUS_INFO["none"];

  return (
    <div className="px-5 py-5 space-y-5">
      {/* Статус */}
      <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border ${statusInfo.cls}`}>
        <Icon name={statusInfo.icon as Parameters<typeof Icon>[0]["name"]} size={16} className="shrink-0" />
        <span className="text-[13px] font-medium">{statusInfo.label}</span>
      </div>

      {/* Регламент */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-2">
        <Icon name="Clock" size={13} className="text-amber-600 shrink-0" />
        <span className="text-[12px] text-amber-800"><strong>Регламент:</strong> проверка документов — 2 рабочих дня</span>
      </div>

      {/* Документы для подписания */}
      {["none","docs_uploaded","docs_review"].includes(cs) && (
        <div className="space-y-2">
          <div className="text-[13px] font-semibold">
            {items.length > 0 ? "Документы для подписания:" : "Документы менеджером ещё не загружены"}
          </div>
          {items.map(item => (
            <DirectorDocRow key={item.template_id} item={item} dealId={deal.id} onUploaded={onReload} />
          ))}

          {/* Кнопки одобрить/отклонить */}
          {cs === "docs_review" && items.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="text-[12px] text-muted-foreground">
                {allSigned
                  ? "✓ Все документы подписаны — отправьте менеджеру:"
                  : "Загрузите подписанные варианты всех документов, затем:"}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={onApprove} disabled={submitting || !allSigned}
                  className="flex-1 px-4 py-2.5 bg-emerald-500 text-white rounded-lg text-[13px] font-semibold hover:bg-emerald-600 disabled:opacity-50 transition-colors">
                  {submitting ? "..." : "✓ Подтвердить и отправить менеджеру"}
                </button>
                <button type="button" onClick={onToggleReject}
                  className="px-3 py-2.5 border border-red-200 text-red-600 rounded-lg text-[12px] hover:bg-red-50 transition-colors">
                  Отклонить
                </button>
              </div>
              {!allSigned && (
                <div className="text-[11px] text-amber-600 flex items-center gap-1">
                  <Icon name="AlertTriangle" size={11} />
                  Сначала загрузите подписанные варианты всех документов
                </div>
              )}
              {showReject && (
                <div className="space-y-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                  <div className="text-[12px] font-medium text-red-700">Причина отклонения:</div>
                  <textarea value={rejReason} onChange={e => onRejReasonChange(e.target.value)} rows={2}
                    placeholder="Опишите что нужно исправить..."
                    className="w-full border border-red-200 rounded-lg px-3 py-2 text-[12px] outline-none focus:ring-1 focus:ring-red-400 resize-none bg-white" />
                  <div className="flex gap-2">
                    <button onClick={onToggleReject}
                      className="px-3 py-1.5 border border-border rounded-lg text-[12px] hover:bg-secondary transition-colors">
                      Отмена
                    </button>
                    <button onClick={onReject} disabled={!rejReason.trim() || submitting}
                      className="flex-1 px-3 py-1.5 bg-red-500 text-white rounded-lg text-[12px] font-medium disabled:opacity-40">
                      {submitting ? "..." : "Отклонить и вернуть менеджеру"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Подтверждение оплаты */}
      {cs === "payment_pending" && (
        <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 space-y-3">
          <div className="text-[13px] font-semibold text-amber-900">Ожидание оплаты от заказчика</div>
          <div className="text-[12px] text-amber-800">
            После получения аванса нажмите кнопку ниже — менеджер получит уведомление и сможет создать проект.
          </div>
          <button type="button" onClick={onConfirmPayment} disabled={submitting}
            className="w-full px-4 py-2.5 bg-emerald-500 text-white rounded-lg text-[13px] font-semibold hover:bg-emerald-600 disabled:opacity-50 flex items-center justify-center gap-2">
            <Icon name="BadgeCheck" size={16} />
            {submitting ? "..." : "Оплата прошла — подтвердить"}
          </button>
        </div>
      )}

      {/* Оплата подтверждена */}
      {cs === "payment_confirmed" && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Icon name="CheckCircle" size={18} className="text-emerald-600" />
            <span className="text-[14px] font-bold text-emerald-900">Оплата подтверждена!</span>
          </div>
          <div className="text-[12px] text-emerald-700">
            Менеджер получил уведомление и подаёт заявку на создание проекта.
          </div>
          <button type="button" onClick={onNext}
            className="w-full mt-1 px-4 py-2.5 bg-violet-600 text-white rounded-lg text-[13px] font-semibold hover:bg-violet-700 transition-colors">
            Зафиксировать договор и создать проект →
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Шаги менеджера ───────────────────────────────────────────────────────────
type Step = "download" | "upload" | "payment" | "contract_data";

// Определяет с какого шага открыть модалку при первом открытии
function stepFromStatus(status: string): Step {
  // Документы отправлены на проверку / менеджер ждёт директора — остаёмся на загрузке
  if (status === "docs_review") return "upload";
  // Директор одобрил / ждём оплаты / оплата подтверждена — переходим к шагу оплаты
  if (["docs_approved","payment_pending","payment_confirmed"].includes(status)) return "payment";
  // Документы ещё не загружены / нет статуса
  return "download";
}

const MANAGER_STEPS = [
  { key: "download", num: 1, label: "Скачать пакет" },
  { key: "upload",   num: 2, label: "Документы" },
  { key: "payment",  num: 3, label: "Оплата" },
];

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

  // reloadDocs — только обновляет данные, НЕ сбрасывает шаг
  const reloadDocs = () => {
    api.contract_docs.get(deal.id).then(pkg => {
      setDocPackage(pkg);
    });
  };

  // Первоначальная загрузка — определяем стартовый шаг
  useEffect(() => {
    api.contract_docs.get(deal.id).then(pkg => {
      setDocPackage(pkg);
      if (!isDirector) setStep(stepFromStatus(pkg.contract_status));
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

  // Шаг-индикатор для менеджера
  const doneSteps: Record<Step, boolean> = {
    download:      contractStatus !== "none",
    // upload завершён когда директор одобрил (docs_approved+)
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
            <DirectorPanel
              deal={deal}
              docPackage={docPackage}
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

            {step === "download" && (
              <StepDownload docsLoading={docsLoading} docPackage={docPackage}
                onClose={onClose} onNext={() => setStep("upload")} />
            )}

            {step === "upload" && (
              <StepUpload docsLoading={docsLoading} docPackage={docPackage}
                contractStatus={contractStatus} requiredDone={requiredDone}
                submitting={submitting} dealId={deal.id} onReload={reloadDocs}
                onBack={() => setStep("download")} onNext={() => setStep("payment")}
                onSubmitReview={handleSubmitReview} />
            )}

            {step === "payment" && (
              <StepPayment contractStatus={contractStatus} isDirector={false}
                submitting={submitting} onConfirmPayment={handleConfirmPayment}
                onBack={() => setStep("upload")} onNext={() => setStep("contract_data")} />
            )}

            {step === "contract_data" && (
              <ContractStepData
                deal={deal} today={today} isSerial={isSerial} cfgDur={cfgDur} saving={saving}
                slots={slots} sloading={sloading} slotId={slotId} address={address}
                budget={budget} signedDate={signedDate} error={error} minSlotDate={minSlotDate}
                selectedSlot={selectedSlot}
                onSlotChange={setSlotId} onAddressChange={setAddress} onBudgetChange={setBudget}
                onSignedDateChange={setSignedDate} onBack={() => setStep("payment")} onSubmit={handleSubmitContract}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}