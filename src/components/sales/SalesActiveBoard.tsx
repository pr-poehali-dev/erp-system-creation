import Icon from "@/components/ui/icon";
import { Deal } from "@/lib/api";
import DealCard from "@/components/sales/DealCard";
import { KANBAN_STAGES, fmt } from "./sales.shared";

interface Props {
  loading: boolean;
  visibleActive: Deal[];
  lostDeals: Deal[];
  canEdit: boolean;
  isDirectorRole: boolean;
  onCreateLead: () => void;
  onToKp: (deal: Deal) => void;
  onToPlanning: (deal: Deal) => void;
  onLost: (deal: Deal) => void;
  onArchive: (deal: Deal) => void;
  onDelete: (deal: Deal) => void;
}

export default function SalesActiveBoard({
  loading,
  visibleActive,
  lostDeals,
  canEdit,
  isDirectorRole,
  onCreateLead,
  onToKp,
  onToPlanning,
  onLost,
  onArchive,
  onDelete,
}: Props) {
  // contract — устаревший промежуточный статус, отображаем в колонке planning
  const dealsByStage = (stage: string) =>
    stage === "planning"
      ? visibleActive.filter(d => d.stage === "planning" || d.stage === "contract")
      : visibleActive.filter(d => d.stage === stage);
  const totalBudget = (stage: string) => dealsByStage(stage).reduce((s, d) => s + (d.budget || 0), 0);

  return (
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
                        onToKp={() => onToKp(deal)}
                        onToPlanning={() => onToPlanning(deal)}
                        onLost={() => onLost(deal)}
                        onArchive={isDirectorRole ? () => onArchive(deal) : undefined}
                        onDelete={isDirectorRole ? () => onDelete(deal) : undefined}
                      />
                    ))
                  )}
                </div>
                {stage.key === "lead" && canEdit && (
                  <div className="px-3 pb-3">
                    <button
                      onClick={onCreateLead}
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
  );
}
