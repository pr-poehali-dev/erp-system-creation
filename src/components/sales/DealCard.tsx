import { Deal } from "@/lib/api";
import Icon from "@/components/ui/icon";

const MONTH_NAMES = ["","Янв","Фев","Мар","Апр","Май","Июн","Июл","Авг","Сен","Окт","Ноя","Дек"];
const fmt = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} млн ₽` : `${n.toLocaleString("ru")} ₽`;

interface Props {
  deal: Deal;
  canEdit: boolean;
  onToKp: () => void;
  onToContract: () => void;
  onLost: () => void;
}

export default function DealCard({ deal, canEdit, onToKp, onToContract, onLost }: Props) {
  const isSerial     = deal.project_type === "serial" || !deal.project_type;
  const hasKpData    = !!(deal.configuration_name || deal.selected_stages?.length);
  const hasSlot      = !!deal.slot_id;

  return (
    <div className="bg-white border border-border rounded-xl p-3 hover:border-primary/30 hover:shadow-sm transition-all group">
      {/* Top row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <div className="text-[12px] font-bold text-primary">{deal.code}</div>
          <div className="text-[13px] font-semibold text-foreground leading-tight">{deal.client_name}</div>
          <div className="text-hint text-[11px]">{deal.client_phone}</div>
        </div>
        <div className="text-right shrink-0">
          <span className={`text-[11px] px-1.5 py-0.5 rounded-md font-medium ${
            isSerial ? "bg-blue-50 text-blue-700" : "bg-violet-50 text-violet-700"
          }`}>
            {isSerial ? "Серийный" : "Индивидуальный"}
          </span>
        </div>
      </div>

      {/* Budget */}
      {deal.budget > 0 && (
        <div className="text-[13px] font-semibold text-foreground mb-2">
          {fmt(deal.budget)}
        </div>
      )}

      {/* Serial project + config */}
      {deal.serial_project_name && (
        <div className="text-[11px] text-muted-foreground mb-1 flex items-center gap-1">
          <Icon name="Home" size={10} className="shrink-0" />
          {deal.serial_project_name}
          {deal.configuration_name && (
            <span className="text-hint">· {deal.configuration_name}</span>
          )}
        </div>
      )}

      {/* Slot / date */}
      {deal.slot_month && (
        <div className="text-[11px] text-muted-foreground mb-2 flex items-center gap-1">
          <Icon name="Calendar" size={10} className="shrink-0" />
          Слот: {MONTH_NAMES[deal.slot_month]} {deal.slot_year}
        </div>
      )}
      {deal.address && (
        <div className="text-[11px] text-muted-foreground mb-2 flex items-center gap-1 truncate">
          <Icon name="MapPin" size={10} className="shrink-0" />
          {deal.address}
        </div>
      )}

      {/* Manager */}
      <div className="text-hint text-[11px] mb-2">{deal.manager_name}</div>

      {/* Actions */}
      {canEdit && (
        <div className="border-t border-border pt-2 mt-2 flex gap-1.5 flex-wrap">
          {deal.stage === "lead" && (
            <button onClick={onToKp}
              className="flex items-center gap-1 px-2 py-1 bg-amber-50 border border-amber-200 text-amber-700 rounded-md text-[11px] font-medium hover:bg-amber-100 transition-colors">
              <Icon name="FileText" size={10} />
              Оформить КП
            </button>
          )}
          {deal.stage === "kp" && (
            <button onClick={onToContract}
              className="flex items-center gap-1 px-2 py-1 bg-violet-50 border border-violet-200 text-violet-700 rounded-md text-[11px] font-medium hover:bg-violet-100 transition-colors">
              <Icon name="PenLine" size={10} />
              Подписать договор
            </button>
          )}
          {deal.stage === "kp" && (
            <button onClick={onToKp}
              className="flex items-center gap-1 px-2 py-1 border border-border text-muted-foreground rounded-md text-[11px] hover:bg-secondary transition-colors">
              <Icon name="Edit2" size={10} />
              Ред. КП
            </button>
          )}
          {deal.stage === "contract" && (
            <div className="flex items-center gap-1 px-2 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-md text-[11px] font-medium">
              <Icon name="CheckCircle" size={10} />
              Проект создан
            </div>
          )}
          {deal.stage === "planning" && (
            <div className="flex items-center gap-1 px-2 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-md text-[11px] font-medium">
              <Icon name="Hammer" size={10} />
              В производстве
            </div>
          )}
          {["lead", "kp"].includes(deal.stage) && (
            <button onClick={onLost}
              className="flex items-center gap-1 px-2 py-1 border border-border text-red-400 rounded-md text-[11px] hover:bg-red-50 transition-colors ml-auto">
              <Icon name="X" size={10} />
              Отказ
            </button>
          )}
        </div>
      )}
    </div>
  );
}
