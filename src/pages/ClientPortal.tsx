import { useEffect, useState } from "react";
import { api, ClientPortalData, ClientAct, ClientPortalStage, ClientPaymentHistoryItem } from "@/lib/api";
import Icon from "@/components/ui/icon";

const PROJECT_STATUS_MAP: Record<string, { label: string; cls: string; icon: string }> = {
  planning: { label: "Планирование",  cls: "bg-blue-100 text-blue-700 border-blue-200",         icon: "ClipboardList" },
  active:   { label: "Строительство", cls: "bg-amber-100 text-amber-700 border-amber-200",      icon: "HardHat" },
  done:     { label: "Сдан",          cls: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: "CheckCircle2" },
  archived: { label: "Архив",         cls: "bg-gray-100 text-gray-600 border-gray-200",          icon: "Archive" },
};

const STAGE_CFG: Record<string, { label: string; badgeCls: string; dotCls: string; icon: string }> = {
  done:        { label: "Завершён",    badgeCls: "bg-emerald-100 text-emerald-700", dotCls: "bg-emerald-500",  icon: "Check" },
  in_progress: { label: "Выполняется", badgeCls: "bg-amber-100 text-amber-700",    dotCls: "bg-amber-400",    icon: "Dot" },
  overdue:     { label: "Просрочен",   badgeCls: "bg-red-100 text-red-700",         dotCls: "bg-red-500",      icon: "AlertCircle" },
  pending:     { label: "Ожидает",     badgeCls: "bg-gray-100 text-gray-500",       dotCls: "bg-gray-300",     icon: "Dot" },
};

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(n) + " ₽";

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

interface Props { token: string; }

export default function ClientPortal({ token }: Props) {
  const [data, setData] = useState<ClientPortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [signing, setSigning] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    api.client_portal.get(token)
      .then(setData)
      .catch(() => setError("Страница не найдена. Проверьте ссылку."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [token]);

  const handleSign = async (act: ClientAct) => {
    setSigning(act.id);
    try {
      await api.client_portal.signAct(act.id);
      load();
    } finally {
      setSigning(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f6fa] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="text-muted-foreground text-sm">Загружаем данные...</div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#f5f6fa] flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
            <Icon name="AlertCircle" size={32} className="text-red-500" />
          </div>
          <h1 className="text-xl font-semibold">Страница не найдена</h1>
          <p className="text-muted-foreground text-sm">{error || "Ссылка недействительна или устарела."}</p>
        </div>
      </div>
    );
  }

  const { deal, stages, acts, payments_history, paid_main, paid_extra, balance, paid_pct, budget } = data;
  const _pmh: ClientPaymentHistoryItem[] = payments_history || [];

  const projectStatus = deal.project_status || "planning";
  const pstatus = PROJECT_STATUS_MAP[projectStatus] || PROJECT_STATUS_MAP["planning"];

  const pendingActs = acts.filter(a => a.status === "pending_signature");
  const signedActs  = acts.filter(a => a.status !== "pending_signature");

  const doneStages = stages.filter((s: ClientPortalStage & { effective_status?: string }) =>
    s.effective_status === "done" || s.status === "done"
  ).length;
  const buildPct = stages.length > 0 ? Math.round((doneStages / stages.length) * 100) : 0;

  const mainPayments  = _pmh.filter(p => p.category === "Основной договор");
  const extraPayments = _pmh.filter(p => p.category !== "Основной договор");

  return (
    <div className="min-h-screen bg-[#f5f6fa]">
      {/* Header */}
      <div className="bg-white border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground mb-0.5">Личный кабинет клиента</div>
            <div className="font-semibold text-[15px]">{deal.client_name}</div>
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[12px] font-medium ${pstatus.cls}`}>
            <Icon name={pstatus.icon as Parameters<typeof Icon>[0]["name"]} size={13} />
            {pstatus.label}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* Карточка проекта */}
        <div className="bg-white rounded-xl border border-border p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <div className="text-xs text-muted-foreground">Проект</div>
              <div className="font-semibold text-[17px] mt-0.5">{deal.project_code || deal.deal_code}</div>
              {deal.address ? (
                <div className="flex items-center gap-1 text-[13px] text-muted-foreground mt-1">
                  <Icon name="MapPin" size={12} className="shrink-0" />
                  {deal.address}
                </div>
              ) : (
                <div className="text-[12px] text-muted-foreground/50 mt-1 italic">Адрес не указан</div>
              )}
            </div>
            {budget > 0 && (
              <div className="text-right shrink-0">
                <div className="text-xs text-muted-foreground">Сумма договора</div>
                <div className="font-bold text-[17px] mt-0.5">{fmtMoney(budget)}</div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 text-[13px]">
            {deal.start_date && (
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">Начало строительства</div>
                <div className="font-medium">{fmt(deal.start_date)}</div>
              </div>
            )}
            {deal.deadline && (
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">Плановая сдача</div>
                <div className="font-medium">{fmt(deal.deadline)}</div>
              </div>
            )}
          </div>
        </div>

        {/* Оплата по основному договору */}
        {budget > 0 && (
          <div className="bg-white rounded-xl border border-border p-5">
            <h2 className="font-semibold text-[14px] mb-4 flex items-center gap-2">
              <Icon name="CreditCard" size={16} className="text-muted-foreground" />
              Оплата по договору
            </h2>

            {/* Полоса */}
            <div className="space-y-1.5 mb-4">
              <div className="flex justify-between text-[12px] text-muted-foreground">
                <span>Оплачено: <span className="font-semibold text-emerald-600">{fmtMoney(paid_main)}</span></span>
                <span>{paid_pct}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2.5">
                <div
                  className="bg-emerald-500 h-2.5 rounded-full transition-all"
                  style={{ width: `${Math.min(paid_pct, 100)}%` }}
                />
              </div>
            </div>

            {/* Цифры */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-50 rounded-lg p-3">
                <div className="text-[11px] text-muted-foreground mb-1">Оплачено</div>
                <div className="font-bold text-[16px] text-emerald-700">{fmtMoney(paid_main)}</div>
              </div>
              <div className={`rounded-lg p-3 ${balance > 0 ? "bg-amber-50" : "bg-emerald-50"}`}>
                <div className="text-[11px] text-muted-foreground mb-1">Остаток</div>
                <div className={`font-bold text-[16px] ${balance > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                  {balance > 0 ? fmtMoney(balance) : "Оплачено полностью"}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* История платежей */}
        {mainPayments.length > 0 && (
          <div className="bg-white rounded-xl border border-border p-5">
            <h2 className="font-semibold text-[14px] mb-3 flex items-center gap-2">
              <Icon name="Receipt" size={16} className="text-muted-foreground" />
              История платежей
            </h2>
            <div className="divide-y divide-border">
              {mainPayments.map(p => (
                <div key={p.id} className="py-3 flex items-center justify-between gap-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium">{p.description || p.category}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{fmtDate(p.payment_date)} · {p.code}</div>
                  </div>
                  <span className="font-semibold text-[14px] text-emerald-600 shrink-0">+{fmtMoney(p.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Доп. услуги */}
        {extraPayments.length > 0 && (
          <div className="bg-white rounded-xl border border-border p-5">
            <h2 className="font-semibold text-[14px] mb-3 flex items-center gap-2">
              <Icon name="PlusCircle" size={16} className="text-muted-foreground" />
              Дополнительные услуги
              <span className="text-[12px] text-muted-foreground font-normal ml-auto">{fmtMoney(paid_extra)}</span>
            </h2>
            <div className="divide-y divide-border">
              {extraPayments.map(p => (
                <div key={p.id} className="py-3 flex items-center justify-between gap-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium">{p.description || p.category}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{fmtDate(p.payment_date)} · {p.code}</div>
                  </div>
                  <span className="font-semibold text-[14px] text-blue-600 shrink-0">+{fmtMoney(p.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Акты на подпись */}
        {pendingActs.length > 0 && (
          <div className="bg-amber-50 rounded-xl border border-amber-200 p-5">
            <h2 className="font-semibold text-[14px] mb-3 flex items-center gap-2 text-amber-800">
              <Icon name="FileSignature" size={16} />
              Требуют вашей подписи ({pendingActs.length})
            </h2>
            <div className="space-y-3">
              {pendingActs.map(act => (
                <div key={act.id} className="bg-white rounded-lg border border-amber-200 p-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-[13px]">{act.title}</div>
                    <div className="text-[12px] text-muted-foreground mt-0.5">{act.code}</div>
                  </div>
                  <button
                    onClick={() => handleSign(act)}
                    disabled={signing === act.id}
                    className="shrink-0 px-4 py-2 bg-emerald-600 text-white rounded-lg text-[13px] font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {signing === act.id
                      ? <><Icon name="Loader2" size={13} className="animate-spin" /> Подписываем...</>
                      : <><Icon name="Check" size={13} /> Подтвердить</>
                    }
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Подписанные акты */}
        {signedActs.length > 0 && (
          <div className="bg-white rounded-xl border border-border p-5">
            <h2 className="font-semibold text-[14px] mb-3 flex items-center gap-2">
              <Icon name="FileCheck" size={16} className="text-muted-foreground" />
              Подписанные акты
            </h2>
            <div className="divide-y divide-border">
              {signedActs.map(act => (
                <div key={act.id} className="py-3 flex items-center justify-between gap-3 first:pt-0 last:pb-0">
                  <div>
                    <div className="font-medium text-[13px]">{act.title}</div>
                    <div className="text-[12px] text-muted-foreground mt-0.5">{act.code}</div>
                  </div>
                  <span className="text-[11px] px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 font-medium whitespace-nowrap">
                    Подписан {act.signed_at ? fmt(act.signed_at) : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Этапы строительства */}
        {stages.length > 0 && (
          <div className="bg-white rounded-xl border border-border p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-[14px] flex items-center gap-2">
                <Icon name="Layers" size={16} className="text-muted-foreground" />
                Этапы строительства
              </h2>
              <div className="text-[13px] text-muted-foreground">
                {doneStages} из {stages.length} · {buildPct}%
              </div>
            </div>

            <div className="w-full bg-gray-100 rounded-full h-1.5 mb-4">
              <div
                className="bg-primary h-1.5 rounded-full transition-all"
                style={{ width: `${buildPct}%` }}
              />
            </div>

            <div className="space-y-1">
              {(stages as (ClientPortalStage & { effective_status?: string })[]).map(s => {
                const effStatus = s.effective_status || s.status || "pending";
                const cfg = STAGE_CFG[effStatus] || STAGE_CFG["pending"];
                return (
                  <div key={s.id} className={`flex items-start gap-3 py-2.5 px-3 rounded-lg transition-colors ${
                    effStatus === "in_progress" ? "bg-amber-50/60" :
                    effStatus === "overdue"     ? "bg-red-50/60"   : ""
                  }`}>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${cfg.dotCls}`}>
                      {effStatus === "done" && <Icon name="Check" size={11} className="text-white" />}
                      {effStatus === "overdue" && <Icon name="AlertCircle" size={11} className="text-white" />}
                      {effStatus === "in_progress" && <div className="w-2 h-2 bg-white rounded-full" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium">{s.name}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {s.planned_start ? fmt(s.planned_start) : "—"}
                        {s.planned_end   ? ` — ${fmt(s.planned_end)}` : ""}
                      </div>
                    </div>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${cfg.badgeCls}`}>
                      {cfg.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="text-center text-[11px] text-muted-foreground pb-4">
          По вопросам свяжитесь с вашим менеджером
        </div>
      </div>
    </div>
  );
}