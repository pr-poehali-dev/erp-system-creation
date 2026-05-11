import { useEffect, useState } from "react";
import { api, ClientPortalData, ClientAct, ClientPortalStage } from "@/lib/api";
import Icon from "@/components/ui/icon";
import { PortalTab } from "@/components/portal/portal.shared";
import PortalHeader from "@/components/portal/PortalHeader";
import PortalMainTab from "@/components/portal/PortalMainTab";
import ClientGantt from "@/components/portal/ClientGantt";

interface Props { token: string; }

export default function ClientPortal({ token }: Props) {
  const [data, setData] = useState<ClientPortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [signing, setSigning] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<PortalTab>("main");

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
    try { await api.client_portal.signAct(act.id); load(); }
    finally { setSigning(null); }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#f5f6fa] flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <div className="text-muted-foreground text-sm">Загружаем данные...</div>
      </div>
    </div>
  );

  if (error || !data) return (
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

  const { deal, stages, acts, payments_history, paid_main, paid_extra, balance, paid_pct, budget } = data;

  const pendingActs = acts.filter(a => a.status === "pending_signature");
  const signedActs  = acts.filter(a => a.status !== "pending_signature");

  const _pmh = payments_history || [];
  const mainPayments  = _pmh.filter(p => p.category === "Основной договор");
  const extraPayments = _pmh.filter(p => p.category !== "Основной договор");

  const hasGantt = !!deal.project_id;

  return (
    <div className="min-h-screen bg-[#f5f6fa]">
      <PortalHeader
        clientName={deal.client_name}
        projectStatus={deal.project_status}
        activeTab={activeTab}
        hasGantt={hasGantt}
        pendingActsCount={pendingActs.length}
        onChangeTab={setActiveTab}
      />

      {/* ── Вкладка: Мой дом ── */}
      {activeTab === "main" && (
        <PortalMainTab
          deal={deal}
          stages={stages as (ClientPortalStage & { effective_status?: string })[]}
          pendingActs={pendingActs}
          signedActs={signedActs}
          mainPayments={mainPayments}
          extraPayments={extraPayments}
          paid_main={paid_main}
          paid_extra={paid_extra}
          balance={balance}
          paid_pct={paid_pct}
          budget={budget}
          hasGantt={hasGantt}
          signing={signing}
          onSign={handleSign}
          onGoToPlan={() => setActiveTab("plan")}
        />
      )}

      {/* ── Вкладка: План работ ── */}
      {activeTab === "plan" && deal.project_id && (
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="bg-white rounded-xl border border-border p-5">
            <h2 className="font-semibold text-[14px] mb-4 flex items-center gap-2">
              <Icon name="CalendarCheck" size={16} className="text-muted-foreground" />
              План строительных работ
            </h2>
            <ClientGantt projectId={deal.project_id} />
          </div>
          <div className="mt-4 text-center text-[11px] text-muted-foreground pb-4">
            По вопросам свяжитесь с вашим менеджером
          </div>
        </div>
      )}
    </div>
  );
}
