import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { api, PayoutDeal } from "@/lib/api";
import { Role } from "@/App";

const fmt = (n: number) => `₽ ${n.toLocaleString("ru")}`;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const STATUS_BADGE: Record<string, { label: string; cls: string; icon: string }> = {
  pending:  { label: "На согласовании", cls: "bg-amber-50 text-amber-700 border-amber-200",   icon: "Clock" },
  approved: { label: "Согласован",      cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: "BadgeCheck" },
  rejected: { label: "Отклонён",        cls: "bg-red-50 text-red-600 border-red-200",         icon: "XCircle" },
};

interface Props {
  role: Role;
  managerId?: number;
}

export default function PayoutTab({ role, managerId }: Props) {
  const [deals, setDeals]       = useState<PayoutDeal[]>([]);
  const [loading, setLoading]   = useState(true);
  const [submitting, setSubmitting] = useState<number | null>(null);

  // Состояния формы менеджера (по deal.id)
  const [amounts, setAmounts]   = useState<Record<number, string>>({});
  const [notes, setNotes]       = useState<Record<number, string>>({});
  const [files, setFiles]       = useState<Record<number, File | null>>({});
  const [successId, setSuccessId] = useState<number | null>(null);

  // Директор: комментарий при отклонении
  const [rejectId, setRejectId]     = useState<number | null>(null);
  const [rejectComment, setRejectComment] = useState("");

  const isDirector = role === "director";

  const load = () => {
    setLoading(true);
    api.payout_requests.list(isDirector ? undefined : managerId)
      .then(r => setDeals(r.deals))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [managerId]);

  // Загрузка счёта менеджером
  const handleSubmitInvoice = async (deal: PayoutDeal) => {
    if (!managerId) return;
    setSubmitting(deal.id);
    try {
      const file = files[deal.id];
      let file_b64: string | undefined;
      let file_name: string | undefined;
      if (file) {
        file_b64  = await fileToBase64(file);
        file_name = file.name;
      }
      const isResubmit = deal.payout_status === "rejected" && deal.payout_id;
      if (isResubmit) {
        await api.payout_requests.resubmit({
          payout_id: deal.payout_id,
          invoice_file_b64: file_b64,
          invoice_file_name: file_name,
          amount: amounts[deal.id] ? Number(amounts[deal.id]) : undefined,
        });
      } else {
        await api.payout_requests.create({
          deal_id:    deal.id,
          manager_id: managerId,
          amount:     amounts[deal.id] ? Number(amounts[deal.id]) : undefined,
          notes:      notes[deal.id] || "",
          invoice_file_b64:  file_b64,
          invoice_file_name: file_name,
        });
      }
      setSuccessId(deal.id);
      setTimeout(() => setSuccessId(null), 5000);
      load();
    } finally { setSubmitting(null); }
  };

  // Директор: одобрить
  const handleApprove = async (deal: PayoutDeal) => {
    if (!deal.payout_id) return;
    setSubmitting(deal.id);
    try {
      await api.payout_requests.update(deal.payout_id, "approved");
      load();
    } finally { setSubmitting(null); }
  };

  // Директор: отклонить (с комментарием)
  const handleReject = async (deal: PayoutDeal) => {
    if (!deal.payout_id) return;
    setSubmitting(deal.id);
    try {
      await api.payout_requests.update(deal.payout_id, "rejected", rejectComment);
      setRejectId(null);
      setRejectComment("");
      load();
    } finally { setSubmitting(null); }
  };

  if (loading) return (
    <div className="space-y-3">
      {[1,2,3].map(i => <div key={i} className="h-24 bg-secondary rounded-xl animate-pulse" />)}
    </div>
  );

  if (deals.length === 0) return (
    <div className="text-center py-16">
      <Icon name="Receipt" size={36} className="mx-auto mb-3 text-muted-foreground opacity-30" />
      <div className="text-[14px] font-medium text-foreground mb-1">Нет счетов на оплату</div>
      <div className="text-[13px] text-hint">
        {isDirector
          ? "Когда менеджеры загрузят счета — они появятся здесь"
          : "Сделки с подтверждённой оплатой появятся здесь. Загрузите счёт для получения вознаграждения."}
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {!isDirector && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-2">
          <Icon name="Info" size={14} className="text-blue-500 shrink-0 mt-0.5" />
          <span className="text-[12px] text-blue-800">
            По каждой сделке с подтверждённой оплатой загрузите счёт на оплату вознаграждения и отправьте на согласование директору.
          </span>
        </div>
      )}

      {deals.map(deal => {
        const badge       = deal.payout_status ? STATUS_BADGE[deal.payout_status] : null;
        const isSubmit    = submitting === deal.id;
        const hasRequest  = !!deal.payout_id;
        const isRejected  = deal.payout_status === "rejected";
        const isPending   = deal.payout_status === "pending";
        const isApproved  = deal.payout_status === "approved";
        const showForm    = !isDirector && (!hasRequest || isRejected);
        const isRejectOpen = rejectId === deal.id;
        // fileRef handled via inline onChange + hidden input id

        return (
          <div key={deal.id} className="bg-white border border-border rounded-xl p-4 space-y-3">
            {/* Шапка */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13px] font-bold text-primary">{deal.code}</span>
                  {badge && (
                    <span className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md border font-medium ${badge.cls}`}>
                      <Icon name={badge.icon as Parameters<typeof Icon>[0]["name"]} size={10} />
                      {badge.label}
                    </span>
                  )}
                </div>
                <div className="text-[13px] font-semibold text-foreground">{deal.client_name}</div>
                <div className="text-hint text-[11px]">{deal.manager_name} · {deal.client_phone}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[14px] font-bold text-emerald-600">{fmt(deal.budget)}</div>
                {deal.serial_project_name && <div className="text-hint text-[11px]">{deal.serial_project_name}</div>}
                {deal.signed_date && (
                  <div className="text-hint text-[11px]">
                    {new Date(deal.signed_date).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
                  </div>
                )}
              </div>
            </div>

            {/* Загруженный счёт */}
            {hasRequest && deal.invoice_file_url && (
              <div className="flex items-center gap-2 bg-secondary rounded-lg px-3 py-2">
                <Icon name="Receipt" size={14} className="text-muted-foreground shrink-0" />
                <span className="text-[12px] text-foreground flex-1 truncate">{deal.invoice_file_name || "Счёт на оплату"}</span>
                <a href={deal.invoice_file_url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1 px-2 py-1 bg-primary text-white rounded-lg text-[11px] hover:bg-primary/90 transition-colors shrink-0">
                  <Icon name="Download" size={10} />Скачать
                </a>
              </div>
            )}

            {/* Сумма вознаграждения если указана */}
            {hasRequest && deal.payout_amount && (
              <div className="text-[12px] text-muted-foreground">
                Сумма вознаграждения: <span className="font-semibold text-foreground">{fmt(deal.payout_amount)}</span>
              </div>
            )}

            {/* Комментарий при отклонении */}
            {isRejected && deal.reject_comment && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-start gap-2">
                <Icon name="AlertCircle" size={13} className="text-red-500 shrink-0 mt-0.5" />
                <div>
                  <div className="text-[11px] font-medium text-red-700">Причина отклонения:</div>
                  <div className="text-[12px] text-red-600">{deal.reject_comment}</div>
                </div>
              </div>
            )}

            {/* Директор: одобрить / отклонить */}
            {isDirector && isPending && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <button disabled={isSubmit} onClick={() => handleApprove(deal)}
                    className="flex-1 px-3 py-2 bg-emerald-500 text-white rounded-lg text-[12px] font-medium hover:bg-emerald-600 disabled:opacity-50 flex items-center justify-center gap-1.5">
                    <Icon name="Check" size={13} />
                    {isSubmit && rejectId !== deal.id ? "..." : "Согласовать счёт"}
                  </button>
                  <button disabled={isSubmit} onClick={() => { setRejectId(deal.id); setRejectComment(""); }}
                    className="px-3 py-2 border border-red-200 text-red-600 rounded-lg text-[12px] hover:bg-red-50 disabled:opacity-50 transition-colors">
                    Отклонить
                  </button>
                </div>
                {/* Форма причины отклонения */}
                {isRejectOpen && (
                  <div className="space-y-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                    <div className="text-[12px] font-medium text-red-700">Укажите причину отклонения:</div>
                    <textarea
                      value={rejectComment}
                      onChange={e => setRejectComment(e.target.value)}
                      rows={2}
                      placeholder="Например: неверные реквизиты, другая сумма..."
                      className="w-full border border-red-200 rounded-lg px-3 py-2 text-[12px] outline-none focus:ring-1 focus:ring-red-400 resize-none bg-white"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => setRejectId(null)}
                        className="px-3 py-1.5 border border-border rounded-lg text-[12px] hover:bg-secondary transition-colors">
                        Отмена
                      </button>
                      <button disabled={!rejectComment.trim() || isSubmit}
                        onClick={() => handleReject(deal)}
                        className="flex-1 px-3 py-1.5 bg-red-500 text-white rounded-lg text-[12px] font-medium disabled:opacity-40">
                        {isSubmit ? "..." : "Отклонить с комментарием"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Директор: одобрено */}
            {isDirector && isApproved && (
              <div className="text-[12px] text-emerald-700 flex items-center gap-1.5">
                <Icon name="CheckCircle" size={14} />Счёт согласован
              </div>
            )}

            {/* Менеджер: форма загрузки счёта */}
            {showForm && (
              <div className="space-y-2 pt-1 border-t border-border">
                {isRejected && (
                  <div className="text-[12px] font-medium text-foreground">
                    Загрузите исправленный счёт:
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                      Сумма вознаграждения (₽)
                    </label>
                    <input type="number" value={amounts[deal.id] || ""} min={0}
                      onChange={e => setAmounts(p => ({ ...p, [deal.id]: e.target.value }))}
                      placeholder="Укажите сумму"
                      className="w-full border border-border rounded-lg px-3 py-1.5 text-[12px] outline-none focus:ring-1 focus:ring-primary" />
                  </div>
                  {!isRejected && (
                    <div>
                      <label className="block text-[11px] font-medium text-muted-foreground mb-1">Примечание</label>
                      <input type="text" value={notes[deal.id] || ""}
                        onChange={e => setNotes(p => ({ ...p, [deal.id]: e.target.value }))}
                        placeholder="Необязательно"
                        className="w-full border border-border rounded-lg px-3 py-1.5 text-[12px] outline-none focus:ring-1 focus:ring-primary" />
                    </div>
                  )}
                </div>

                {/* Загрузка файла */}
                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                    Счёт на оплату (PDF, DOCX) <span className="text-red-500">*</span>
                  </label>
                  <label htmlFor={`invoice-file-${deal.id}`}
                    className={`flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer transition-colors text-[12px] ${
                      files[deal.id]
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : "border-dashed border-border hover:border-primary/50 text-muted-foreground"
                    }`}>
                    <Icon name={files[deal.id] ? "FileCheck" : "Upload"} size={14} className="shrink-0" />
                    <span className="truncate">{files[deal.id]?.name || "Нажмите для выбора файла"}</span>
                  </label>
                  <input id={`invoice-file-${deal.id}`} type="file" className="hidden"
                    accept=".pdf,.doc,.docx"
                    onChange={e => {
                      const f = e.target.files?.[0] || null;
                      setFiles(p => ({ ...p, [deal.id]: f }));
                    }} />
                </div>

                {successId === deal.id && (
                  <div className="text-[12px] text-emerald-700 flex items-center gap-1.5">
                    <Icon name="CheckCircle" size={13} />
                    Счёт отправлен на согласование директору
                  </div>
                )}

                <button disabled={isSubmit || !files[deal.id]}
                  onClick={() => handleSubmitInvoice(deal)}
                  className="w-full px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
                  {isSubmit ? "Загрузка..." : isRejected ? "Отправить исправленный счёт" : "Отправить счёт на согласование"}
                </button>
              </div>
            )}

            {/* Менеджер: ожидание */}
            {!isDirector && isPending && (
              <div className="text-[12px] text-amber-700 flex items-center gap-1.5 pt-1 border-t border-border">
                <Icon name="Clock" size={13} className="shrink-0" />
                Счёт на рассмотрении у директора
              </div>
            )}

            {/* Менеджер: одобрено */}
            {!isDirector && isApproved && (
              <div className="flex items-center gap-2 text-[12px] text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2 border-t border-border">
                <Icon name="PartyPopper" size={14} className="shrink-0" />
                Счёт согласован директором! Ожидайте выплаты.
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}