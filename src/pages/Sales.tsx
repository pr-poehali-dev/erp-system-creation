import { useEffect, useState } from "react";
import { Role } from "@/App";
import Icon from "@/components/ui/icon";
import { api, Deal, Client, Staff, SerialProject, StageDuration, getCurrentUser } from "@/lib/api";
import LeadModal from "@/components/sales/LeadModal";
import KpModal from "@/components/sales/KpModal";
import KpPlanningFlow from "@/components/sales/KpPlanningFlow";
import DealCard from "@/components/sales/DealCard";

interface Props { role: Role; userId?: number | null; }

const KANBAN_STAGES = [
  { key: "lead",     label: "Новый лид",     color: "bg-blue-500",    icon: "UserPlus" },
  { key: "kp",       label: "КП отправлено", color: "bg-amber-500",   icon: "FileText" },
  { key: "planning", label: "Планирование",  color: "bg-emerald-500", icon: "CalendarCheck" },
];

const SALES_ROLES: Role[] = ["director", "commercial", "crm_manager", "realtor"];
const DIRECTOR_ROLES: Role[] = ["director", "commercial"];

type StatusFilter = "active" | "closed" | "archived";
type FunnelFilter = "all" | "managers" | "realtors";

const fmt = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} млн ₽` : `${n.toLocaleString("ru")} ₽`;

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

  // contract — устаревший промежуточный статус, отображаем в колонке planning
  const dealsByStage = (stage: string) =>
    stage === "planning"
      ? visibleActive.filter(d => d.stage === "planning" || d.stage === "contract")
      : visibleActive.filter(d => d.stage === stage);
  const totalBudget  = (stage: string) => dealsByStage(stage).reduce((s, d) => s + (d.budget || 0), 0);

  const pageTitle = isRealtor ? "Мои сделки" : "Продажи и CRM";

  const STATUS_TABS: { key: StatusFilter; label: string; icon: string; count: number }[] = [
    { key: "active",   label: "Активные",   icon: "Kanban",  count: applyFunnelFilter(activeDeals).length },
    { key: "closed",   label: "Закрытые",   icon: "CheckCircle2", count: applyFunnelFilter(closedDeals).length },
    { key: "archived", label: "Архив",      icon: "Archive", count: archivedDeals.length },
  ];

  return (
    <div className="space-y-6 max-w-[1600px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{pageTitle}</h1>
          <p className="text-hint mt-0.5">
            {statusFilter === "active"
              ? `${visibleActive.length} активных сделок`
              : statusFilter === "closed"
                ? `${visibleClosed.length} закрытых · ${fmt(visibleClosed.reduce((s, d) => s + (d.budget || 0), 0))}`
                : `${archivedDeals.length} в архиве`}
          </p>
        </div>
        {canEdit && statusFilter === "active" && (
          <button
            onClick={() => setLeadModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors"
          >
            <Icon name="Plus" size={14} />
            Новый лид
          </button>
        )}
      </div>

      {/* Вкладки: Активные / Закрытые / Архив + переключатель воронок */}
      <div className="flex items-center border-b border-border gap-1">
        {STATUS_TABS.map(t => (
          <button key={t.key}
            onClick={() => setStatusFilter(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${
              statusFilter === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            <Icon name={t.icon} size={14} />
            {t.label}
            {t.count > 0 && (
              <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${
                statusFilter === t.key ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}

        {/* Переключатель воронок только для директора в активных */}
        {isDirectorRole && statusFilter !== "archived" && (
          <div className="ml-auto flex items-center gap-1 pb-1">
            {([
              { key: "all"      as FunnelFilter, label: "Все",       icon: "LayoutGrid" },
              { key: "managers" as FunnelFilter, label: "Менеджеры", icon: "Briefcase" },
              { key: "realtors" as FunnelFilter, label: "Риэлторы",  icon: "UserSquare" },
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

      {/* Success notification */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-5 py-3 flex items-center gap-2 animate-fade-in">
          <Icon name="CheckCircle" size={15} className="text-emerald-600 shrink-0" />
          <span className="text-[13px] text-emerald-800">{successMsg}</span>
        </div>
      )}

      {/* ── АКТИВНЫЕ: Kanban ── */}
      {statusFilter === "active" && (
        <>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {KANBAN_STAGES.map(s => (
                <div key={s.key} className="bg-white rounded-xl border border-border p-4 space-y-3">
                  <div className="h-4 bg-secondary rounded animate-pulse w-3/4" />
                  {[1, 2].map(i => <div key={i} className="h-24 bg-secondary rounded-xl animate-pulse" />)}
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
              {KANBAN_STAGES.map(stage => {
                const stageDealList = dealsByStage(stage.key);
                return (
                  <div key={stage.key} className="bg-white rounded-xl border border-border overflow-hidden">
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
          {!loading && lostDeals.length > 0 && (
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
                    {deal.budget > 0 && <div className="text-[11px] text-hint mt-0.5">{fmt(deal.budget)}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── ЗАКРЫТЫЕ: таблица ── */}
      {statusFilter === "closed" && (
        <div className="space-y-3">
          {loading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-secondary rounded-xl animate-pulse" />)}</div>
          ) : visibleClosed.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-border p-12 flex flex-col items-center gap-3 text-muted-foreground">
              <Icon name="CheckCircle2" size={32} />
              <span className="text-[14px] font-medium">Закрытых сделок пока нет</span>
            </div>
          ) : (
            <div className="bg-white border border-border rounded-xl overflow-hidden">
              {/* Итоговая строка */}
              <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-200 flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Icon name="CheckCircle2" size={14} className="text-emerald-600" />
                  <span className="text-[13px] font-semibold text-emerald-800">
                    {visibleClosed.length} закрытых сделок
                  </span>
                </div>
                <div className="text-[13px] text-emerald-700">
                  Выручка: <b>{fmt(visibleClosed.reduce((s, d) => s + (d.budget || 0), 0))}</b>
                </div>
                {visibleClosed.some(d => d.commission_amount != null) && (
                  <div className="text-[13px] text-emerald-700">
                    Комиссии: <b>{fmt(visibleClosed.reduce((s, d) => s + (d.commission_amount || 0), 0))}</b>
                  </div>
                )}
              </div>
              <table className="w-full">
                <thead>
                  <tr className="bg-secondary/50 text-left text-[11px] uppercase text-hint">
                    <th className="px-4 py-2.5 font-medium">Код</th>
                    <th className="px-4 py-2.5 font-medium">Клиент</th>
                    <th className="px-4 py-2.5 font-medium">Проект</th>
                    <th className="px-4 py-2.5 font-medium">Менеджер / Риэлтор</th>
                    <th className="px-4 py-2.5 font-medium text-right">Сумма</th>
                    <th className="px-4 py-2.5 font-medium text-right">Комиссия</th>
                    <th className="px-4 py-2.5 font-medium text-right">Дата</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleClosed.map(d => (
                    <tr key={d.id} className="border-t border-border hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3 text-[13px] font-bold text-primary">{d.code}</td>
                      <td className="px-4 py-3 text-[13px]">
                        <div className="font-medium">{d.client_name}</div>
                        <div className="text-hint text-[11px]">{d.client_phone}</div>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-muted-foreground">
                        {d.serial_project_name || (d.project_type === "individual" ? "Индивидуальный" : "—")}
                      </td>
                      <td className="px-4 py-3 text-[12px]">
                        <div>{d.manager_name || "—"}</div>
                        {d.realtor_name && <div className="text-hint text-[11px]">риэлтор: {d.realtor_name}</div>}
                      </td>
                      <td className="px-4 py-3 text-[13px] font-semibold text-right">
                        {d.budget ? fmt(d.budget) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {d.commission_amount != null ? (
                          <>
                            <div className="text-[13px] font-bold text-emerald-600">{fmt(d.commission_amount)}</div>
                            <div className="text-[10px] text-hint">{d.commission_rate}%</div>
                          </>
                        ) : (
                          <span className="text-hint text-[12px]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-hint text-right">
                        {d.closed_at ? new Date(d.closed_at).toLocaleDateString("ru") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── АРХИВ ── */}
      {statusFilter === "archived" && (
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
                  Архив: {archivedDeals.length} сделок · {fmt(archivedDeals.reduce((s, d) => s + (d.budget || 0), 0))}
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