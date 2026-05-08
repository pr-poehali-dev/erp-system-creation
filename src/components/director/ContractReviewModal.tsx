import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import { api, ContractDocsPackage, ContractDocItem } from "@/lib/api";

// ─── Утилита base64 ───────────────────────────────────────────────────────────
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Строка одного документа: скачать + загрузить подписанный ────────────────
function DocSignRow({ item, dealId, onUploaded }: {
  item: ContractDocItem; dealId: number; onUploaded: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const hasSigned = !!item.signed_file_url;

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

  return (
    <div className={`rounded-xl border p-3 transition-all ${
      hasSigned ? "border-emerald-200 bg-emerald-50" : "border-border bg-white"
    }`}>
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
          hasSigned ? "bg-emerald-500" : "bg-secondary"
        }`}>
          {hasSigned
            ? <Icon name="CheckCheck" size={14} className="text-white" />
            : <Icon name="FileText" size={13} className="text-muted-foreground" />
          }
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-medium truncate">{item.template_name}</div>
          {item.description && <div className="text-hint text-[11px]">{item.description}</div>}
          {hasSigned && (
            <div className="text-[11px] text-emerald-600 font-medium mt-0.5 flex items-center gap-1">
              <Icon name="Check" size={10} />
              Подписанный загружен
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Скачать оригинал */}
          {item.file_url && (
            <a href={item.file_url} target="_blank" rel="noreferrer"
              className="flex items-center gap-1 px-2.5 py-1.5 border border-border text-muted-foreground rounded-lg text-[11px] hover:bg-secondary transition-colors">
              <Icon name="Download" size={11} />
              Скачать
            </a>
          )}
          {/* Загрузить подписанный */}
          <button type="button" onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
              hasSigned
                ? "border border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                : "bg-primary text-white hover:bg-primary/90"
            }`}>
            {uploading
              ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Icon name={hasSigned ? "RefreshCw" : "Upload"} size={11} />
            }
            {hasSigned ? "Заменить" : "Загрузить"}
          </button>
        </div>
      </div>
      <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
        className="hidden" onChange={handleFile} />
    </div>
  );
}

// ─── Шаги (упрощённые: только 2) ─────────────────────────────────────────────
type Step = "review" | "payment";

interface Props {
  dealId: number;
  dealCode: string;
  clientName: string;
  onClose: () => void;
  onApproved: () => void;
}

export default function ContractReviewModal({ dealId, dealCode, clientName, onClose, onApproved }: Props) {
  const [step, setStep]             = useState<Step>("review");
  const [pkg, setPkg]               = useState<ContractDocsPackage | null>(null);
  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [rejReason, setRejReason]   = useState("");

  const reload = () => {
    api.contract_docs.get(dealId).then(setPkg);
  };

  useEffect(() => {
    api.contract_docs.get(dealId)
      .then(p => {
        setPkg(p);
        const cs = p.contract_status;
        if (["docs_approved","payment_pending","payment_confirmed"].includes(cs)) {
          setStep("payment");
        }
      })
      .finally(() => setLoading(false));
  }, [dealId]);

  const items     = pkg?.items || [];
  const cs        = pkg?.contract_status ?? "none";
  const allSigned = items.length > 0 && items.every(it => it.signed_file_url);
  const isApproved = ["docs_approved","payment_pending","payment_confirmed"].includes(cs);

  const handleApprove = async () => {
    setSubmitting(true);
    try {
      await api.contract_docs.approve(dealId, true);
      reload();
      setStep("payment");
      onApproved();
    } finally { setSubmitting(false); }
  };

  const handleReject = async () => {
    if (!rejReason.trim()) return;
    setSubmitting(true);
    try {
      await api.contract_docs.approve(dealId, false, rejReason);
      setShowReject(false);
      setRejReason("");
      reload();
      onApproved();
    } finally { setSubmitting(false); }
  };

  const handleConfirmPayment = async () => {
    setSubmitting(true);
    try {
      await api.contract_docs.confirmPayment(dealId);
      reload();
      onApproved();
    } finally { setSubmitting(false); }
  };

  const STEPS: { key: Step; label: string }[] = [
    { key: "review",  label: "Проверка документов" },
    { key: "payment", label: "Оплата" },
  ];

  const doneSteps: Record<Step, boolean> = {
    review:  isApproved,
    payment: cs === "payment_confirmed",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl border border-border shadow-xl w-full max-w-xl max-h-[94vh] overflow-y-auto animate-fade-in">

        {/* Шапка */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="font-semibold text-[15px]">Согласование договора · {dealCode}</h2>
            <p className="text-hint text-[12px] mt-0.5">{clientName}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <Icon name="X" size={18} />
          </button>
        </div>

        {/* Шаг-индикатор (2 шага) */}
        <div className="flex border-b border-border">
          {STEPS.map((s, i) => {
            const isDone   = doneSteps[s.key];
            const isActive = step === s.key;
            return (
              <button key={s.key} type="button"
                onClick={() => setStep(s.key)}
                className={`flex-1 flex flex-col items-center gap-1 px-2 py-3 text-center border-b-2 transition-colors ${
                  isActive ? "border-primary text-primary" : isDone ? "border-emerald-400 text-emerald-600" : "border-transparent text-muted-foreground"
                }`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                  isDone ? "bg-emerald-500 text-white" : isActive ? "bg-primary text-white" : "bg-secondary text-muted-foreground"
                }`}>
                  {isDone ? "✓" : i + 1}
                </span>
                <span className="text-[11px] font-medium leading-tight">{s.label}</span>
              </button>
            );
          })}
        </div>

        {/* Контент */}
        {loading ? (
          <div className="px-5 py-6 space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-16 bg-secondary rounded-xl animate-pulse" />)}
          </div>
        ) : (
          <>
            {/* ── ПРОВЕРКА ДОКУМЕНТОВ ── */}
            {step === "review" && (
              <div className="px-5 py-5 space-y-4">

                {/* Уже одобрено */}
                {isApproved && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
                    <Icon name="CheckCircle" size={20} className="text-emerald-600 shrink-0" />
                    <div>
                      <div className="text-[13px] font-semibold text-emerald-900">Документы согласованы</div>
                      <div className="text-[12px] text-emerald-700">Менеджер уведомлён. Ожидается оплата.</div>
                    </div>
                  </div>
                )}

                {/* Нет документов */}
                {cs === "none" && (
                  <div className="text-center text-hint py-8">
                    <Icon name="FileX" size={28} className="mx-auto mb-2 text-muted-foreground" />
                    Менеджер ещё не загрузил документы
                  </div>
                )}

                {/* Документы на проверке */}
                {cs === "docs_review" && (
                  <>
                    {/* Счётчик */}
                    <div className="flex items-center justify-between">
                      <div className="text-[13px] font-semibold">Документы от менеджера</div>
                      <span className={`text-[12px] px-2.5 py-1 rounded-full border font-medium ${
                        allSigned
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}>
                        подписано {items.filter(i => i.signed_file_url).length} / {items.length}
                      </span>
                    </div>

                    {/* Список документов: скачать + загрузить подписанный */}
                    <div className="space-y-2">
                      {items.map(item => (
                        <DocSignRow key={item.template_id} item={item} dealId={dealId} onUploaded={reload} />
                      ))}
                    </div>

                    {/* Подсказка */}
                    <div className="text-[12px] text-muted-foreground bg-secondary rounded-lg px-3 py-2">
                      Скачайте каждый документ → проверьте → подпишите → загрузите скан кнопкой «Загрузить».
                    </div>

                    {/* Кнопки: Подтвердить + Отклонить */}
                    <div className="space-y-2 pt-1">
                      <button type="button"
                        onClick={handleApprove}
                        disabled={submitting || !allSigned}
                        className="w-full px-4 py-2.5 bg-emerald-500 text-white rounded-lg text-[13px] font-semibold hover:bg-emerald-600 disabled:opacity-40 transition-colors flex items-center justify-center gap-2">
                        <Icon name="CheckCircle" size={15} />
                        {submitting ? "Отправка..." : "Подтвердить и уведомить менеджера"}
                      </button>
                      {!allSigned && (
                        <div className="text-[11px] text-amber-600 flex items-center gap-1">
                          <Icon name="AlertTriangle" size={11} />
                          Для подтверждения загрузите подписанные сканы всех документов
                        </div>
                      )}

                      {/* Отклонить — доступна сразу */}
                      <button type="button"
                        onClick={() => setShowReject(v => !v)}
                        className="w-full px-4 py-2 border border-red-200 text-red-600 rounded-lg text-[13px] font-medium hover:bg-red-50 transition-colors flex items-center justify-center gap-1.5">
                        <Icon name="XCircle" size={14} />
                        Отклонить и вернуть менеджеру
                      </button>

                      {showReject && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-2">
                          <div className="text-[12px] font-medium text-red-700">Причина отклонения:</div>
                          <textarea value={rejReason} onChange={e => setRejReason(e.target.value)} rows={2}
                            placeholder="Укажите что нужно исправить..."
                            className="w-full border border-red-200 rounded-lg px-3 py-2 text-[12px] outline-none focus:ring-1 focus:ring-red-400 resize-none bg-white" />
                          <div className="flex gap-2">
                            <button type="button" onClick={() => { setShowReject(false); setRejReason(""); }}
                              className="px-3 py-1.5 border border-border rounded-lg text-[12px] hover:bg-secondary transition-colors">
                              Отмена
                            </button>
                            <button type="button" onClick={handleReject} disabled={!rejReason.trim() || submitting}
                              className="flex-1 px-3 py-1.5 bg-red-500 text-white rounded-lg text-[12px] font-medium disabled:opacity-40">
                              {submitting ? "..." : "Отклонить и вернуть менеджеру"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                <button type="button" onClick={onClose}
                  className="w-full px-4 py-2 border border-border rounded-lg text-[13px] hover:bg-secondary transition-colors">
                  Закрыть
                </button>
              </div>
            )}

            {/* ── ОЖИДАНИЕ ОПЛАТЫ ── */}
            {step === "payment" && (
              <div className="px-5 py-5 space-y-4">
                <div className="text-[13px] font-semibold">Ожидание оплаты от заказчика</div>

                {cs === "payment_confirmed" ? (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 space-y-2 text-center">
                    <Icon name="BadgeCheck" size={32} className="text-emerald-500 mx-auto" />
                    <div className="text-[15px] font-bold text-emerald-900">Оплата подтверждена!</div>
                    <div className="text-[12px] text-emerald-700">
                      Сделка переходит в производство. Менеджер получил уведомление.
                    </div>
                  </div>
                ) : (
                  <>
                    <div className={`rounded-xl border p-4 space-y-2 ${
                      cs === "payment_pending" ? "border-amber-200 bg-amber-50" : "border-blue-200 bg-blue-50"
                    }`}>
                      <div className="flex items-center gap-2">
                        {cs === "payment_pending"
                          ? <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin shrink-0" />
                          : <Icon name="Clock" size={16} className="text-blue-500 shrink-0" />
                        }
                        <span className="text-[13px] font-semibold">
                          {cs === "payment_pending" ? "Ожидание поступления аванса" : "Документы подтверждены"}
                        </span>
                      </div>
                      <div className="text-[12px] text-muted-foreground">
                        После получения аванса от заказчика нажмите кнопку подтверждения.
                      </div>
                    </div>

                    <button type="button" onClick={handleConfirmPayment} disabled={submitting}
                      className="w-full px-4 py-3 bg-emerald-500 text-white rounded-xl text-[14px] font-bold hover:bg-emerald-600 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
                      <Icon name="BadgeCheck" size={18} />
                      {submitting ? "Подтверждение..." : "Оплата получена — подтвердить"}
                    </button>

                    <div className="text-center text-[11px] text-hint">
                      После подтверждения менеджер получит уведомление
                    </div>
                  </>
                )}

                <div className="flex gap-3">
                  {cs !== "payment_confirmed" && (
                    <button type="button" onClick={() => setStep("review")}
                      className="px-4 py-2 border border-border rounded-lg text-[13px] hover:bg-secondary transition-colors">
                      ← Назад
                    </button>
                  )}
                  <button type="button" onClick={onClose}
                    className="flex-1 px-4 py-2 border border-border rounded-lg text-[13px] hover:bg-secondary transition-colors">
                    {cs === "payment_confirmed" ? "Закрыть" : "Свернуть"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
