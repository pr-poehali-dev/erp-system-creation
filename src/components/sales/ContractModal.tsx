import { useEffect, useState, useRef } from "react";
import Icon from "@/components/ui/icon";
import { Deal, SlotItem, ContractDocItem, ContractDocsPackage, api } from "@/lib/api";

const MONTH_NAMES = ["","Январь","Февраль","Март","Апрель","Май","Июнь",
  "Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}
function addDays(d: string, n: number) {
  const dt = new Date(d); dt.setDate(dt.getDate() + n);
  return dt.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}
function daysBetween(d1: string, d2: string) {
  return Math.round((new Date(d2).getTime() - new Date(d1).getTime()) / 86400000);
}
const fmt = (n: number) => `₽ ${n.toLocaleString("ru")}`;
const MIN_BUFFER = 15;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Строка одного документа в пакете
function DocRow({ item, dealId, onUploaded }: {
  item: ContractDocItem; dealId: number; onUploaded: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [localFile, setLocalFile] = useState<string | null>(null);
  const isDone = ["uploaded","approved","review"].includes(item.status);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const b64 = await fileToBase64(file);
      await api.contract_docs.upload(dealId, item.template_id, b64, file.name);
      setLocalFile(file.name);
      onUploaded();
    } finally { setUploading(false); }
  };

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
      isDone ? "border-emerald-200 bg-emerald-50"
      : item.is_required ? "border-amber-200 bg-amber-50/60"
      : "border-border bg-white"
    }`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isDone ? "bg-emerald-500" : item.is_required ? "bg-amber-400" : "bg-muted"}`}>
        {isDone ? <Icon name="Check" size={14} className="text-white" />
          : uploading ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
          : <Icon name="Upload" size={13} className="text-white" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[13px] font-semibold">{item.template_name}</span>
          {item.is_required && !isDone && (
            <span className="text-[10px] bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-md font-medium">обязательный</span>
          )}
        </div>
        {item.description && !isDone && <div className="text-[11px] text-muted-foreground mt-0.5">{item.description}</div>}
        {isDone && <div className="text-[11px] text-emerald-700 mt-0.5 flex items-center gap-1"><Icon name="Paperclip" size={10} />{localFile || item.file_name || "Загружен"}</div>}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {item.template_file_url && (
          <a href={item.template_file_url} target="_blank" rel="noreferrer"
            className="flex items-center gap-1 px-2 py-1 border border-border bg-white rounded-lg text-[11px] text-muted-foreground hover:text-primary transition-colors">
            <Icon name="Download" size={11} />Шаблон
          </a>
        )}
        {!isDone ? (
          <button type="button" disabled={uploading} onClick={() => inputRef.current?.click()}
            className="flex items-center gap-1 px-2.5 py-1 bg-primary text-white rounded-lg text-[11px] font-medium disabled:opacity-50">
            {uploading ? "..." : <><Icon name="Upload" size={11} />Загрузить</>}
          </button>
        ) : (
          <button type="button" onClick={() => inputRef.current?.click()}
            className="flex items-center gap-1 px-2 py-1 border border-emerald-300 bg-white rounded-lg text-[11px] text-emerald-700 hover:bg-emerald-50 transition-colors">
            <Icon name="RefreshCw" size={10} />Заменить
          </button>
        )}
        <input ref={inputRef} type="file" className="hidden"
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={handleFile} />
      </div>
    </div>
  );
}

// Шаг-индикатор
const STEPS = [
  { key: "download", num: 1, label: "Скачать пакет" },
  { key: "upload",   num: 2, label: "Загрузить сканы" },
  { key: "review",   num: 3, label: "Проверка директором" },
  { key: "payment",  num: 4, label: "Ожидание оплаты" },
];

type Step = "download" | "upload" | "review" | "payment" | "contract_data";

function stepFromStatus(status: string): Step {
  if (status === "docs_review")        return "review";
  if (status === "docs_approved" || status === "payment_pending") return "payment";
  if (status === "payment_confirmed")  return "payment";
  return "download";
}

interface Props {
  deal: Deal;
  saving: boolean;
  onClose: () => void;
  onSubmit: (body: object) => void;
}

export default function ContractModal({ deal, saving, onClose, onSubmit }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [step, setStep]               = useState<Step>("download");
  const [docPackage, setDocPackage]   = useState<ContractDocsPackage | null>(null);
  const [docsLoading, setDocsLoading] = useState(true);
  const [submitting, setSubmitting]   = useState(false);
  const [rejReason, setRejReason]     = useState("");
  const [showReject, setShowReject]   = useState(false);

  // Данные договора (последний шаг)
  const [slots, setSlots]           = useState<SlotItem[]>([]);
  const [sloading, setSloading]     = useState(false);
  const [slotId, setSlotId]         = useState("");
  const [address, setAddress]       = useState(deal.address || "");
  const [budget, setBudget]         = useState(String(deal.budget || ""));
  const [signedDate, setSignedDate] = useState(today);
  const [error, setError]           = useState("");

  const isSerial = deal.project_type === "serial" || !deal.project_type;
  const cfgDur   = deal.configuration_duration || 115;
  const isDirector = false; // в реальности прокидывается через роль

  const reloadDocs = () => {
    api.contract_docs.get(deal.id).then(pkg => {
      setDocPackage(pkg);
      // Автоматически переходим к нужному шагу по статусу
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

  // Слоты — только на шаге contract_data
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

  const requiredDone  = docPackage?.all_required_done ?? false;
  const contractStatus = docPackage?.contract_status ?? "none";

  // Отправить на проверку
  const handleSubmitReview = async () => {
    setSubmitting(true);
    try {
      await api.contract_docs.submitReview(deal.id);
      reloadDocs();
    } finally { setSubmitting(false); }
  };

  // Директор: подтвердить
  const handleApprove = async () => {
    setSubmitting(true);
    try {
      await api.contract_docs.approve(deal.id, true);
      reloadDocs();
    } finally { setSubmitting(false); }
  };

  // Директор: отклонить
  const handleReject = async () => {
    if (!rejReason.trim()) return;
    setSubmitting(true);
    try {
      await api.contract_docs.approve(deal.id, false, rejReason);
      setShowReject(false);
      setRejReason("");
      reloadDocs();
    } finally { setSubmitting(false); }
  };

  // Директор: подтвердить оплату
  const handleConfirmPayment = async () => {
    setSubmitting(true);
    try {
      await api.contract_docs.confirmPayment(deal.id);
      reloadDocs();
    } finally { setSubmitting(false); }
  };

  // Финальный шаг: подписать договор
  const handleSubmitContract = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSerial && !slotId) { setError("Выберите производственный слот"); return; }
    if (!budget) { setError("Укажите сумму договора"); return; }
    if (selectedSlot && daysBetween(signedDate, selectedSlot.start_date) < MIN_BUFFER) {
      setError(`Слот — минимум через ${MIN_BUFFER} дней после подписания`); return;
    }
    setError("");
    onSubmit({ slot_id: slotId ? Number(slotId) : null, address, budget: Number(budget), signed_date: signedDate });
  };

  const slotsByMonth: Record<string, SlotItem[]> = {};
  slots.forEach(s => { const k = `${s.year}-${s.month}`; if (!slotsByMonth[k]) slotsByMonth[k] = []; slotsByMonth[k].push(s); });

  // Определяем какие шаги завершены
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
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><Icon name="X" size={18} /></button>
        </div>

        {/* Шаги */}
        <div className="flex border-b border-border overflow-x-auto">
          {STEPS.map((s, i) => {
            const isDone = doneSteps[s.key as Step];
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

        {/* ШАГ 1: Скачать пакет */}
        {step === "download" && (
          <div className="px-5 py-5 space-y-4">
            <div className="text-[13px] font-semibold">Скачайте и подпишите документы с клиентом</div>
            {docsLoading ? (
              <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 bg-secondary rounded-xl animate-pulse" />)}</div>
            ) : !docPackage?.items.length ? (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2">
                <Icon name="Info" size={14} className="text-blue-500 shrink-0 mt-0.5" />
                <span className="text-[12px] text-blue-800">Шаблоны документов ещё не добавлены директором.</span>
              </div>
            ) : (
              <div className="space-y-2">
                {docPackage.items.map(item => (
                  <div key={item.template_id} className="flex items-center gap-3 p-3 border border-border rounded-xl">
                    <Icon name="FileText" size={16} className="text-primary shrink-0" />
                    <div className="flex-1">
                      <div className="text-[13px] font-medium">{item.template_name}</div>
                      {item.description && <div className="text-hint text-[11px]">{item.description}</div>}
                    </div>
                    {item.template_file_url ? (
                      <a href={item.template_file_url} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white rounded-lg text-[12px] font-medium hover:bg-primary/90 transition-colors">
                        <Icon name="Download" size={12} />Скачать
                      </a>
                    ) : (
                      <span className="text-[11px] text-hint italic">Файл не загружен</span>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
              <Icon name="Info" size={13} className="text-amber-600 shrink-0 mt-0.5" />
              <span className="text-[12px] text-amber-800">Скачайте каждый документ, распечатайте, подпишите с клиентом, затем загрузите сканы на следующем шаге.</span>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={onClose}
                className="flex-1 px-4 py-2 border border-border rounded-lg text-[13px] hover:bg-secondary transition-colors">Отмена</button>
              <button type="button" onClick={() => setStep("upload")}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors">
                Далее — Загрузить сканы →
              </button>
            </div>
          </div>
        )}

        {/* ШАГ 2: Загрузить сканы */}
        {step === "upload" && (
          <div className="px-5 py-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-[13px] font-semibold">Загрузите подписанные сканы</div>
              {docPackage && (
                <div className={`text-[12px] font-medium px-2.5 py-1 rounded-full border ${
                  requiredDone ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
                }`}>
                  {docPackage.uploaded_count}/{docPackage.total} загружено
                </div>
              )}
            </div>

            {docsLoading ? (
              <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-secondary rounded-xl animate-pulse" />)}</div>
            ) : (
              <div className="space-y-2">
                {(docPackage?.items || []).map(item => (
                  <DocRow key={item.template_id} item={item} dealId={deal.id} onUploaded={reloadDocs} />
                ))}
              </div>
            )}

            {contractStatus === "docs_review" && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
                <span className="text-[12px] text-blue-800 font-medium">Документы отправлены на проверку директору. Ожидайте подтверждения.</span>
              </div>
            )}

            {!requiredDone && contractStatus !== "docs_review" && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                <Icon name="AlertTriangle" size={13} className="text-amber-500 shrink-0 mt-0.5" />
                <span className="text-[12px] text-amber-800">Загрузите все обязательные документы.</span>
              </div>
            )}

            {requiredDone && contractStatus !== "docs_review" && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center gap-2">
                <Icon name="CheckCircle" size={13} className="text-emerald-500 shrink-0" />
                <span className="text-[12px] text-emerald-800 font-medium">Все обязательные загружены — отправьте на проверку директору</span>
              </div>
            )}

            <div className="flex gap-3">
              <button type="button" onClick={() => setStep("download")}
                className="px-4 py-2 border border-border rounded-lg text-[13px] hover:bg-secondary transition-colors">← Назад</button>
              <button type="button"
                disabled={!requiredDone || contractStatus === "docs_review" || submitting}
                onClick={handleSubmitReview}
                className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-lg text-[13px] font-medium hover:bg-amber-600 transition-colors disabled:opacity-40">
                {submitting ? "Отправка..." : contractStatus === "docs_review" ? "Отправлено на проверку" : "Отправить на проверку директору →"}
              </button>
            </div>
          </div>
        )}

        {/* ШАГ 3: Проверка директором */}
        {step === "review" && (
          <div className="px-5 py-5 space-y-4">
            <div className="text-[13px] font-semibold">Проверка документов директором</div>

            {contractStatus === "docs_review" && (
              <div className="border border-blue-200 bg-blue-50 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
                  <span className="text-[13px] font-semibold text-blue-900">Ожидание проверки директора</span>
                </div>
                <div className="text-[12px] text-blue-800">Документы отправлены. Директор получил уведомление и проверяет пакет.</div>

                {/* Директор видит эти кнопки */}
                <div className="pt-2 border-t border-blue-200 space-y-2">
                  <div className="text-[11px] text-blue-700 font-medium">Для директора:</div>
                  <div className="flex gap-2">
                    <button type="button" onClick={handleApprove} disabled={submitting}
                      className="flex-1 px-3 py-2 bg-emerald-500 text-white rounded-lg text-[12px] font-medium hover:bg-emerald-600 disabled:opacity-50">
                      {submitting ? "..." : "✓ Подтвердить документы"}
                    </button>
                    <button type="button" onClick={() => setShowReject(v => !v)}
                      className="px-3 py-2 border border-red-200 text-red-600 rounded-lg text-[12px] hover:bg-red-50 transition-colors">
                      Отклонить
                    </button>
                  </div>
                  {showReject && (
                    <div className="space-y-2">
                      <textarea value={rejReason} onChange={e => setRejReason(e.target.value)} rows={2}
                        placeholder="Причина отклонения..."
                        className="w-full border border-red-200 rounded-lg px-3 py-2 text-[12px] outline-none focus:ring-1 focus:ring-red-400 resize-none" />
                      <button type="button" onClick={handleReject} disabled={!rejReason.trim() || submitting}
                        className="w-full px-3 py-2 bg-red-500 text-white rounded-lg text-[12px] font-medium disabled:opacity-40">
                        Отклонить и вернуть менеджеру
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {contractStatus === "docs_approved" && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-2">
                <Icon name="CheckCircle" size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <div className="text-[13px] font-semibold text-emerald-900">Документы подтверждены</div>
                  <div className="text-[12px] text-emerald-700 mt-0.5">Директор принял пакет. Переходите к ожиданию оплаты.</div>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button type="button" onClick={() => setStep("upload")}
                className="px-4 py-2 border border-border rounded-lg text-[13px] hover:bg-secondary transition-colors">← Назад</button>
              <button type="button"
                disabled={!["docs_approved","payment_pending","payment_confirmed"].includes(contractStatus)}
                onClick={() => setStep("payment")}
                className="flex-1 px-4 py-2 bg-violet-600 text-white rounded-lg text-[13px] font-medium hover:bg-violet-700 disabled:opacity-40 transition-colors">
                Далее — Ожидание оплаты →
              </button>
            </div>
          </div>
        )}

        {/* ШАГ 4: Ожидание оплаты */}
        {step === "payment" && (
          <div className="px-5 py-5 space-y-4">
            <div className="text-[13px] font-semibold">Ожидание оплаты от заказчика</div>

            {contractStatus === "payment_pending" && (
              <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin shrink-0" />
                  <span className="text-[13px] font-semibold text-amber-900">Ожидание оплаты</span>
                </div>
                <div className="text-[12px] text-amber-800">
                  Документы подтверждены. Ожидайте поступления аванса от заказчика.
                  Директор подтвердит оплату после получения средств.
                </div>
                {/* Директор подтверждает */}
                <div className="pt-2 border-t border-amber-200">
                  <div className="text-[11px] text-amber-700 font-medium mb-2">Для директора — после получения оплаты:</div>
                  <button type="button" onClick={handleConfirmPayment} disabled={submitting}
                    className="w-full px-4 py-2.5 bg-emerald-500 text-white rounded-lg text-[13px] font-semibold hover:bg-emerald-600 disabled:opacity-50">
                    {submitting ? "..." : "✓ Подтвердить получение оплаты"}
                  </button>
                </div>
              </div>
            )}

            {contractStatus === "payment_confirmed" && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Icon name="CheckCircle" size={18} className="text-emerald-600 shrink-0" />
                  <span className="text-[14px] font-bold text-emerald-900">Оплата подтверждена!</span>
                </div>
                <div className="text-[12px] text-emerald-700">Сделка переходит в производство. Получите выплату комиссионного вознаграждения.</div>
                <button type="button" onClick={() => setStep("contract_data")}
                  className="w-full mt-2 px-4 py-2.5 bg-violet-600 text-white rounded-lg text-[13px] font-semibold hover:bg-violet-700 transition-colors">
                  Завершить → Зафиксировать договор и создать проект
                </button>
              </div>
            )}

            {!["payment_pending","payment_confirmed"].includes(contractStatus) && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2">
                <Icon name="Info" size={13} className="text-blue-500 shrink-0 mt-0.5" />
                <span className="text-[12px] text-blue-800">Этот шаг активируется после подтверждения документов директором.</span>
              </div>
            )}

            <div className="flex gap-3">
              <button type="button" onClick={() => setStep("review")}
                className="px-4 py-2 border border-border rounded-lg text-[13px] hover:bg-secondary transition-colors">← Назад</button>
            </div>
          </div>
        )}

        {/* ФИНАЛЬНЫЙ ШАГ: Данные договора (после оплаты) */}
        {step === "contract_data" && (
          <form onSubmit={handleSubmitContract} className="px-5 py-5 space-y-4">
            <div className="text-[13px] font-semibold">Зафиксировать договор и создать проект</div>

            {deal.configuration_name && (
              <div className="bg-violet-50 border border-violet-200 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[13px] font-semibold text-violet-900">{deal.configuration_name}</div>
                    <div className="text-[11px] text-violet-600">{cfgDur} дней строительства</div>
                  </div>
                  <div className="text-[14px] font-bold text-violet-900">{fmt(deal.budget)}</div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-[13px] font-medium mb-1">Дата подписания <span className="text-red-500">*</span></label>
              <input type="date" value={signedDate} onChange={e => setSignedDate(e.target.value)} min={today}
                className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
              <div className="text-hint text-[11px] mt-1">Слот — не ранее {fmtDate(minSlotDate)}</div>
            </div>

            <div>
              <label className="block text-[13px] font-medium mb-1">Адрес строительства</label>
              <input type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder="Точный адрес участка"
                className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
            </div>

            <div>
              <label className="block text-[13px] font-medium mb-1">Сумма договора (₽) <span className="text-red-500">*</span></label>
              <input type="number" value={budget} onChange={e => setBudget(e.target.value)} placeholder="6500000" min={0}
                className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
            </div>

            {isSerial && (
              <div>
                <label className="block text-[13px] font-medium mb-1">Производственный слот <span className="text-red-500">*</span></label>
                <div className="text-hint text-[11px] mb-2">Показаны слоты после {fmtDate(minSlotDate)}</div>
                {sloading ? (
                  <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-12 bg-secondary rounded-xl animate-pulse" />)}</div>
                ) : slots.length === 0 ? (
                  <div className="border border-amber-200 bg-amber-50 rounded-xl p-3 text-[12px] text-amber-800">Нет свободных слотов.</div>
                ) : (
                  <div className="border border-border rounded-xl overflow-hidden">
                    {Object.entries(slotsByMonth).map(([key, monthSlots]) => {
                      const [year, month] = key.split("-").map(Number);
                      const pct = Math.min(Math.round(((monthSlots[0]?.occupied_count ?? 0) / (monthSlots[0]?.monthly_limit ?? 4)) * 100), 100);
                      return (
                        <div key={key} className="border-b border-border last:border-0">
                          <div className="flex items-center justify-between px-4 py-2 bg-background">
                            <span className="text-[13px] font-semibold">{MONTH_NAMES[month]} {year}</span>
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-border rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${pct >= 100 ? "bg-red-500" : pct >= 75 ? "bg-amber-400" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-[11px] text-hint">{monthSlots[0]?.occupied_count ?? 0}/{monthSlots[0]?.monthly_limit ?? 4}</span>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 p-3">
                            {monthSlots.map(slot => {
                              const isSel = slotId === String(slot.id);
                              return (
                                <button key={slot.id} type="button" onClick={() => setSlotId(String(slot.id))}
                                  className={`text-left px-3 py-2 rounded-lg border text-[12px] transition-all ${isSel ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/50"}`}>
                                  <div className="font-semibold">{fmtDate(slot.start_date)}</div>
                                  <div className={`text-[10px] mt-0.5 ${isSel ? "text-primary/70" : "text-hint"}`}>+{daysBetween(signedDate, slot.start_date)} дн.</div>
                                  <div className={`text-[10px] ${isSel ? "text-primary/70" : "text-hint"}`}>Сдача: ~{addDays(slot.start_date, cfgDur)}</div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {selectedSlot && (
                  <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-center gap-2 text-[12px] text-emerald-700">
                    <Icon name="CheckCircle" size={13} className="shrink-0" />
                    {fmtDate(selectedSlot.start_date)} · через {daysBetween(signedDate, selectedSlot.start_date)} дн.
                  </div>
                )}
              </div>
            )}

            {error && <div className="flex items-center gap-2 text-red-600 text-[13px]"><Icon name="AlertCircle" size={14} />{error}</div>}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
              <Icon name="Zap" size={13} className="text-blue-500 shrink-0 mt-0.5" />
              <span className="text-[12px] text-blue-800">Автоматически создастся проект <strong>ДОМ-XXXX</strong> с Гант-планом.</span>
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => setStep("payment")}
                className="px-4 py-2 border border-border rounded-lg text-[13px] hover:bg-secondary transition-colors">← Назад</button>
              <button type="submit" disabled={saving}
                className="flex-1 px-4 py-2 bg-violet-600 text-white rounded-lg text-[13px] font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors">
                {saving ? "Создание..." : "Создать проект"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
