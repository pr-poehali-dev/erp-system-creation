import { useEffect, useState } from "react";
import { Role } from "@/App";
import Icon from "@/components/ui/icon";
import { api, Deal, Client, Staff, SerialProject, StageDuration, getCurrentUser } from "@/lib/api";
import LeadModal from "@/components/sales/LeadModal";
import KpModal from "@/components/sales/KpModal";
import KpPlanningFlow from "@/components/sales/KpPlanningFlow";
import DealCard from "@/components/sales/DealCard";

interface Props { role: Role; }

const STAGES = [
  { key: "lead",     label: "Новый лид",    color: "bg-blue-500",    light: "bg-blue-50 border-blue-200",     icon: "UserPlus" },
  { key: "kp",       label: "КП отправлено", color: "bg-amber-500",  light: "bg-amber-50 border-amber-200",   icon: "FileText" },
  { key: "planning", label: "Планирование",  color: "bg-emerald-500", light: "bg-emerald-50 border-emerald-200", icon: "CalendarCheck" },
  { key: "closed",   label: "Закрыт",        color: "bg-gray-500",   light: "bg-gray-50 border-gray-200",     icon: "CheckCircle" },
];

// Кто из сотрудников считается «продажником» (видит воронку, может вести сделки)
const SALES_ROLES: Role[] = ["director", "commercial", "crm_manager", "realtor"];

// Для кого показываем переключатель воронок менеджер/риэлтор
const DIRECTOR_ROLES: Role[] = ["director", "commercial"];

type FunnelFilter = "all" | "managers" | "realtors";

export default function Sales({ role }: Props) {
  const [deals, setDeals]                   = useState<Deal[]>([]);
  const [clients, setClients]               = useState<Client[]>([]);
  const [managers, setManagers]             = useState<Staff[]>([]);
  const [realtors, setRealtors]             = useState<Staff[]>([]);
  const [serialProjects, setSerialProjects] = useState<SerialProject[]>([]);
  const [stageDurations, setStageDurations] = useState<StageDuration[]>([]);
  const [loading, setLoading]               = useState(true);

  const [leadModalOpen, setLeadModalOpen]   = useState(false);
  const [kpDeal, setKpDeal]                 = useState<Deal | null>(null);
  const [planningDeal, setPlanningDeal]     = useState<Deal | null>(null);

  const [saving, setSaving]                 = useState(false);
  const [successMsg, setSuccessMsg]         = useState("");
  const [tab, setTab]                       = useState<"funnel" | "archive">("funnel");
  const [funnelFilter, setFunnelFilter]     = useState<FunnelFilter>("all");
  const [archivedDeals, setArchivedDeals]   = useState<Deal[]>([]);
  const [archiveLoading, setArchiveLoading] = useState(false);

  const { userId: currentUserId } = getCurrentUser();

  const notify = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 4000);
  };

  const loadDeals = () => {
    setLoading(true);
    api.deals.list().then(setDeals).finally(() => setLoading(false));
  };

  const loadArchivedDeals = () => {
    setArchiveLoading(true);
    api.deals.listArchived().then(setArchivedDeals).finally(() => setArchiveLoading(false));
  };

  useEffect(() => {
    loadDeals();
    api.clients().then(setClients);
    api.staff("crm_manager").then(setManagers);
    api.staff("realtor").then(setRealtors);
    api.serial_projects.list().then(setSerialProjects);
    api.stage_durations.list().then(setStageDurations);
  }, []);

  useEffect(() => {
    if (tab === "archive") loadArchivedDeals();
  }, [tab]);

  const canEdit = SALES_ROLES.includes(role);
  const isDirectorRole = DIRECTOR_ROLES.includes(role);
  const isRealtor = role === "realtor";
  const isManager = role === "crm_manager";

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

  const handleLost = async (deal: Deal) => {
    if (!confirm(`Перевести "${deal.code}" в отказ?`)) return;
    await api.deals.updateStage(deal.id, "lost");
    loadDeals();
  };

  const handleArchiveDeal = async (deal: Deal) => {
    const hasSlot = !!(deal.slot_id || deal.kp_slot_id);
    const msg = hasSlot
      ? `Архивировать сделку "${deal.code}"?\n\nПривязанный производственный слот будет освобождён.`
      : `Архивировать сделку "${deal.code}"?`;
    if (!confirm(msg)) return;
    await api.deals.archive(deal.id);
    loadDeals();
    notify(hasSlot ? `Сделка ${deal.code} перемещена в архив, слот освобождён` : `Сделка ${deal.code} перемещена в архив`);
  };

  const handleRestoreDeal = async (deal: Deal) => {
    await api.deals.restore(deal.id);
    loadArchivedDeals();
    notify(`Сделка ${deal.code} восстановлена`);
  };

  const handleDeleteDeal = async (deal: Deal) => {
    const hasSlot = !!(deal.slot_id || deal.kp_slot_id);
    const msg = hasSlot
      ? `Удалить сделку "${deal.code}"? Действие необратимо!\n\nПривязанный производственный слот будет освобождён.`
      : `Удалить сделку "${deal.code}"? Действие необратимо!`;
    if (!confirm(msg)) return;
    await api.deals.delete(deal.id);
    loadDeals();
    notify(hasSlot ? `Сделка ${deal.code} удалена, слот освобождён` : `Сделка ${deal.code} удалена`);
  };

  // Фильтрация по воронкам
  const activeDeals = deals.filter(d => d.stage !== "lost");
  const lostDeals   = deals.filter(d => d.stage === "lost");

  // Применяем фильтр воронки (только для директора/commercial)
  const filteredDeals = (() => {
    if (!isDirectorRole) return activeDeals;
    if (funnelFilter === "managers") return activeDeals.filter(d => d.realtor_id == null);
    if (funnelFilter === "realtors") return activeDeals.filter(d => d.realtor_id != null);
    return activeDeals;
  })();

  const dealsByStage = (stage: string) => filteredDeals.filter(d => d.stage === stage);
  const totalBudget  = (stage: string) => dealsByStage(stage).reduce((s, d) => s + (d.budget || 0), 0);
  const fmt = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} млн ₽` : `${n.toLocaleString("ru")} ₽`;

  // Статистика воронки
  const totalActive  = filteredDeals.length;
  const totalRevenue = filteredDeals.filter(d => d.stage === "closed").reduce((s, d) => s + (d.budget || 0), 0);

  // Заголовок в зависимости от роли
  const pageTitle = isRealtor ? "Мои сделки" : "Продажи и CRM";
  const pageSubtitle = isRealtor
    ? `Мои сделки · ${totalActive} активных`
    : isDirectorRole && funnelFilter === "realtors"
      ? `Воронка риэлторов · ${totalActive} активных`
      : isDirectorRole && funnelFilter === "managers"
        ? `Воронка менеджеров · ${totalActive} активных`
        : `Воронка продаж · ${totalActive} активных`;

  return (
    <div className="space-y-6 max-w-[1600px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{pageTitle}</h1>
          <p className="text-hint mt-0.5">{pageSubtitle}{totalRevenue > 0 ? ` · ${fmt(totalRevenue)} закрыто` : ""}</p>
        </div>
        {canEdit && tab === "funnel" && (
          <button
            onClick={() => setLeadModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors"
          >
            <Icon name="Plus" size={14} />
            Новый лид
          </button>
        )}
      </div>

      {/* Вкладки + переключатель воронок */}
      <div className="flex items-center border-b border-border gap-1">
        <button
          onClick={() => setTab("funnel")}
          className={`flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${
            tab === "funnel" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}>
          <Icon name="Kanban" size={14} />
          Воронка продаж
        </button>
        {(isDirectorRole || isManager) && (
          <button
            onClick={() => setTab("archive")}
            className={`flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${
              tab === "archive" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            <Icon name="Archive" size={14} />
            Архив сделок
            {tab === "archive" && archivedDeals.length > 0 && (
              <span className="text-[11px] px-1.5 py-0.5 rounded-full font-bold bg-secondary text-muted-foreground">
                {archivedDeals.length}
              </span>
            )}
          </button>
        )}

        {/* Переключатель воронок: Все / Менеджеры / Риэлторы — только для директора/commercial */}
        {isDirectorRole && tab === "funnel" && (
          <div className="ml-auto flex items-center gap-1 pb-1">
            {([
              { key: "all"      as FunnelFilter, label: "Все",        icon: "LayoutGrid" },
              { key: "managers" as FunnelFilter, label: "Менеджеры",  icon: "Briefcase" },
              { key: "realtors" as FunnelFilter, label: "Риэлторы",   icon: "UserSquare" },
            ]).map(f => (
              <button key={f.key}
                onClick={() => setFunnelFilter(f.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-lg transition-colors ${
                  funnelFilter === f.key
                    ? "bg-primary text-white"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}>
                <Icon name={f.icon} size={12} />
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Плашка с меткой воронки для директора */}
      {isDirectorRole && funnelFilter !== "all" && tab === "funnel" && (
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-[12px] text-blue-700">
          <Icon name={funnelFilter === "managers" ? "Briefcase" : "UserSquare"} size={13} />
          Отображены только сделки {funnelFilter === "managers" ? "менеджеров (без риэлтора)": "риэлторов"}
          <button onClick={() => setFunnelFilter("all")} className="ml-auto text-blue-500 hover:text-blue-700">
            <Icon name="X" size={12} />
          </button>
        </div>
      )}

      {/* Success notification */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-5 py-3 flex items-center gap-2 animate-fade-in">
          <Icon name="CheckCircle" size={15} className="text-emerald-600 shrink-0" />
          <span className="text-[13px] text-emerald-800">{successMsg}</span>
        </div>
      )}

      {/* Архив сделок */}
      {tab === "archive" && (
        <div className="space-y-3">
          {archiveLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-secondary rounded-xl animate-pulse" />)}</div>
          ) : archivedDeals.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-border p-12 flex flex-col items-center gap-3 text-muted-foreground">
              <Icon name="Archive" size={32} />
              <span className="text-[14px] font-medium">Архив пуст</span>
              <span className="text-hint text-center">Заархивированные сделки появятся здесь</span>
            </div>
          ) : (
            <>
              <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-2">
                <Icon name="Archive" size={14} className="text-muted-foreground" />
                <span className="text-[13px] text-muted-foreground font-medium">
                  Архив: {archivedDeals.length} сделок на {fmt(archivedDeals.reduce((s, d) => s + (d.budget || 0), 0))}
                </span>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {archivedDeals.map(deal => (
                  <DealCard
                    key={deal.id}
                    deal={deal}
                    canEdit={false}
                    isArchiveView
                    onToKp={() => {}}
                    onLost={() => {}}
                    onRestore={isDirectorRole ? () => handleRestoreDeal(deal) : undefined}
                    onDelete={isDirectorRole ? () => handleDeleteDeal(deal) : undefined}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Воронка — 4 колонки */}
      {tab === "funnel" && loading && (
        <div className="grid grid-cols-4 gap-4">
          {STAGES.map(s => (
            <div key={s.key} className="bg-white rounded-xl border border-border p-4 space-y-3">
              <div className="h-4 bg-secondary rounded animate-pulse w-3/4" />
              {[1, 2].map(i => <div key={i} className="h-24 bg-secondary rounded-xl animate-pulse" />)}
            </div>
          ))}
        </div>
      )}
      {tab === "funnel" && !loading && (
        <div className="grid grid-cols-4 gap-4 items-start">
          {STAGES.map(stage => {
            const stageDealList = dealsByStage(stage.key);
            return (
              <div key={stage.key} className="bg-white rounded-xl border border-border overflow-hidden">
                {/* Column header */}
                <div className="px-4 py-3 border-b border-border">
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
                        onToPlanning={() => setPlanningDeal(deal)}
                        onLost={() => handleLost(deal)}
                        onArchive={isDirectorRole ? () => handleArchiveDeal(deal) : undefined}
                        onDelete={isDirectorRole ? () => handleDeleteDeal(deal) : undefined}
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
      {tab === "funnel" && lostDeals.length > 0 && (
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
          onClientCreated={c => setClients(prev => [...prev, c].sort((a, b) => a.name.localeCompare(b.name)))}
          presetRealtorId={isRealtor ? currentUserId : undefined}
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

      {planningDeal && (
        <KpPlanningFlow
          deal={planningDeal}
          role={role}
          cfgDur={planningDeal.configuration_duration || 115}
          onDone={() => { setPlanningDeal(null); loadDeals(); notify("Обновлено"); }}
          onClose={() => setPlanningDeal(null)}
        />
      )}
    </div>
  );
}
