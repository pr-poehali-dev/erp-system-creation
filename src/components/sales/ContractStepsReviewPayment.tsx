import { useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import { ContractDocItem, api } from "@/lib/api";

// ─── Утилита: base64 из File ──────────────────────────────────────────────────
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Строка одного документа на шаге Review (директор загружает подписанный) ─
function SignedDocRow({ item, dealId, isDirector, onUploaded }: {
  item: ContractDocItem; dealId: number; isDirector: boolean; onUploaded: () => void;
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
    } finally { setUploading(false); }
  };

  const hasSigned = !!item.signed_file_url;

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
      hasSigned ? "border-emerald-200 bg-emerald-50" : "border-blue-200 bg-blue-50/60"
    }`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
        hasSigned ? "bg-emerald-500" : "bg-blue-400"
      }`}>
        {hasSigned
          ? <Icon name="CheckCheck" size={13} className="text-white" />
          : uploading
            ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : <Icon name="Pen" size={12} className="text-white" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-semibold">{item.template_name}</div>
        {hasSigned ? (
          <div className="text-[11px] text-emerald-700 flex items-center gap-1 mt-0.5">
            <Icon name="Paperclip" size={9} />{item.signed_file_name || "Подписан"}
          </div>
        ) : (
          <div className="text-[11px] text-blue-700 mt-0.5">Скачайте, подпишите и загрузите</div>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {item.template_file_url && (
          <a href={item.template_file_url} target="_blank" rel="noreferrer"
            className="flex items-center gap-1 px-2 py-1 border border-border bg-white rounded-lg text-[11px] text-muted-foreground hover:text-primary transition-colors">
            <Icon name="Download" size={10} />Шаблон
          </a>
        )}
        {item.file_url && (
          <a href={item.file_url} target="_blank" rel="noreferrer"
            className="flex items-center gap-1 px-2 py-1 border border-blue-200 bg-white rounded-lg text-[11px] text-blue-700 hover:bg-blue-50 transition-colors">
            <Icon name="FileText" size={10} />От менеджера
          </a>
        )}
        {hasSigned && (
          <a href={item.signed_file_url!} target="_blank" rel="noreferrer"
            className="flex items-center gap-1 px-2 py-1 border border-emerald-200 bg-emerald-50 rounded-lg text-[11px] text-emerald-700 hover:bg-emerald-100 transition-colors">
            <Icon name="FileCheck" size={10} />Подписанный
          </a>
        )}
        {isDirector && (
          <button type="button" disabled={uploading} onClick={() => inputRef.current?.click()}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-colors ${
              hasSigned
                ? "border border-border text-muted-foreground hover:bg-secondary"
                : "bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            }`}>
            {uploading ? "..." : hasSigned ? <><Icon name="RefreshCw" size={9} />Заменить</> : <><Icon name="Upload" size={10} />Загрузить</>}
          </button>
        )}
        <input ref={inputRef} type="file" className="hidden"
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={handleFile} />
      </div>
    </div>
  );
}

// ─── ШАГ 3: Проверка директором ───────────────────────────────────────────────

interface ReviewProps {
  contractStatus: string;
  isDirector: boolean;
  submitting: boolean;
  showReject: boolean;
  rejReason: string;
  items: ContractDocItem[];
  dealId: number;
  onApprove: () => void;
  onToggleReject: () => void;
  onReject: () => void;
  onRejReasonChange: (v: string) => void;
  onReload: () => void;
  onBack: () => void;
  onNext: () => void;
}

export function StepReview({
  contractStatus, isDirector, submitting, showReject, rejReason,
  items, dealId,
  onApprove, onToggleReject, onReject, onRejReasonChange, onReload, onBack, onNext,
}: ReviewProps) {
  const allSigned = items.every(it => it.signed_file_url);

  return (
    <div className="px-5 py-5 space-y-4">
      <div className="text-[13px] font-semibold">Проверка и подписание документов</div>

      {/* Регламент */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-2">
        <Icon name="Clock" size={13} className="text-amber-600 shrink-0" />
        <span className="text-[12px] text-amber-800">
          <strong>Регламент:</strong> проверка документов — 2 рабочих дня.
        </span>
      </div>

      {/* Статус для менеджера — ожидание */}
      {!isDirector && contractStatus === "docs_review" && (
        <div className="border border-blue-200 bg-blue-50 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
            <span className="text-[13px] font-semibold text-blue-900">Ожидание проверки директора</span>
          </div>
          <div className="text-[12px] text-blue-800">
            Документы отправлены. Директор проверяет пакет в течение 2 рабочих дней.
          </div>
          <div className="text-[12px] text-blue-700 flex items-center gap-1.5">
            <Icon name="Clock" size={12} className="shrink-0" />
            Как только директор подпишет — вы получите уведомление и скачаете подписанные документы
          </div>
        </div>
      )}

      {/* Для директора — всегда показываем список документов и кнопки */}
      {isDirector && !["docs_approved","payment_pending","payment_confirmed"].includes(contractStatus) && (
        <div className="space-y-3">
          <div className="border border-blue-200 bg-blue-50 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Icon name="FileSearch" size={16} className="text-blue-600 shrink-0" />
              <span className="text-[13px] font-semibold text-blue-900">Проверьте и подпишите документы</span>
            </div>
            <div className="text-[12px] text-blue-800">
              Скачайте документ от менеджера («От менеджера»), подпишите со стороны компании и загрузите подписанный вариант.
            </div>
          </div>

          {/* Список документов */}
          {items.length > 0 ? (
            <div className="space-y-2">
              <div className="text-[12px] font-medium text-foreground">Документы для подписания:</div>
              {items.map(item => (
                <SignedDocRow key={item.template_id} item={item} dealId={dealId} isDirector={isDirector} onUploaded={onReload} />
              ))}
            </div>
          ) : (
            <div className="text-center text-hint text-[13px] py-4">
              Документы ещё не загружены менеджером
            </div>
          )}

          {/* Кнопки одобрить/отклонить */}
          <div className="pt-2 border-t border-border space-y-2">
            <div className="text-[11px] text-foreground font-medium">
              {allSigned ? "✓ Все подписаны — отправьте менеджеру:" : "После загрузки всех подписанных вариантов:"}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onApprove} disabled={submitting || !allSigned || items.length === 0}
                className="flex-1 px-3 py-2 bg-emerald-500 text-white rounded-lg text-[12px] font-medium hover:bg-emerald-600 disabled:opacity-50">
                {submitting ? "..." : "✓ Подтвердить и отправить менеджеру"}
              </button>
              <button type="button" onClick={onToggleReject}
                className="px-3 py-2 border border-red-200 text-red-600 rounded-lg text-[12px] hover:bg-red-50 transition-colors">
                Отклонить
              </button>
            </div>
            {!allSigned && items.length > 0 && (
              <div className="text-[11px] text-amber-700 flex items-center gap-1">
                <Icon name="AlertTriangle" size={11} className="shrink-0" />
                Загрузите подписанные варианты всех документов
              </div>
            )}
            {showReject && (
              <div className="space-y-2">
                <textarea value={rejReason} onChange={e => onRejReasonChange(e.target.value)} rows={2}
                  placeholder="Укажите причину отклонения..."
                  className="w-full border border-red-200 rounded-lg px-3 py-2 text-[12px] outline-none focus:ring-1 focus:ring-red-400 resize-none" />
                <button type="button" onClick={onReject} disabled={!rejReason.trim() || submitting}
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
            <div className="text-[13px] font-semibold text-emerald-900">Документы подтверждены и подписаны</div>
            <div className="text-[12px] text-emerald-700 mt-0.5">
              Директор подписал документы и отправил менеджеру. Переходите к ожиданию оплаты.
            </div>
          </div>
        </div>
      )}

      {/* Показываем подписанные директором документы менеджеру */}
      {contractStatus === "docs_approved" && !isDirector && items.some(it => it.signed_file_url) && (
        <div className="space-y-2">
          <div className="text-[12px] font-medium">Подписанные компанией документы:</div>
          {items.filter(it => it.signed_file_url).map(item => (
            <div key={item.template_id} className="flex items-center gap-2 p-2.5 border border-emerald-200 bg-emerald-50 rounded-xl">
              <Icon name="FileCheck" size={14} className="text-emerald-600 shrink-0" />
              <span className="text-[12px] flex-1 truncate">{item.template_name}</span>
              <a href={item.signed_file_url!} target="_blank" rel="noreferrer"
                className="flex items-center gap-1 px-2 py-1 bg-emerald-600 text-white rounded-lg text-[11px] font-medium hover:bg-emerald-700 transition-colors">
                <Icon name="Download" size={10} />Скачать
              </a>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3">
        <button type="button" onClick={onBack}
          className="px-4 py-2 border border-border rounded-lg text-[13px] hover:bg-secondary transition-colors">← Назад</button>
        <button type="button"
          disabled={!["docs_approved","payment_pending","payment_confirmed"].includes(contractStatus)}
          onClick={onNext}
          className="flex-1 px-4 py-2 bg-violet-600 text-white rounded-lg text-[13px] font-medium hover:bg-violet-700 disabled:opacity-40 transition-colors">
          Далее — Ожидание оплаты →
        </button>
      </div>
    </div>
  );
}

// ─── ШАГ 4: Ожидание оплаты ───────────────────────────────────────────────────

interface PaymentProps {
  contractStatus: string;
  isDirector: boolean;
  submitting: boolean;
  onConfirmPayment: () => void;
  onBack: () => void;
  onNext: () => void;
}

export function StepPayment({
  contractStatus, isDirector, submitting, onConfirmPayment, onBack, onNext,
}: PaymentProps) {
  return (
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
          {isDirector ? (
            <div className="pt-2 border-t border-amber-200">
              <div className="text-[11px] text-amber-700 font-medium mb-2">После получения аванса от заказчика:</div>
              <button type="button" onClick={onConfirmPayment} disabled={submitting}
                className="w-full px-4 py-2.5 bg-emerald-500 text-white rounded-lg text-[13px] font-semibold hover:bg-emerald-600 disabled:opacity-50 flex items-center justify-center gap-2">
                <Icon name="BadgeCheck" size={16} />
                {submitting ? "..." : "Оплата прошла — подтвердить"}
              </button>
            </div>
          ) : (
            <div className="text-[12px] text-amber-700 mt-1 flex items-center gap-1.5 pt-2 border-t border-amber-200">
              <Icon name="Clock" size={12} className="shrink-0" />
              Ожидайте — директор подтвердит поступление оплаты
            </div>
          )}
        </div>
      )}

      {contractStatus === "payment_confirmed" && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Icon name="CheckCircle" size={18} className="text-emerald-600 shrink-0" />
            <span className="text-[14px] font-bold text-emerald-900">Оплата подтверждена!</span>
          </div>
          <div className="text-[12px] text-emerald-700">
            Сделка переходит в производство. Подайте заявку на получение комиссионного вознаграждения.
          </div>
          <button type="button" onClick={onNext}
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
        <button type="button" onClick={onBack}
          className="px-4 py-2 border border-border rounded-lg text-[13px] hover:bg-secondary transition-colors">← Назад</button>
      </div>
    </div>
  );
}