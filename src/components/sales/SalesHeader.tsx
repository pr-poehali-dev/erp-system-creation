import Icon from "@/components/ui/icon";
import { Deal } from "@/lib/api";
import { StatusFilter, FunnelFilter, fmt } from "./sales.shared";

interface Props {
  pageTitle: string;
  statusFilter: StatusFilter;
  funnelFilter: FunnelFilter;
  visibleActive: Deal[];
  visibleClosed: Deal[];
  archivedDeals: Deal[];
  canEdit: boolean;
  isDirectorRole: boolean;
  onChangeStatus: (s: StatusFilter) => void;
  onChangeFunnel: (f: FunnelFilter) => void;
  onCreateLead: () => void;
}

export default function SalesHeader({
  pageTitle,
  statusFilter,
  funnelFilter,
  visibleActive,
  visibleClosed,
  archivedDeals,
  canEdit,
  isDirectorRole,
  onChangeStatus,
  onChangeFunnel,
  onCreateLead,
}: Props) {
  const STATUS_TABS: { key: StatusFilter; label: string; icon: string; count: number }[] = [
    { key: "active",   label: "Активные",   icon: "Kanban",       count: visibleActive.length },
    { key: "closed",   label: "Закрытые",   icon: "CheckCircle2", count: visibleClosed.length },
    { key: "archived", label: "Архив",      icon: "Archive",      count: archivedDeals.length },
  ];

  return (
    <>
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
            onClick={onCreateLead}
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
            onClick={() => onChangeStatus(t.key)}
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
                onClick={() => onChangeFunnel(f.key)}
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
    </>
  );
}
