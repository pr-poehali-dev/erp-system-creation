import { useState } from "react";
import { Deal, api } from "@/lib/api";
import Icon from "@/components/ui/icon";

const MONTH_NAMES = ["","Янв","Фев","Мар","Апр","Май","Июн","Июл","Авг","Сен","Окт","Ноя","Дек"];
const fmt = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} млн ₽` : `${n.toLocaleString("ru")} ₽`;

const SLOT_STATUS: Record<string, { label: string; dot: string; cls: string }> = {
  free:     { label: "Свободен",       dot: "bg-emerald-500", cls: "bg-emerald-50 border-emerald-200 text-emerald-700" },
  booked:   { label: "Зарезервирован", dot: "bg-amber-400",   cls: "bg-amber-50 border-amber-200 text-amber-700" },
  busy:     { label: "Занят",          dot: "bg-red-500",     cls: "bg-red-50 border-red-200 text-red-700" },
  archived: { label: "Архив",          dot: "bg-gray-400",    cls: "bg-gray-50 border-gray-200 text-gray-600" },
};

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
  onToPlanning?: () => void;
  onLost: () => void;
  onArchive?: () => void;
  onRestore?: () => void;
  onDelete?: () => void;
}

export default function DealCard({
  deal, canEdit, isArchiveView,
  onToKp, onToPlanning, onLost, onArchive, onRestore, onDelete,
}: Props) {
  const [clientToken, setClientToken] = useState<string | null>(deal.client_token || null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const getClientLink = () => `${window.location.origin}/client/${clientToken}`;

  const handleGetToken = async () => {
    if (clientToken) {
      await navigator.clipboard.writeText(getClientLink());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return;
    }
    setTokenLoading(true);
    try {
      const res = await api.client_portal.getToken(deal.id);
      setClientToken(res.client_token);
      await navigator.clipboard.writeText(`${window.location.origin}/client/${res.client_token}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } finally {
      setTokenLoading(false);
    }
  };

  const isSerial = deal.project_type === "serial" || !deal.project_type;
  const cs       = deal.contract_status || "none";
  const csBadge  = CONTRACT_STATUS_BADGE[cs];

  const isInProduction = deal.stage === "planning" || deal.stage === "closed";

  // Слот — показываем всегда когда привязан
  const showSlot = !!deal.slot_month;

  // Получаем статус слота
  const slotStatusKey = deal.slot_status ||
    (deal.stage === "planning" ? "booked" :
     deal.stage === "closed"   ? "booked" :
     deal.stage === "active"   ? "busy"   :
     deal.stage === "done"     ? "archived" : "free");
  const slotSt = SLOT_STATUS[slotStatusKey] || SLOT_STATUS.free;

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

      {/* Слот производства — цветовая индикация статуса */}
      {showSlot && (
        <div className={`flex items-center gap-1.5 text-[11px] font-medium mb-1 px-2 py-1 rounded-md border w-fit ${slotSt.cls}`}>
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${slotSt.dot}`} />
          Слот: {MONTH_NAMES[deal.slot_month!]} {deal.slot_year}
          {deal.slot_start_date && (
            <span className="opacity-75 ml-0.5">
              · {new Date(deal.slot_start_date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
            </span>
          )}
          <span className="opacity-60">· {slotSt.label}</span>
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

      {/* Ссылка ЛК клиента — показываем для сделок с подписанным договором */}
      {(deal.stage === "planning" || deal.stage === "closed" || deal.stage === "kp") && deal.payment_confirmed && (
        <button
          onClick={handleGetToken}
          disabled={tokenLoading}
          className={`mb-1 w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[11px] font-medium transition-colors ${
            copied
              ? "bg-emerald-50 border-emerald-200 text-emerald-700"
              : "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
          }`}
        >
          {tokenLoading
            ? <Icon name="Loader2" size={10} className="animate-spin shrink-0" />
            : <Icon name={copied ? "Check" : "Link"} size={10} className="shrink-0" />
          }
          {copied ? "Ссылка скопирована!" : clientToken ? "Скопировать ссылку ЛК" : "Получить ссылку ЛК клиента"}
        </button>
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

      {/* В планировании / закрыта */}
      {deal.stage === "planning" && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5 mb-2 flex items-center gap-1.5">
          <Icon name="CalendarCheck" size={11} className="text-amber-700 shrink-0" />
          <span className="text-[11px] text-amber-800 font-medium">
            Планирование производства · проект в разделе «Строительство»
          </span>
        </div>
      )}
      {deal.stage === "closed" && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1.5 mb-2 flex items-center gap-1.5">
          <Icon name="CheckCircle" size={11} className="text-emerald-700 shrink-0" />
          <span className="text-[11px] text-emerald-800 font-medium">
            Сделка закрыта · проект в разделе «Строительство»
          </span>
        </div>
      )}

      {/* КП-флоу прогресс (только для kp) */}
      {deal.stage === "kp" && (deal.kp_slot_id || deal.contract_signed || deal.payment_confirmed) && (
        <div className="mb-2 flex items-center gap-1.5 flex-wrap">
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${deal.kp_slot_id ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-secondary text-hint border-border"}`}>
            1. Слот {deal.kp_slot_id ? "✓" : "–"}
          </span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${deal.contract_signed ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-secondary text-hint border-border"}`}>
            2. Договор {deal.contract_signed ? "✓" : "–"}
          </span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${deal.payment_confirmed ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-secondary text-hint border-border"}`}>
            3. Аванс {deal.payment_confirmed ? "✓" : "–"}
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

          {/* Кнопка «Договор и оплата» — главный флоу для kp */}
          {deal.stage === "kp" && onToPlanning && (
            <button onClick={onToPlanning}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                deal.payment_confirmed
                  ? "bg-emerald-50 border border-emerald-300 text-emerald-700 hover:bg-emerald-100"
                  : "bg-violet-50 border border-violet-200 text-violet-700 hover:bg-violet-100"
              }`}>
              <Icon name={deal.payment_confirmed ? "PlayCircle" : "PenLine"} size={10} />
              Договор и оплата →
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

          {/* Удалить — только директор, с освобождением слота */}
          {onDelete && (
            <button onClick={onDelete}
              className="flex items-center gap-1 px-2 py-1 border border-red-200 text-red-400 rounded-md text-[11px] hover:bg-red-50 hover:text-red-600 transition-colors">
              <Icon name="Trash2" size={10} />
              Удалить
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