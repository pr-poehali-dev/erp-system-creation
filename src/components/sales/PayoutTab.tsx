import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { api, PayoutDeal } from "@/lib/api";
import { Role } from "@/App";

const fmt = (n: number) => `₽ ${n.toLocaleString("ru")}`;

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending:  { label: "На рассмотрении", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  approved: { label: "Одобрена",        cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  rejected: { label: "Отклонена",       cls: "bg-red-50 text-red-600 border-red-200" },
};

interface Props {
  role: Role;
  managerId?: number; // id текущего менеджера, если роль crm_manager
}

export default function PayoutTab({ role, managerId }: Props) {
  const [deals, setDeals]     = useState<PayoutDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<number | null>(null);
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const [notes, setNotes]     = useState<Record<number, string>>({});
  const [successId, setSuccessId] = useState<number | null>(null);

  const isDirector = role === "director";

  const load = () => {
    setLoading(true);
    api.payout_requests.list(isDirector ? undefined : managerId)
      .then(r => setDeals(r.deals))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [managerId]);

  const handleRequest = async (deal: PayoutDeal) => {
    if (!managerId) return;
    setSubmitting(deal.id);
    try {
      const amount = amounts[deal.id] ? Number(amounts[deal.id]) : undefined;
      await api.payout_requests.create(deal.id, managerId, amount, notes[deal.id]);
      setSuccessId(deal.id);
      setTimeout(() => setSuccessId(null), 4000);
      load();
    } finally { setSubmitting(null); }
  };

  const handleDirectorUpdate = async (deal: PayoutDeal, status: "approved" | "rejected") => {
    if (!deal.payout_id) return;
    setSubmitting(deal.id);
    try {
      await api.payout_requests.update(deal.payout_id, status);
      load();
    } finally { setSubmitting(null); }
  };

  if (loading) return (
    <div className="space-y-3">
      {[1,2,3].map(i => <div key={i} className="h-20 bg-secondary rounded-xl animate-pulse" />)}
    </div>
  );

  if (deals.length === 0) return (
    <div className="text-center py-16">
      <Icon name="Wallet" size={36} className="mx-auto mb-3 text-muted-foreground opacity-30" />
      <div className="text-[14px] font-medium text-foreground mb-1">Нет сделок для выплаты</div>
      <div className="text-[13px] text-hint">
        {isDirector
          ? "Когда менеджеры подадут заявки — они появятся здесь"
          : "Сделки с подтверждённой оплатой появятся здесь после завершения договора"}
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {!isDirector && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-2">
          <Icon name="Info" size={14} className="text-blue-500 shrink-0 mt-0.5" />
          <span className="text-[12px] text-blue-800">
            По каждой сделке с подтверждённой оплатой вы можете подать заявку на выплату комиссионного вознаграждения.
            Директор рассмотрит и одобрит выплату.
          </span>
        </div>
      )}

      {deals.map(deal => {
        const badge = deal.payout_status ? STATUS_BADGE[deal.payout_status] : null;
        const isSubmitting = submitting === deal.id;
        const hasRequest = !!deal.payout_id;

        return (
          <div key={deal.id} className="bg-white border border-border rounded-xl p-4 space-y-3">
            {/* Шапка */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13px] font-bold text-primary">{deal.code}</span>
                  {badge && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md border font-medium ${badge.cls}`}>
                      {badge.label}
                    </span>
                  )}
                </div>
                <div className="text-[13px] font-semibold text-foreground">{deal.client_name}</div>
                <div className="text-hint text-[11px]">{deal.client_phone}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[14px] font-bold text-emerald-600">{fmt(deal.budget)}</div>
                {deal.serial_project_name && (
                  <div className="text-hint text-[11px]">{deal.serial_project_name}</div>
                )}
                {deal.signed_date && (
                  <div className="text-hint text-[11px]">
                    {new Date(deal.signed_date).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
                  </div>
                )}
              </div>
            </div>

            {/* Если заявка уже подана */}
            {hasRequest && deal.payout_status && (
              <div className={`rounded-lg px-3 py-2 border ${badge?.cls}`}>
                <div className="text-[12px] font-medium">{badge?.label}</div>
                {deal.payout_amount && (
                  <div className="text-[12px] mt-0.5">Сумма: {fmt(deal.payout_amount)}</div>
                )}
                {deal.requested_at && (
                  <div className="text-[11px] opacity-70 mt-0.5">
                    Подана: {new Date(deal.requested_at).toLocaleDateString("ru-RU")}
                  </div>
                )}
              </div>
            )}

            {/* Директор: одобрить / отклонить */}
            {isDirector && deal.payout_status === "pending" && (
              <div className="flex gap-2 pt-1">
                <button
                  disabled={isSubmitting}
                  onClick={() => handleDirectorUpdate(deal, "approved")}
                  className="flex-1 px-3 py-2 bg-emerald-500 text-white rounded-lg text-[12px] font-medium hover:bg-emerald-600 disabled:opacity-50 flex items-center justify-center gap-1.5">
                  <Icon name="Check" size={13} />
                  {isSubmitting ? "..." : "Одобрить выплату"}
                </button>
                <button
                  disabled={isSubmitting}
                  onClick={() => handleDirectorUpdate(deal, "rejected")}
                  className="px-3 py-2 border border-red-200 text-red-600 rounded-lg text-[12px] hover:bg-red-50 disabled:opacity-50 transition-colors">
                  Отклонить
                </button>
              </div>
            )}

            {/* Менеджер: подать заявку */}
            {!isDirector && !hasRequest && (
              <div className="space-y-2 pt-1">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-muted-foreground mb-1">Сумма вознаграждения (₽)</label>
                    <input
                      type="number"
                      value={amounts[deal.id] || ""}
                      onChange={e => setAmounts(p => ({ ...p, [deal.id]: e.target.value }))}
                      placeholder="Укажите сумму"
                      className="w-full border border-border rounded-lg px-3 py-1.5 text-[12px] outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-muted-foreground mb-1">Примечание</label>
                    <input
                      type="text"
                      value={notes[deal.id] || ""}
                      onChange={e => setNotes(p => ({ ...p, [deal.id]: e.target.value }))}
                      placeholder="Необязательно"
                      className="w-full border border-border rounded-lg px-3 py-1.5 text-[12px] outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
                {successId === deal.id && (
                  <div className="text-[12px] text-emerald-700 flex items-center gap-1.5">
                    <Icon name="CheckCircle" size={13} />
                    Заявка подана — ожидайте решения директора
                  </div>
                )}
                <button
                  disabled={isSubmitting}
                  onClick={() => handleRequest(deal)}
                  className="w-full px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
                  {isSubmitting ? "Отправка..." : "Подать заявку на выплату"}
                </button>
              </div>
            )}

            {/* Уже одобрено */}
            {!isDirector && deal.payout_status === "approved" && (
              <div className="flex items-center gap-2 text-[12px] text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
                <Icon name="PartyPopper" size={14} className="shrink-0" />
                Выплата одобрена директором!
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
