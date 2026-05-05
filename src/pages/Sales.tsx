import { useEffect, useState } from "react";
import { Role } from "@/App";
import Icon from "@/components/ui/icon";
import { api, Deal, Client, Staff, SerialProject, StageDuration } from "@/lib/api";
import LeadModal from "@/components/sales/LeadModal";
import KpModal from "@/components/sales/KpModal";
import ContractModal from "@/components/sales/ContractModal";
import DealCard from "@/components/sales/DealCard";

interface Props { role: Role; }

// Воронка: 4 стадии (без "Квалификация")
const STAGES = [
  { key: "lead",     label: "Новые лиды",        color: "bg-blue-500",    light: "bg-blue-50 border-blue-200",   icon: "UserPlus" },
  { key: "kp",       label: "КП отправлено",      color: "bg-amber-500",   light: "bg-amber-50 border-amber-200", icon: "FileText" },
  { key: "contract", label: "Договор подписан",   color: "bg-violet-500",  light: "bg-violet-50 border-violet-200", icon: "PenLine" },
  { key: "planning", label: "Планирование",        color: "bg-emerald-500", light: "bg-emerald-50 border-emerald-200", icon: "CalendarCheck" },
];

export default function Sales({ role }: Props) {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [managers, setManagers] = useState<Staff[]>([]);
  const [realtors, setRealtors] = useState<Staff[]>([]);
  const [serialProjects, setSerialProjects] = useState<SerialProject[]>([]);
  const [stageDurations, setStageDurations] = useState<StageDuration[]>([]);
  const [loading, setLoading] = useState(true);

  // Модалки
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [kpDeal, setKpDeal] = useState<Deal | null>(null);
  const [contractDeal, setContractDeal] = useState<Deal | null>(null);

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const notify = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 4000);
  };

  const loadDeals = () => {
    setLoading(true);
    api.deals.list().then(setDeals).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDeals();
    api.clients().then(setClients);
    api.staff("crm_manager").then(setManagers);
    api.staff("realtor").then(setRealtors);
    api.serial_projects.list().then(setSerialProjects);
    api.stage_durations.list().then(setStageDurations);
  }, []);

  const canEdit = ["director", "commercial", "crm_manager", "realtor"].includes(role);

  // Обработчики
  const handleCreateLead = async (body: object) => {
    setSaving(true);
    try {
      await api.deals.create(body);
      setLeadModalOpen(false);
      loadDeals();
      notify("Лид создан");
    } finally { setSaving(false); }
  };

  const handleSaveKp = async (deal: Deal, body: object) => {
    setSaving(true);
    try {
      await api.deals.toKp(deal.id, body);
      setKpDeal(null);
      loadDeals();
      notify("КП сохранено");
    } finally { setSaving(false); }
  };

  const handleSignContract = async (deal: Deal, body: object) => {
    setSaving(true);
    try {
      await api.deals.toContract(deal.id, body);
      setContractDeal(null);
      loadDeals();
      notify("Договор подписан — проект создан автоматически");
    } finally { setSaving(false); }
  };

  const handleLost = async (deal: Deal) => {
    if (!confirm(`Перевести "${deal.code}" в отказ?`)) return;
    await api.deals.updateStage(deal.id, "lost");
    loadDeals();
  };

  // Фильтруем lost
  const activeDeals = deals.filter(d => d.stage !== "lost");
  const lostDeals   = deals.filter(d => d.stage === "lost");

  const dealsByStage = (stage: string) => activeDeals.filter(d => d.stage === stage);
  const totalBudget  = (stage: string) => dealsByStage(stage).reduce((s, d) => s + (d.budget || 0), 0);
  const fmt = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} млн ₽` : `${n.toLocaleString("ru")} ₽`;

  return (
    <div className="space-y-6 max-w-[1600px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Продажи и CRM</h1>
          <p className="text-hint mt-0.5">Воронка продаж · {activeDeals.length} активных сделок</p>
        </div>
        {canEdit && (
          <button
            onClick={() => setLeadModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors"
          >
            <Icon name="Plus" size={14} />
            Новый лид
          </button>
        )}
      </div>

      {/* Success notification */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-5 py-3 flex items-center gap-2 animate-fade-in">
          <Icon name="CheckCircle" size={15} className="text-emerald-600 shrink-0" />
          <span className="text-[13px] text-emerald-800">{successMsg}</span>
        </div>
      )}

      {/* Воронка — 4 колонки */}
      {loading ? (
        <div className="grid grid-cols-4 gap-4">
          {STAGES.map(s => (
            <div key={s.key} className="bg-white rounded-xl border border-border p-4 space-y-3">
              <div className="h-4 bg-secondary rounded animate-pulse w-3/4" />
              {[1, 2].map(i => <div key={i} className="h-24 bg-secondary rounded-xl animate-pulse" />)}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-4 items-start">
          {STAGES.map(stage => {
            const stageDealList = dealsByStage(stage.key);
            return (
              <div key={stage.key} className="bg-white rounded-xl border border-border overflow-hidden">
                {/* Column header */}
                <div className={`px-4 py-3 border-b border-border`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${stage.color}`} />
                      <span className="text-[13px] font-semibold">{stage.label}</span>
                    </div>
                    <span className="text-[11px] bg-secondary text-muted-foreground rounded-full px-2 py-0.5 font-medium">
                      {stageDealList.length}
                    </span>
                  </div>
                  {stageDealList.length > 0 && (
                    <div className="text-hint text-[11px] mt-1">{fmt(totalBudget(stage.key))}</div>
                  )}
                </div>

                {/* Cards */}
                <div className="p-3 space-y-2 min-h-[80px]">
                  {stageDealList.length === 0 ? (
                    <div className="text-center text-hint text-[12px] py-6">Пусто</div>
                  ) : (
                    stageDealList.map(deal => (
                      <DealCard
                        key={deal.id}
                        deal={deal}
                        canEdit={canEdit}
                        onToKp={() => setKpDeal(deal)}
                        onToContract={() => setContractDeal(deal)}
                        onLost={() => handleLost(deal)}
                      />
                    ))
                  )}
                </div>

                {/* Add button for lead stage */}
                {stage.key === "lead" && canEdit && (
                  <div className="px-3 pb-3">
                    <button
                      onClick={() => setLeadModalOpen(true)}
                      className="w-full flex items-center justify-center gap-1.5 py-2 border border-dashed border-border rounded-lg text-[12px] text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
                    >
                      <Icon name="Plus" size={12} />
                      Добавить лид
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Отказы */}
      {lostDeals.length > 0 && (
        <div className="bg-white rounded-xl border border-border">
          <div className="px-5 py-3 border-b border-border flex items-center gap-2">
            <Icon name="XCircle" size={14} className="text-muted-foreground" />
            <span className="text-[13px] font-medium text-muted-foreground">Отказы ({lostDeals.length})</span>
          </div>
          <div className="p-4 grid grid-cols-2 gap-2 md:grid-cols-3">
            {lostDeals.map(deal => (
              <div key={deal.id} className="px-3 py-2 border border-border rounded-lg opacity-60">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-medium">{deal.code}</span>
                  <span className="text-[11px] text-hint">{deal.client_name}</span>
                </div>
                {deal.budget > 0 && (
                  <div className="text-[11px] text-hint mt-0.5">{fmt(deal.budget)}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* МОДАЛКИ */}
      {leadModalOpen && (
        <LeadModal
          clients={clients}
          managers={managers}
          realtors={realtors}
          serialProjects={serialProjects}
          saving={saving}
          onClose={() => setLeadModalOpen(false)}
          onSubmit={handleCreateLead}
        />
      )}

      {kpDeal && (
        <KpModal
          deal={kpDeal}
          serialProjects={serialProjects}
          stageDurations={stageDurations}
          saving={saving}
          onClose={() => setKpDeal(null)}
          onSubmit={(body) => handleSaveKp(kpDeal, body)}
        />
      )}

      {contractDeal && (
        <ContractModal
          deal={contractDeal}
          role={role}
          saving={saving}
          onClose={() => setContractDeal(null)}
          onSubmit={(body) => handleSignContract(contractDeal, body)}
        />
      )}
    </div>
  );
}