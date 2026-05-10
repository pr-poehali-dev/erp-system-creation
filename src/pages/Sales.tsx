import { useEffect, useState } from "react";
import { Role } from "@/App";
import Icon from "@/components/ui/icon";
import { api, Deal, Client, Staff, SerialProject, StageDuration, getCurrentUser } from "@/lib/api";
import LeadModal from "@/components/sales/LeadModal";
import KpModal from "@/components/sales/KpModal";
import KpPlanningFlow from "@/components/sales/KpPlanningFlow";
import SalesHeader from "@/components/sales/SalesHeader";
import SalesActiveBoard from "@/components/sales/SalesActiveBoard";
import SalesClosedTable from "@/components/sales/SalesClosedTable";
import SalesArchiveList from "@/components/sales/SalesArchiveList";
import { SALES_ROLES, DIRECTOR_ROLES, StatusFilter, FunnelFilter } from "@/components/sales/sales.shared";

interface Props { role: Role; userId?: number | null; }

export default function Sales({ role, userId }: Props) {
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
  const [statusFilter, setStatusFilter]     = useState<StatusFilter>("active");
  const [funnelFilter, setFunnelFilter]     = useState<FunnelFilter>("all");
  const [archivedDeals, setArchivedDeals]   = useState<Deal[]>([]);
  const [archiveLoading, setArchiveLoading] = useState(false);

  const { userId: currentUserId } = getCurrentUser();

  const notify = (msg: string) => {
    setSuccessMsg(msg);
  };

  // Cleanup для notify — таймер сбрасывается при unmount
  useEffect(() => {
    if (!successMsg) return;
    const t = setTimeout(() => setSuccessMsg(""), 4000);
    return () => clearTimeout(t);
  }, [successMsg]);

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
  }, [role, userId]);

  useEffect(() => {
    if (statusFilter === "archived") loadArchivedDeals();
  }, [statusFilter]);

  useEffect(() => {
    api.clients().then(setClients);
    api.staff("crm_manager").then(setManagers);
    api.staff("realtor").then(setRealtors);
    api.serial_projects.list().then(setSerialProjects);
    api.stage_durations.list().then(setStageDurations);
  }, []);

  const canEdit        = SALES_ROLES.includes(role);
  const isDirectorRole = DIRECTOR_ROLES.includes(role);
  const isRealtor      = role === "realtor";
  const isManager      = role === "crm_manager";

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
    setSaving(true);
    try {
      await api.deals.updateStage(deal.id, "lost");
      loadDeals();
      notify(`${deal.code} переведена в отказ`);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Не удалось перевести сделку в отказ");
    } finally { setSaving(false); }
  };

  const handleArchiveDeal = async (deal: Deal) => {
    const hasSlot = !!(deal.slot_id || deal.kp_slot_id);
    const msg = hasSlot
      ? `Архивировать "${deal.code}"?\n\nПривязанный производственный слот будет освобождён.`
      : `Архивировать сделку "${deal.code}"?`;
    if (!confirm(msg)) return;
    setSaving(true);
    try {
      await api.deals.archive(deal.id);
      loadDeals();
      notify(hasSlot ? `${deal.code} перемещена в архив, слот освобождён` : `${deal.code} перемещена в архив`);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Не удалось архивировать сделку");
    } finally { setSaving(false); }
  };

  const handleRestoreDeal = async (deal: Deal) => {
    await api.deals.restore(deal.id);
    loadArchivedDeals();
    notify(`Сделка ${deal.code} восстановлена`);
  };

  const handleDeleteDeal = async (deal: Deal) => {
    const hasSlot = !!(deal.slot_id || deal.kp_slot_id);
    const msg = hasSlot
      ? `Удалить "${deal.code}"? Необратимо!\n\nСлот будет освобождён.`
      : `Удалить сделку "${deal.code}"? Необратимо!`;
    if (!confirm(msg)) return;
    setSaving(true);
    try {
      await api.deals.delete(deal.id);
      loadDeals();
      notify(hasSlot ? `${deal.code} удалена, слот освобождён` : `${deal.code} удалена`);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Не удалось удалить сделку");
    } finally { setSaving(false); }
  };

  // Разбиваем сделки по статусу
  const activeDeals = deals.filter(d => !["lost", "closed"].includes(d.stage));
  const closedDeals = deals.filter(d => d.stage === "closed");
  const lostDeals   = deals.filter(d => d.stage === "lost");

  // Применяем фильтр по воронке (менеджеры / риэлторы) для директора
  const applyFunnelFilter = (list: Deal[]) => {
    if (!isDirectorRole) return list;
    if (funnelFilter === "managers") return list.filter(d => d.realtor_id == null);
    if (funnelFilter === "realtors") return list.filter(d => d.realtor_id != null);
    return list;
  };

  const visibleActive = applyFunnelFilter(activeDeals);
  const visibleClosed = applyFunnelFilter(closedDeals);

  const pageTitle = isRealtor ? "Мои сделки" : "Продажи и CRM";

  // isManager сохранена для совместимости с прежней логикой видимости (используется в дочерних компонентах при необходимости)
  void isManager;

  return (
    <div className="space-y-6 max-w-[1600px]">
      <SalesHeader
        pageTitle={pageTitle}
        statusFilter={statusFilter}
        funnelFilter={funnelFilter}
        visibleActive={visibleActive}
        visibleClosed={visibleClosed}
        archivedDeals={archivedDeals}
        canEdit={canEdit}
        isDirectorRole={isDirectorRole}
        onChangeStatus={setStatusFilter}
        onChangeFunnel={setFunnelFilter}
        onCreateLead={() => setLeadModalOpen(true)}
      />

      {/* Success notification */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-5 py-3 flex items-center gap-2 animate-fade-in">
          <Icon name="CheckCircle" size={15} className="text-emerald-600 shrink-0" />
          <span className="text-[13px] text-emerald-800">{successMsg}</span>
        </div>
      )}

      {/* ── АКТИВНЫЕ: Kanban ── */}
      {statusFilter === "active" && (
        <SalesActiveBoard
          loading={loading}
          visibleActive={visibleActive}
          lostDeals={lostDeals}
          canEdit={canEdit}
          isDirectorRole={isDirectorRole}
          onCreateLead={() => setLeadModalOpen(true)}
          onToKp={(deal) => setKpDeal(deal)}
          onToPlanning={(deal) => setPlanningDeal(deal)}
          onLost={handleLost}
          onArchive={handleArchiveDeal}
          onDelete={handleDeleteDeal}
        />
      )}

      {/* ── ЗАКРЫТЫЕ: таблица ── */}
      {statusFilter === "closed" && (
        <SalesClosedTable loading={loading} visibleClosed={visibleClosed} />
      )}

      {/* ── АРХИВ ── */}
      {statusFilter === "archived" && (
        <SalesArchiveList
          archiveLoading={archiveLoading}
          archivedDeals={archivedDeals}
          isDirectorRole={isDirectorRole}
          onRestore={handleRestoreDeal}
          onDelete={handleDeleteDeal}
        />
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
