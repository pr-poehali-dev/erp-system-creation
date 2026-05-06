import { Deal } from "@/lib/api";
import Icon from "@/components/ui/icon";

const MONTH_NAMES = ["","Янв","Фев","Мар","Апр","Май","Июн","Июл","Авг","Сен","Окт","Ноя","Дек"];
const fmt = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} млн ₽` : `${n.toLocaleString("ru")} ₽`;

const CONTRACT_STATUS_BADGE: Record<string, { label: string; cls: string; icon: string }> = {
  docs_uploaded:     { label: "Загружен",           cls: "bg-blue-50 text-blue-700 border-blue-200",          icon: "Upload" },
  docs_review:       { label: "На проверке",         cls: "bg-amber-50 text-amber-700 border-amber-200",       icon: "Clock" },
  docs_approved:     { label: "Одобрено",            cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: "CheckCircle" },
  payment_pending:   { label: "Ожидание оплаты",     cls: "bg-violet-50 text-violet-700 border-violet-200",    icon: "Wallet" },
  payment_confirmed: { label: "Оплата подтверждена", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: "BadgeCheck" },
};

interface Props {
  deal: Deal;
  canEdit: boolean;
  isArchiveView?: boolean;
  onToKp: () => void;
  onToContract: () => void;
  onLost: () => void;
  onArchive?: () => void;
  onRestore?: () => void;
}

export default function DealCard({
  deal, canEdit, isArchiveView,
  onToKp, onToContract, onLost, onArchive, onRestore,
}: Props) {
  const isSerial = deal.project_type === "serial" || !deal.project_type;
  const cs       = deal.contract_status || "none";
  const csBadge  = CONTRACT_STATUS_BADGE[cs];

  const showContractBtn =
    deal.stage === "kp" ||
    (deal.stage === "contract" && ["none","docs_uploaded","docs_review","docs_approved","payment_pending"].includes(cs));

  const isInProduction = deal.stage === "planning";

  // Слот для контроля — показываем на этапе КП и Договора
  const showSlot = !!deal.slot_month && ["kp", "contract", "planning"].includes(deal.stage);

  return (
    <div className={`border rounded-xl p-3 hover:shadow-sm transition-all ${
      isArchiveView
        ? "bg-gray-50 border-gray-200"
        : isInProduction || cs === "payment_confirmed"
          ? "bg-emerald-50/40 border-emerald-200 hover:border-emerald-300"
          : "bg-white border-border hover:border-primary/30"
    }`}>
      {/* Top row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <div className="flex items-center gap-1.5">
            <div className="text-[12px] font-bold text-primary">{deal.code}</div>
            {isArchiveView && (
              <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-md font-medium">Архив</span>
            )}
          </div>
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
        <div className="text-[13px] font-semibold text-foreground mb-2">{fmt(deal.budget)}</div>
      )}

      {/* Serial project + config */}
      {deal.serial_project_name && (
        <div className="text-[11px] text-muted-foreground mb-1 flex items-center gap-1">
          <Icon name="Home" size={10} className="shrink-0" />
          {deal.serial_project_name}
          {deal.configuration_name && <span className="text-hint">· {deal.configuration_name}</span>}
        </div>
      )}

      {/* Слот производства — контроль для менеджера */}
      {showSlot && (
        <div className="flex items-center gap-1 text-[11px] font-medium mb-1 px-2 py-1 rounded-md bg-violet-50 border border-violet-200 text-violet-700 w-fit">
          <Icon name="Factory" size={10} className="shrink-0" />
          Слот: {MONTH_NAMES[deal.slot_month!]} {deal.slot_year}
          {deal.slot_start_date && (
            <span className="text-violet-500 ml-0.5">
              · старт {new Date(deal.slot_start_date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
            </span>
          )}
        </div>
      )}

      {/* Address */}
      {deal.address && (
        <div className="text-[11px] text-muted-foreground mb-1 flex items-center gap-1 truncate">
          <Icon name="MapPin" size={10} className="shrink-0" />
          {deal.address}
        </div>
      )}

      {/* Привязка к проекту */}
      {deal.project_id && (
        <div className="text-[11px] text-emerald-700 mb-1 flex items-center gap-1 font-medium">
          <Icon name="HardHat" size={10} className="shrink-0" />
          Проект привязан · план-график в разделе «Строительство»
        </div>
      )}

      {/* Manager */}
      <div className="text-hint text-[11px] mb-2">{deal.manager_name}</div>

      {/* Contract status badge */}
      {csBadge && cs !== "none" && (
        <div className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-medium mb-2 w-fit ${csBadge.cls}`}>
          <Icon name={csBadge.icon as Parameters<typeof Icon>[0]["name"]} size={9} />
          {csBadge.label}
        </div>
      )}

      {/* В производстве */}
      {isInProduction && (
        <div className="bg-emerald-100 border border-emerald-300 rounded-lg px-2 py-1.5 mb-2 flex items-center gap-1.5">
          <Icon name="Hammer" size={11} className="text-emerald-700 shrink-0" />
          <span className="text-[11px] text-emerald-800 font-medium">
            В производстве · подайте счёт на вознаграждение
          </span>
        </div>
      )}

      {/* Actions */}
      {!isArchiveView && canEdit && (
        <div className="border-t border-border pt-2 mt-1 flex gap-1.5 flex-wrap">
          {deal.stage === "lead" && (
            <button onClick={onToKp}
              className="flex items-center gap-1 px-2 py-1 bg-amber-50 border border-amber-200 text-amber-700 rounded-md text-[11px] font-medium hover:bg-amber-100 transition-colors">
              <Icon name="FileText" size={10} />
              Оформить КП
            </button>
          )}

          {showContractBtn && (
            <button onClick={onToContract}
              className="flex items-center gap-1 px-2 py-1 bg-violet-50 border border-violet-200 text-violet-700 rounded-md text-[11px] font-medium hover:bg-violet-100 transition-colors">
              <Icon name="PenLine" size={10} />
              {deal.stage === "kp" ? "Подписать договор" : "Договор →"}
            </button>
          )}

          {deal.stage === "kp" && (
            <button onClick={onToKp}
              className="flex items-center gap-1 px-2 py-1 border border-border text-muted-foreground rounded-md text-[11px] hover:bg-secondary transition-colors">
              <Icon name="Edit2" size={10} />
              Ред. КП
            </button>
          )}

          {["lead", "kp"].includes(deal.stage) && (
            <button onClick={onLost}
              className="flex items-center gap-1 px-2 py-1 border border-border text-red-400 rounded-md text-[11px] hover:bg-red-50 transition-colors ml-auto">
              <Icon name="X" size={10} />
              Отказ
            </button>
          )}

          {/* Архивировать — только директор */}
          {onArchive && (
            <button onClick={onArchive}
              className="flex items-center gap-1 px-2 py-1 border border-gray-200 text-gray-400 rounded-md text-[11px] hover:bg-gray-50 hover:text-gray-600 transition-colors ml-auto">
              <Icon name="Archive" size={10} />
              В архив
            </button>
          )}
        </div>
      )}

      {/* Архивный вид — кнопка восстановить */}
      {isArchiveView && onRestore && (
        <div className="border-t border-gray-200 pt-2 mt-1">
          <button onClick={onRestore}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 text-gray-600 rounded-lg text-[12px] font-medium hover:bg-gray-50 transition-colors">
            <Icon name="RotateCcw" size={12} />
            Восстановить
          </button>
        </div>
      )}
    </div>
  );
}
