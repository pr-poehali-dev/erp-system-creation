import Icon from "@/components/ui/icon";
import { Deal } from "@/lib/api";
import DealCard from "@/components/sales/DealCard";
import { fmt } from "./sales.shared";

interface Props {
  archiveLoading: boolean;
  archivedDeals: Deal[];
  isDirectorRole: boolean;
  onRestore: (deal: Deal) => void;
  onDelete: (deal: Deal) => void;
}

export default function SalesArchiveList({
  archiveLoading,
  archivedDeals,
  isDirectorRole,
  onRestore,
  onDelete,
}: Props) {
  return (
    <div className="space-y-3">
      {archiveLoading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-16 bg-secondary rounded-xl animate-pulse" />)}</div>
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
                onRestore={isDirectorRole ? () => onRestore(deal) : undefined}
                onDelete={isDirectorRole ? () => onDelete(deal) : undefined}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
