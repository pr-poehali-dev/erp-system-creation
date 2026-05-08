import Icon from "@/components/ui/icon";
import { ContractDocItem } from "@/lib/api";
import ContractDirectorDocRow from "./ContractDirectorDocRow";

interface Props {
  cs: string;
  items: ContractDocItem[];
  docsLoading: boolean;
  isApproved: boolean;
  allSigned: boolean;
  submitting: boolean;
  error: string;
  showReject: boolean;
  rejReason: string;
  dealId: number;
  onReloadDocs: () => void;
  onApprove: () => void;
  onToggleReject: () => void;
  onReject: () => void;
  onRejReasonChange: (v: string) => void;
  onConfirmPayment: () => void;
  onClose: () => void;
}

export default function KpFlowDirectorReview({
  cs, items, docsLoading, isApproved, allSigned,
  submitting, error, showReject, rejReason,
  dealId, onReloadDocs, onApprove, onToggleReject, onReject,
  onRejReasonChange, onConfirmPayment, onClose,
}: Props) {
  return (
    <div className="px-5 py-5 space-y-4">

      {/* ── Проверка документов ── */}
      {!isApproved && cs !== "payment_pending" && cs !== "payment_confirmed" && (
        <div className="space-y-3">
          <div className="text-[13px] font-semibold">Проверка документов</div>

          {cs === "none" && (
            <div className="text-center text-hint text-[13px] py-8">
              <Icon name="FileSearch" size={28} className="mx-auto mb-2 text-muted-foreground" />
              Менеджер ещё не загрузил документы
            </div>
          )}

          {cs === "docs_review" && (
            <>
              {/* Список документов */}
              {docsLoading ? (
                <div className="space-y-2">
                  {[1,2].map(i => <div key={i} className="h-14 bg-secondary rounded-xl animate-pulse" />)}
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map(item => (
                    <ContractDirectorDocRow
                      key={item.template_id}
                      item={item}
                      dealId={dealId}
                      onUploaded={onReloadDocs}
                    />
                  ))}
                </div>
              )}

              {/* Инструкция */}
              <div className="text-[12px] text-muted-foreground bg-secondary rounded-lg px-3 py-2">
                Скачайте документ → проверьте → подпишите → загрузите скан.
              </div>

              {/* Кнопки действий */}
              <div className="pt-1 space-y-2">
                {/* Подтвердить — только когда все подписаны */}
                <button
                  type="button"
                  onClick={onApprove}
                  disabled={submitting || !allSigned}
                  className="w-full px-3 py-2.5 bg-emerald-500 text-white rounded-lg text-[13px] font-medium hover:bg-emerald-600 disabled:opacity-40 transition-colors"
                >
                  {submitting ? "..." : "✓ Подтвердить — отправить менеджеру"}
                </button>
                {!allSigned && items.length > 0 && (
                  <div className="text-[11px] text-amber-600 flex items-center gap-1">
                    <Icon name="AlertTriangle" size={11} />
                    Для подтверждения загрузите подписанные сканы всех документов
                  </div>
                )}

                {/* Отклонить — доступна всегда */}
                <button
                  type="button"
                  onClick={onToggleReject}
                  className="w-full px-3 py-2 border border-red-200 text-red-600 rounded-lg text-[12px] font-medium hover:bg-red-50 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Icon name="XCircle" size={14} />
                  Отклонить и вернуть на доработку
                </button>

                {/* Форма причины отклонения */}
                {showReject && (
                  <div className="space-y-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                    <div className="text-[12px] font-medium text-red-700">Причина отклонения:</div>
                    <textarea
                      value={rejReason}
                      onChange={e => onRejReasonChange(e.target.value)}
                      rows={2}
                      placeholder="Опишите что нужно исправить..."
                      className="w-full border border-red-200 rounded-lg px-3 py-2 text-[12px] outline-none focus:ring-1 focus:ring-red-400 resize-none bg-white"
                    />
                    <div className="flex gap-2">
                      <button type="button" onClick={onToggleReject}
                        className="px-3 py-1.5 border border-border rounded-lg text-[12px] text-muted-foreground hover:bg-secondary">
                        Отмена
                      </button>
                      <button type="button" onClick={onReject} disabled={!rejReason.trim() || submitting}
                        className="flex-1 px-3 py-1.5 bg-red-500 text-white rounded-lg text-[12px] font-medium disabled:opacity-40">
                        {submitting ? "..." : "Отклонить и вернуть менеджеру"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Ожидание оплаты ── */}
      {cs === "payment_pending" && (
        <div className="space-y-3">
          <div className="text-[13px] font-semibold">Подтверждение оплаты</div>
          <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 space-y-3">
            <div className="text-[13px] font-semibold text-amber-900">Ожидание аванса от заказчика</div>
            <div className="text-[12px] text-amber-800">После получения аванса нажмите кнопку — менеджер сможет создать проект.</div>
            <button type="button" onClick={onConfirmPayment} disabled={submitting}
              className="w-full px-4 py-2.5 bg-emerald-500 text-white rounded-lg text-[13px] font-semibold hover:bg-emerald-600 disabled:opacity-50 flex items-center justify-center gap-2">
              <Icon name="BadgeCheck" size={16} />
              {submitting ? "..." : "Оплата получена — подтвердить"}
            </button>
          </div>
        </div>
      )}

      {/* ── Оплата подтверждена ── */}
      {cs === "payment_confirmed" && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Icon name="CheckCircle" size={18} className="text-emerald-600" />
            <span className="text-[14px] font-bold text-emerald-900">Оплата подтверждена!</span>
          </div>
          <div className="text-[12px] text-emerald-700">Менеджер переведёт сделку в производство.</div>
        </div>
      )}

      {error && (
        <div className="text-red-600 text-[13px] flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <Icon name="AlertCircle" size={14} />{error}
        </div>
      )}
      <button type="button" onClick={onClose}
        className="w-full px-4 py-2 border border-border rounded-lg text-[13px] hover:bg-secondary">
        Закрыть
      </button>
    </div>
  );
}
