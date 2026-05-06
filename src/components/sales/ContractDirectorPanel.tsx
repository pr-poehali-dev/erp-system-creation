import Icon from "@/components/ui/icon";
import { Deal, ContractDocsPackage } from "@/lib/api";
import ContractDirectorDocRow from "./ContractDirectorDocRow";

const STATUS_INFO: Record<string, { label: string; cls: string; icon: string }> = {
  none:              { label: "Менеджер ещё не отправил документы",    cls: "bg-secondary border-border text-muted-foreground", icon: "Clock" },
  docs_uploaded:     { label: "Менеджер загрузил документы",           cls: "bg-blue-50 border-blue-200 text-blue-700",        icon: "FileText" },
  docs_review:       { label: "Документы на вашей проверке",           cls: "bg-amber-50 border-amber-200 text-amber-800",     icon: "FileSearch" },
  docs_approved:     { label: "Вы подтвердили — ожидание оплаты",      cls: "bg-emerald-50 border-emerald-200 text-emerald-700", icon: "CheckCircle" },
  payment_pending:   { label: "Ожидание оплаты от заказчика",          cls: "bg-amber-50 border-amber-200 text-amber-800",     icon: "Clock" },
  payment_confirmed: { label: "Оплата подтверждена — проект запущен",  cls: "bg-emerald-50 border-emerald-200 text-emerald-700", icon: "BadgeCheck" },
};

interface Props {
  deal: Deal;
  docPackage: ContractDocsPackage | null;
  docsLoading: boolean;
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
}

export default function ContractDirectorPanel({
  deal, docPackage, docsLoading, submitting, showReject, rejReason,
  onReload, onApprove, onToggleReject, onReject, onRejReasonChange,
  onConfirmPayment, onNext,
}: Props) {
  const cs        = docPackage?.contract_status ?? "none";
  const items     = docPackage?.items || [];
  const allSigned = items.length > 0 && items.every(it => it.signed_file_url);
  const statusInfo = STATUS_INFO[cs] || STATUS_INFO["none"];

  if (docsLoading) {
    return (
      <div className="px-5 py-5 space-y-3">
        {[1,2,3].map(i => <div key={i} className="h-16 bg-secondary rounded-xl animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="px-5 py-5 space-y-4">
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
            {items.length > 0 ? "Документы от менеджера — подпишите и загрузите:" : "Менеджер ещё не загрузил документы"}
          </div>
          {items.map(item => (
            <ContractDirectorDocRow key={item.template_id} item={item} dealId={deal.id} onUploaded={onReload} />
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
                      className="px-3 py-1.5 border border-border rounded-lg text-[12px] text-muted-foreground hover:bg-secondary transition-colors">
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
