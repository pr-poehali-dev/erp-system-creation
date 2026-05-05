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

// ─── Строка одного документа (директор скачивает + загружает подписанный) ────
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
    <div className={`rounded-xl border p-3 space-y-2 transition-all ${
      hasSigned ? "border-emerald-200 bg-emerald-50" : "border-blue-200 bg-blue-50/50"
    }`}>
      <div className="flex items-center gap-3">
        {/* Иконка статуса */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
          hasSigned ? "bg-emerald-500" : uploading ? "bg-blue-300" : "bg-blue-400"
        }`}>
          {hasSigned
            ? <Icon name="CheckCheck" size={14} className="text-white" />
            : uploading
              ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Icon name="Pen" size={13} className="text-white" />
          }
        </div>

        {/* Название */}
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold">{item.template_name}</div>
          {hasSigned
            ? <div className="text-[11px] text-emerald-700 flex items-center gap-1 mt-0.5">
                <Icon name="Paperclip" size={9} />{item.signed_file_name || "Подписан и загружен"}
              </div>
            : <div className="text-[11px] text-blue-600 mt-0.5">Подпишите и загрузите со стороны компании</div>
          }
        </div>
      </div>

      {/* Кнопки */}
      <div className="flex items-center gap-2 flex-wrap pl-11">
        {/* Скачать документ от менеджера */}
        {item.file_url && (
          <a href={item.file_url} target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 border border-blue-200 bg-white rounded-lg text-[12px] text-blue-700 font-medium hover:bg-blue-50 transition-colors">
            <Icon name="Download" size={12} />Скачать от менеджера
          </a>
        )}
        {/* Скачать уже загруженный подписанный */}
        {hasSigned && (
          <a href={item.signed_file_url!} target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 border border-emerald-200 bg-white rounded-lg text-[12px] text-emerald-700 hover:bg-emerald-50 transition-colors">
            <Icon name="FileCheck" size={12} />Подписанный
          </a>
        )}
        {/* Загрузить / заменить подписанный */}
        <button type="button" disabled={uploading} onClick={() => inputRef.current?.click()}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
            hasSigned
              ? "border border-border text-muted-foreground hover:bg-secondary"
              : "bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          }`}>
          {uploading
            ? <><div className="w-3 h-3 border-2 border-white/50 border-t-white rounded-full animate-spin" />Загрузка...</>
            : hasSigned
              ? <><Icon name="RefreshCw" size={11} />Заменить</>
              : <><Icon name="Upload" size={12} />Загрузить подписанный</>
          }
        </button>
        <input ref={inputRef} type="file" className="hidden"
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={handleFile} />
      </div>
    </div>
  );
}

// ─── Шаги ─────────────────────────────────────────────────────────────────────
const STEPS = [
  { key: "download", num: 1, label: "Скачать документы" },
  { key: "sign",     num: 2, label: "Загрузить подписанные" },
  { key: "confirm",  num: 3, label: "Отправить менеджеру" },
  { key: "payment",  num: 4, label: "Ожидание оплаты" },
];
type Step = "download" | "sign" | "confirm" | "payment";

// ─── Пропсы ───────────────────────────────────────────────────────────────────
interface Props {
  dealId: number;
  dealCode: string;
  clientName: string;
  onClose: () => void;
  onApproved: () => void;  // колбэк после одобрения — обновить список
}

export default function ContractReviewModal({ dealId, dealCode, clientName, onClose, onApproved }: Props) {
  const [step, setStep]             = useState<Step>("download");
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
        // Если уже в процессе — открываем на нужном шаге
        if (cs === "docs_approved" || cs === "payment_pending" || cs === "payment_confirmed") {
          setStep("payment");
        } else if (cs === "docs_review") {
          setStep("sign"); // Документы ждут подписи директора
        }
      })
      .finally(() => setLoading(false));
  }, [dealId]);

  const items = pkg?.items || [];
  const cs    = pkg?.contract_status ?? "none";
  const allSigned = items.length > 0 && items.every(it => it.signed_file_url);

  // Одобрить документы (+ уведомить менеджера)
  const handleApprove = async () => {
    setSubmitting(true);
    try {
      await api.contract_docs.approve(dealId, true);
      reload();
      setStep("payment");
      onApproved();
    } finally { setSubmitting(false); }
  };

  // Отклонить с причиной
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

  // Подтвердить оплату
  const handleConfirmPayment = async () => {
    setSubmitting(true);
    try {
      await api.contract_docs.confirmPayment(dealId);
      reload();
      onApproved();
    } finally { setSubmitting(false); }
  };

  const doneSteps: Record<Step, boolean> = {
    download: cs !== "none",
    sign:     allSigned || ["docs_approved","payment_pending","payment_confirmed"].includes(cs),
    confirm:  ["docs_approved","payment_pending","payment_confirmed"].includes(cs),
    payment:  cs === "payment_confirmed",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl border border-border shadow-xl w-full max-w-xl max-h-[94vh] overflow-y-auto animate-fade-in">

        {/* Шапка */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="font-semibold text-[15px]">Подписание договора · {dealCode}</h2>
            <p className="text-hint text-[12px] mt-0.5">{clientName} · Проверка со стороны директора</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <Icon name="X" size={18} />
          </button>
        </div>

        {/* Шаг-индикатор */}
        <div className="flex border-b border-border overflow-x-auto">
          {STEPS.map(s => {
            const isDone   = doneSteps[s.key as Step];
            const isActive = step === s.key;
            return (
              <button key={s.key} type="button"
                onClick={() => setStep(s.key as Step)}
                className={`flex-1 min-w-[110px] flex flex-col items-center gap-1 px-2 py-3 text-center border-b-2 transition-colors ${
                  isActive ? "border-primary text-primary" : isDone ? "border-emerald-400 text-emerald-600" : "border-transparent text-muted-foreground"
                }`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                  isDone ? "bg-emerald-500 text-white" : isActive ? "bg-primary text-white" : "bg-secondary text-muted-foreground"
                }`}>
                  {isDone ? "✓" : s.num}
                </span>
                <span className="text-[11px] font-medium leading-tight">{s.label}</span>
              </button>
            );
          })}
        </div>

        {/* Контент шагов */}
        {loading ? (
          <div className="px-5 py-6 space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-16 bg-secondary rounded-xl animate-pulse" />)}
          </div>
        ) : (
          <>
            {/* ШАГ 1: Скачать документы от менеджера */}
            {step === "download" && (
              <div className="px-5 py-5 space-y-4">
                <div className="text-[13px] font-semibold">Документы от менеджера для ознакомления</div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 flex items-start gap-2">
                  <Icon name="Info" size={13} className="text-blue-500 shrink-0 mt-0.5" />
                  <span className="text-[12px] text-blue-800">
                    Скачайте каждый документ, ознакомьтесь, подпишите со стороны компании и загрузите на следующем шаге.
                  </span>
                </div>
                {items.length === 0 ? (
                  <div className="text-center text-hint py-6">Документы ещё не загружены менеджером</div>
                ) : (
                  <div className="space-y-2">
                    {items.map(item => (
                      item.file_url ? (
                        <div key={item.template_id} className="flex items-center gap-3 p-3 border border-border rounded-xl">
                          <Icon name="FileText" size={16} className="text-primary shrink-0" />
                          <div className="flex-1">
                            <div className="text-[13px] font-medium">{item.template_name}</div>
                            {item.description && <div className="text-hint text-[11px]">{item.description}</div>}
                          </div>
                          <a href={item.file_url} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-[12px] font-medium hover:bg-primary/90 transition-colors">
                            <Icon name="Download" size={12} />Скачать
                          </a>
                        </div>
                      ) : null
                    ))}
                  </div>
                )}
                <div className="flex gap-3">
                  <button type="button" onClick={onClose}
                    className="px-4 py-2 border border-border rounded-lg text-[13px] hover:bg-secondary transition-colors">Закрыть</button>
                  <button type="button" onClick={() => setStep("sign")}
                    className="flex-1 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors">
                    Далее — Загрузить подписанные →
                  </button>
                </div>
              </div>
            )}

            {/* ШАГ 2: Загрузить подписанные документы */}
            {step === "sign" && (
              <div className="px-5 py-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-[13px] font-semibold">Загрузите подписанные со стороны компании</div>
                  <div className={`text-[12px] font-medium px-2.5 py-1 rounded-full border ${
                    allSigned ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
                  }`}>
                    {items.filter(i => i.signed_file_url).length}/{items.length} загружено
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-2">
                  <Icon name="Clock" size={13} className="text-amber-600 shrink-0" />
                  <span className="text-[12px] text-amber-800">
                    <strong>Регламент:</strong> проверка и подписание — 2 рабочих дня
                  </span>
                </div>

                <div className="space-y-3">
                  {items.map(item => (
                    <DocSignRow key={item.template_id} item={item} dealId={dealId} onUploaded={reload} />
                  ))}
                </div>

                {allSigned && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center gap-2">
                    <Icon name="CheckCircle" size={14} className="text-emerald-600 shrink-0" />
                    <span className="text-[12px] text-emerald-800 font-medium">
                      Все документы подписаны — отправьте менеджеру
                    </span>
                  </div>
                )}

                <div className="flex gap-3">
                  <button type="button" onClick={() => setStep("download")}
                    className="px-4 py-2 border border-border rounded-lg text-[13px] hover:bg-secondary transition-colors">← Назад</button>
                  <button type="button" disabled={!allSigned} onClick={() => setStep("confirm")}
                    className="flex-1 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors">
                    Далее — Отправить менеджеру →
                  </button>
                </div>
              </div>
            )}

            {/* ШАГ 3: Подтвердить и отправить менеджеру */}
            {step === "confirm" && (
              <div className="px-5 py-5 space-y-4">
                <div className="text-[13px] font-semibold">Подтвердить документы и уведомить менеджера</div>

                {cs === "docs_review" ? (
                  <>
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Icon name="FileCheck" size={16} className="text-blue-600 shrink-0" />
                        <span className="text-[13px] font-semibold text-blue-900">
                          {allSigned ? "Все документы подписаны" : "Загрузите все подписанные документы"}
                        </span>
                      </div>
                      <div className="text-[12px] text-blue-800">
                        После подтверждения менеджер получит уведомление и сможет скачать подписанные со стороны компании документы. Сделка перейдёт в статус «Ожидание оплаты».
                      </div>
                    </div>

                    {/* Подписанные документы — список */}
                    <div className="space-y-2">
                      {items.map(item => (
                        <div key={item.template_id} className={`flex items-center gap-3 p-2.5 rounded-xl border ${
                          item.signed_file_url ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"
                        }`}>
                          <Icon name={item.signed_file_url ? "CheckCircle" : "AlertTriangle"} size={14}
                            className={item.signed_file_url ? "text-emerald-600 shrink-0" : "text-amber-500 shrink-0"} />
                          <span className="text-[12px] flex-1">{item.template_name}</span>
                          {item.signed_file_url
                            ? <span className="text-[11px] text-emerald-700">✓ Подписан</span>
                            : <span className="text-[11px] text-amber-700">Не загружен</span>
                          }
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <button type="button" onClick={handleApprove} disabled={submitting || !allSigned}
                        className="flex-1 px-4 py-2.5 bg-emerald-500 text-white rounded-lg text-[13px] font-semibold hover:bg-emerald-600 disabled:opacity-50 transition-colors">
                        {submitting ? "Отправка..." : "✓ Подтвердить и отправить менеджеру"}
                      </button>
                      <button type="button" onClick={() => setShowReject(v => !v)}
                        className="px-4 py-2.5 border border-red-200 text-red-600 rounded-lg text-[13px] hover:bg-red-50 transition-colors">
                        Отклонить
                      </button>
                    </div>

                    {showReject && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-2">
                        <div className="text-[12px] font-medium text-red-700">Причина отклонения:</div>
                        <textarea value={rejReason} onChange={e => setRejReason(e.target.value)} rows={2}
                          placeholder="Укажите что нужно исправить..."
                          className="w-full border border-red-200 rounded-lg px-3 py-2 text-[12px] outline-none focus:ring-1 focus:ring-red-400 resize-none bg-white" />
                        <div className="flex gap-2">
                          <button onClick={() => { setShowReject(false); setRejReason(""); }}
                            className="px-3 py-1.5 border border-border rounded-lg text-[12px] hover:bg-secondary transition-colors">
                            Отмена
                          </button>
                          <button onClick={handleReject} disabled={!rejReason.trim() || submitting}
                            className="flex-1 px-3 py-1.5 bg-red-500 text-white rounded-lg text-[12px] font-medium disabled:opacity-40">
                            {submitting ? "..." : "Отклонить и вернуть менеджеру"}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-2">
                    <Icon name="CheckCircle" size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-[13px] font-semibold text-emerald-900">Документы уже подтверждены</div>
                      <div className="text-[12px] text-emerald-700 mt-0.5">Менеджер уведомлён. Ожидается оплата.</div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <button type="button" onClick={() => setStep("sign")}
                    className="px-4 py-2 border border-border rounded-lg text-[13px] hover:bg-secondary transition-colors">← Назад</button>
                  {["docs_approved","payment_pending","payment_confirmed"].includes(cs) && (
                    <button type="button" onClick={() => setStep("payment")}
                      className="flex-1 px-4 py-2 bg-violet-600 text-white rounded-lg text-[13px] font-medium hover:bg-violet-700 transition-colors">
                      Далее — Ожидание оплаты →
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ШАГ 4: Ожидание оплаты */}
            {step === "payment" && (
              <div className="px-5 py-5 space-y-4">
                <div className="text-[13px] font-semibold">Ожидание оплаты от заказчика</div>

                {cs === "payment_confirmed" ? (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 space-y-2 text-center">
                    <Icon name="BadgeCheck" size={32} className="text-emerald-500 mx-auto" />
                    <div className="text-[15px] font-bold text-emerald-900">Оплата подтверждена!</div>
                    <div className="text-[12px] text-emerald-700">
                      Сделка завершена и переходит в производство. Менеджер получил уведомление о выплате.
                    </div>
                  </div>
                ) : (
                  <>
                    <div className={`border rounded-xl p-4 space-y-3 ${
                      cs === "payment_pending"
                        ? "border-amber-200 bg-amber-50"
                        : "border-blue-200 bg-blue-50"
                    }`}>
                      <div className="flex items-center gap-2">
                        {cs === "payment_pending"
                          ? <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin shrink-0" />
                          : <Icon name="Clock" size={16} className="text-blue-500 shrink-0" />
                        }
                        <span className="text-[13px] font-semibold">
                          {cs === "payment_pending" ? "Ожидание поступления оплаты" : "Ожидание подтверждения директором"}
                        </span>
                      </div>
                      <div className="text-[12px] text-muted-foreground">
                        Документы подтверждены. После поступления аванса от заказчика — нажмите кнопку подтверждения оплаты.
                      </div>
                    </div>

                    <button type="button" onClick={handleConfirmPayment} disabled={submitting}
                      className="w-full px-4 py-3 bg-emerald-500 text-white rounded-xl text-[14px] font-bold hover:bg-emerald-600 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
                      <Icon name="BadgeCheck" size={18} />
                      {submitting ? "Подтверждение..." : "Оплата прошла — подтвердить"}
                    </button>

                    <div className="text-center text-[11px] text-hint">
                      После подтверждения менеджер получит уведомление и сможет подать заявку на выплату
                    </div>
                  </>
                )}

                <div className="flex gap-3">
                  {cs !== "payment_confirmed" && (
                    <button type="button" onClick={() => setStep("confirm")}
                      className="px-4 py-2 border border-border rounded-lg text-[13px] hover:bg-secondary transition-colors">← Назад</button>
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
