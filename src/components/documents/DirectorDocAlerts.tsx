import Icon from "@/components/ui/icon";
import { Deal, PayoutDeal } from "@/lib/api";

// ─── Блок: документы на подписание ───────────────────────────────────────────

interface PendingDealsProps {
  pendingDeals: Deal[];
  onOpen: (deal: Deal) => void;
}

export function DirectorPendingDeals({ pendingDeals, onOpen }: PendingDealsProps) {
  if (pendingDeals.length === 0) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-amber-200 flex items-center gap-2">
        <div className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-pulse" />
        <span className="font-semibold text-[14px] text-amber-900">
          Требует вашего внимания — {pendingDeals.length} {pendingDeals.length === 1 ? "сделка" : "сделки"}
        </span>
      </div>
      <div className="divide-y divide-amber-200">
        {pendingDeals.map(deal => {
          const cs = deal.contract_status || "";
          const statusLabel = cs === "docs_review"
            ? { text: "Документы ждут подписи", cls: "bg-amber-100 text-amber-800", icon: "FileSearch" }
            : cs === "docs_approved"
            ? { text: "Ожидание оплаты", cls: "bg-blue-100 text-blue-800", icon: "Clock" }
            : { text: "Подтвердить оплату", cls: "bg-emerald-100 text-emerald-800", icon: "BadgeCheck" };

          return (
            <div key={deal.id} className="px-5 py-3 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13px] font-bold text-primary">{deal.code}</span>
                  <span className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md font-medium ${statusLabel.cls}`}>
                    <Icon name={statusLabel.icon as Parameters<typeof Icon>[0]["name"]} size={10} />
                    {statusLabel.text}
                  </span>
                </div>
                <div className="text-[12px] text-foreground font-medium mt-0.5">{deal.client_name}</div>
                <div className="text-hint text-[11px]">{deal.manager_name}</div>
              </div>
              {deal.budget > 0 && (
                <div className="text-[13px] font-bold text-emerald-600 shrink-0">
                  ₽ {deal.budget.toLocaleString("ru")}
                </div>
              )}
              <button
                onClick={() => onOpen(deal)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium transition-colors shrink-0 ${
                  cs === "payment_pending"
                    ? "bg-emerald-500 text-white hover:bg-emerald-600"
                    : "bg-primary text-white hover:bg-primary/90"
                }`}>
                {cs === "payment_pending"
                  ? <><Icon name="BadgeCheck" size={14} />Подтвердить оплату</>
                  : <><Icon name="PenLine" size={14} />Открыть</>
                }
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Блок: счета от менеджеров на согласование ───────────────────────────────

interface PendingPayoutsProps {
  pendingPayouts: PayoutDeal[];
}

export function DirectorPendingPayouts({ pendingPayouts }: PendingPayoutsProps) {
  if (pendingPayouts.length === 0) return null;

  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-emerald-200 flex items-center gap-2">
        <Icon name="Receipt" size={15} className="text-emerald-600 shrink-0" />
        <span className="font-semibold text-[14px] text-emerald-900">
          Счета на согласование — {pendingPayouts.length} {pendingPayouts.length === 1 ? "счёт" : "счёта"}
        </span>
      </div>
      <div className="divide-y divide-emerald-100">
        {pendingPayouts.map(deal => (
          <div key={deal.id} className="px-5 py-3 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[13px] font-bold text-primary">{deal.code}</span>
                <span className="flex items-center gap-1 text-[11px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md font-medium">
                  <Icon name="Clock" size={10} />Ожидает согласования
                </span>
              </div>
              <div className="text-[12px] text-foreground font-medium mt-0.5">{deal.client_name}</div>
              <div className="text-hint text-[11px]">{deal.manager_name}</div>
            </div>
            {deal.budget > 0 && (
              <div className="text-[13px] font-bold text-emerald-600 shrink-0">
                ₽ {deal.budget.toLocaleString("ru")}
              </div>
            )}
            <div className="flex items-center gap-2 shrink-0">
              {deal.invoice_file_url && (
                <a href={deal.invoice_file_url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-emerald-300 bg-white rounded-lg text-[12px] text-emerald-700 font-medium hover:bg-emerald-50 transition-colors">
                  <Icon name="Download" size={13} />Счёт
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="px-5 py-2.5 bg-emerald-100/50 border-t border-emerald-200">
        <p className="text-[11px] text-emerald-700">
          Для согласования и выплат перейдите в раздел <strong>CRM → Заявка на выплату</strong>
        </p>
      </div>
    </div>
  );
}
