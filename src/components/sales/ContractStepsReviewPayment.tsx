import Icon from "@/components/ui/icon";

// ─── ШАГ 3: Проверка директором ───────────────────────────────────────────────

interface ReviewProps {
  contractStatus: string;
  isDirector: boolean;
  submitting: boolean;
  showReject: boolean;
  rejReason: string;
  onApprove: () => void;
  onToggleReject: () => void;
  onReject: () => void;
  onRejReasonChange: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
}

export function StepReview({
  contractStatus, isDirector, submitting, showReject, rejReason,
  onApprove, onToggleReject, onReject, onRejReasonChange, onBack, onNext,
}: ReviewProps) {
  return (
    <div className="px-5 py-5 space-y-4">
      <div className="text-[13px] font-semibold">Проверка документов директором</div>

      {contractStatus === "docs_review" && (
        <div className="border border-blue-200 bg-blue-50 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
            <span className="text-[13px] font-semibold text-blue-900">Ожидание проверки директора</span>
          </div>
          <div className="text-[12px] text-blue-800">Документы отправлены. Директор получил уведомление и проверяет пакет.</div>

          {isDirector ? (
            <div className="pt-2 border-t border-blue-200 space-y-2">
              <div className="text-[11px] text-blue-700 font-medium">Проверьте документы:</div>
              <div className="flex gap-2">
                <button type="button" onClick={onApprove} disabled={submitting}
                  className="flex-1 px-3 py-2 bg-emerald-500 text-white rounded-lg text-[12px] font-medium hover:bg-emerald-600 disabled:opacity-50">
                  {submitting ? "..." : "✓ Подтвердить"}
                </button>
                <button type="button" onClick={onToggleReject}
                  className="px-3 py-2 border border-red-200 text-red-600 rounded-lg text-[12px] hover:bg-red-50 transition-colors">
                  Отклонить
                </button>
              </div>
              {showReject && (
                <div className="space-y-2">
                  <textarea value={rejReason} onChange={e => onRejReasonChange(e.target.value)} rows={2}
                    placeholder="Причина отклонения..."
                    className="w-full border border-red-200 rounded-lg px-3 py-2 text-[12px] outline-none focus:ring-1 focus:ring-red-400 resize-none" />
                  <button type="button" onClick={onReject} disabled={!rejReason.trim() || submitting}
                    className="w-full px-3 py-2 bg-red-500 text-white rounded-lg text-[12px] font-medium disabled:opacity-40">
                    Отклонить и вернуть менеджеру
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-[12px] text-blue-700 mt-1 flex items-center gap-1.5">
              <Icon name="Clock" size={12} className="shrink-0" />
              Ожидайте — директор проверяет документы
            </div>
          )}
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
                className="w-full px-4 py-2.5 bg-emerald-500 text-white rounded-lg text-[13px] font-semibold hover:bg-emerald-600 disabled:opacity-50">
                {submitting ? "..." : "✓ Подтвердить получение оплаты"}
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
          <div className="text-[12px] text-emerald-700">Сделка переходит в производство. Получите выплату комиссионного вознаграждения.</div>
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
