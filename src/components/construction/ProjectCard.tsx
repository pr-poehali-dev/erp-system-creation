import { useState } from "react";
import { Role } from "@/App";
import Icon from "@/components/ui/icon";
import { Project, ProjectStage } from "@/lib/api";
import ProjectAddressField from "./ProjectAddressField";
import GanttTab from "./GanttTab";

const getProjectStatus = (p: Project): { label: string; cls: string; icon: string } => {
  if (p.days_left < 0)
    return { label: "Просрочен", cls: "badge-error", icon: "AlertCircle" };
  if (p.days_left < 7)
    return { label: "Срочно", cls: "badge-warning", icon: "AlertTriangle" };
  return { label: "В норме", cls: "badge-success", icon: "CheckCircle" };
};

const getStageColor = (stage: ProjectStage) => {
  if (stage.status === "done" || stage.actual_end)
    return "bg-emerald-100 text-emerald-700";
  if (stage.status === "active" || stage.actual_start)
    return "bg-blue-100 text-blue-700 ring-1 ring-blue-400";
  return "bg-gray-100 text-gray-400";
};

const getStageLabel = (stage: ProjectStage, project: Project) => {
  if (stage.status === "done" || stage.actual_end) return "✓";
  if (stage.status === "active" || stage.actual_start)
    return `${project.progress}%`;
  return "";
};

type CardTab = "main" | "gantt" | "documents";

interface Props {
  project: Project;
  tab: "active" | "archive";
  isAction: boolean;
  isConfirm: boolean;
  isConstructionDirector: boolean;
  isDirector: boolean;
  canArchive: boolean;
  role: Role;
  onApprove: () => void;
  onArchive: () => void;
  onRestoreConfirm: () => void;
  onCancelConfirm: () => void;
  onRestore: () => void;
  onComplete: () => void;
  onCancel: () => void;
  onMaterialRequest: () => void;
  onCreateAct: () => void;
  onAddressSaved: () => void;
}

export default function ProjectCard({
  project: p, tab, isAction, isConfirm,
  isConstructionDirector, isDirector, canArchive, role,
  onApprove, onArchive, onRestoreConfirm, onCancelConfirm,
  onRestore, onComplete, onCancel, onMaterialRequest, onCreateAct, onAddressSaved,
}: Props) {
  const status = getProjectStatus(p);
  const [cardTab, setCardTab] = useState<CardTab>("main");
  const [copied, setCopied] = useState(false);

  const handleCopyClientLink = () => {
    if (!p.client_token) return;
    const url = `${window.location.origin}/client/${p.client_token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const showGanttTab = ["construction_director", "director", "foreman"].includes(role);

  const TABS: { key: CardTab; label: string; icon: string }[] = [
    { key: "main",      label: "Основное",         icon: "Info" },
    ...(showGanttTab ? [{ key: "gantt" as CardTab,  label: "План работ",      icon: "CalendarCheck" }] : []),
    { key: "documents", label: "Документы",        icon: "FileText" },
  ];

  return (
    <div
      className={`rounded-xl border overflow-hidden transition-all ${
        tab === "archive" ? "bg-gray-50 border-gray-200" : "bg-white border-border"
      }`}
    >
      {/* ── Шапка карточки ────────────────────────────────────────────── */}
      <div className="px-5 py-4 border-b border-border flex items-center gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[13px] text-primary font-semibold">{p.code}</span>
            {tab === "active" && p.status === "planning" && (
              <span className="text-[11px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200">
                <Icon name="CalendarCheck" size={11} />
                Планирование
              </span>
            )}
            {tab === "active" && p.status !== "planning" && (
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${status.cls}`}>
                <Icon name={status.icon} size={11} />
                {status.label}
              </span>
            )}
            {tab === "archive" && (
              <span className="text-[11px] px-2 py-0.5 rounded-md font-medium bg-gray-200 text-gray-600 flex items-center gap-1">
                <Icon name="Archive" size={10} />
                Архив
              </span>
            )}
          </div>
          <div className="text-[14px] font-semibold mt-0.5 truncate">{p.client_name}</div>
          <ProjectAddressField project={p} onSaved={onAddressSaved} />
        </div>

        <div className="text-right text-[13px] shrink-0">
          <div className="text-hint">Бригада</div>
          <div className="font-medium">{p.brigade || "Не назначена"}</div>
        </div>

        <div className="text-right text-[13px] shrink-0">
          <div className="text-hint">Дедлайн</div>
          <div className={`font-medium ${p.days_left <= 7 ? "text-red-500" : "text-foreground"}`}>
            {new Date(p.deadline).toLocaleDateString("ru-RU")}
            <span className="ml-1 text-[12px]">
              ({p.days_left >= 0 ? `${p.days_left} дн.` : `просрочен ${Math.abs(p.days_left)} дн.`})
            </span>
          </div>
        </div>

        <div className="w-28 shrink-0">
          <div className="flex justify-between mb-1">
            <span className="text-hint text-[12px]">Готовность</span>
            <span className="text-[13px] font-semibold">{p.progress}%</span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${p.progress}%` }}
            />
          </div>
          <div className="text-hint text-[11px] mt-0.5 text-right">
            {p.done_stages}/{p.total_stages} этапов
          </div>
        </div>

        {/* Кнопка «Взять в производство» */}
        {/* status='planning' — нормальный путь; status='active' && deal_stage='planning' — старый код создал проект active, сделка ещё не закрыта */}
        {isConstructionDirector && tab === "active" && (p.status === "planning" || (p.status === "active" && p.deal_stage === "planning")) && p.slot_status === "booked" && (
          <div className="shrink-0">
            <button
              onClick={onApprove}
              disabled={isAction}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500 text-white text-[12px] font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-50"
            >
              {isAction
                ? <Icon name="Loader" size={13} className="animate-spin" />
                : <Icon name="PlayCircle" size={14} />
              }
              Взять в производство
            </button>
          </div>
        )}

        {/* Кнопки директора */}
        {canArchive && (
          <div className="shrink-0">
            {tab === "active" && !isConfirm && (
              <button
                onClick={onRestoreConfirm}
                disabled={isAction}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-[12px] text-gray-600 font-medium hover:bg-gray-50 hover:border-gray-400 transition-colors disabled:opacity-50"
              >
                <Icon name="Archive" size={13} />
                В архив
              </button>
            )}

            {tab === "active" && isConfirm && (
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-gray-600">Архивировать?</span>
                <button
                  onClick={onArchive}
                  disabled={isAction}
                  className="flex items-center gap-1 px-3 py-1.5 bg-red-500 text-white rounded-lg text-[12px] font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {isAction ? <Icon name="Loader" size={12} className="animate-spin" /> : null}
                  Да
                </button>
                <button
                  onClick={onCancelConfirm}
                  disabled={isAction}
                  className="px-3 py-1.5 border border-border rounded-lg text-[12px] text-muted-foreground hover:bg-secondary transition-colors"
                >
                  Нет
                </button>
              </div>
            )}

            {tab === "archive" && (
              <button
                onClick={onRestore}
                disabled={isAction}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-300 text-[12px] text-emerald-700 font-medium hover:bg-emerald-100 transition-colors disabled:opacity-50"
              >
                {isAction
                  ? <Icon name="Loader" size={13} className="animate-spin" />
                  : <Icon name="RotateCcw" size={13} />
                }
                Восстановить
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Вкладки ───────────────────────────────────────────────────── */}
      <div className="flex items-center border-b border-border px-5 gap-0">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setCardTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-[12px] font-medium border-b-2 transition-colors ${
              cardTab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon name={t.icon} size={13} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Вкладка: Основное ─────────────────────────────────────────── */}
      {cardTab === "main" && (
        <>
          {/* Блок слота — для planning проектов */}
          {p.status === "planning" && p.slot_start_date && tab === "active" && (() => {
            const today = new Date();
            const slotDate = new Date(p.slot_start_date);
            const daysUntil = Math.max(0, Math.round((slotDate.getTime() - today.getTime()) / 86400000));
            const totalDays = Math.max(1, Math.round((slotDate.getTime() - new Date(p.start_date || p.slot_start_date).getTime()) / 86400000) + daysUntil);
            const pct = Math.max(0, Math.min(100, 100 - Math.round(daysUntil / Math.max(totalDays, 60) * 100)));
            return (
              <div className="mx-5 mt-4 mb-0 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <div className="text-[11px] text-amber-600 font-medium uppercase tracking-wide mb-1">Производственный слот</div>
                    <div className="text-[14px] font-bold text-amber-800">
                      {slotDate.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
                    </div>
                    <div className="text-[12px] text-amber-700 mt-0.5">
                      {daysUntil === 0 ? "Сегодня" : `Через ${daysUntil} дн.`}
                    </div>
                  </div>
                  <div className="flex-1 min-w-[120px]">
                    <div className="flex justify-between text-[11px] text-amber-600 mb-1">
                      <span>Отсчёт до старта</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-amber-200 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Кнопки завершения / отмены */}
          {(isConstructionDirector || isDirector) && tab === "active" && p.status === "active" && (
            <div className="px-5 mt-3 flex items-center gap-2 flex-wrap">
              <button
                onClick={onComplete}
                disabled={isAction}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-300 text-[12px] text-emerald-700 font-medium hover:bg-emerald-100 transition-colors disabled:opacity-50"
              >
                {isAction ? <Icon name="Loader" size={12} className="animate-spin" /> : <Icon name="CheckCircle2" size={13} />}
                Сдан клиенту
              </button>
              <button
                onClick={onCancel}
                disabled={isAction}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 text-[12px] text-red-600 font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <Icon name="XCircle" size={13} />
                Расторгнуть договор
              </button>
            </div>
          )}

          {/* Кнопки материалы / акт */}
          {(isConstructionDirector || role === "foreman") && tab === "active" && p.status === "active" && (
            <div className="px-5 mt-3 flex items-center gap-2 flex-wrap">
              <button
                onClick={onMaterialRequest}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-[12px] text-muted-foreground font-medium hover:bg-secondary transition-colors"
              >
                <Icon name="Package" size={13} />
                Заявка на материалы
              </button>
              {isConstructionDirector && (
                <button
                  onClick={onCreateAct}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-violet-200 bg-violet-50 text-[12px] text-violet-700 font-medium hover:bg-violet-100 transition-colors"
                >
                  <Icon name="FileSignature" size={13} />
                  Создать акт
                </button>
              )}
            </div>
          )}

          {/* Панель сделки */}
          {isConstructionDirector && (p.deal_code || p.manager_name) && (
            <div className="mx-5 mb-0 mt-3 border border-blue-200 bg-blue-50/60 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="ClipboardList" size={13} className="text-blue-600 shrink-0" />
                <span className="text-[12px] font-semibold text-blue-800">Информация о сделке</span>
                {p.contract_status === "payment_confirmed" && (
                  <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-md font-medium ml-auto">
                    Оплата подтверждена
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px]">
                {p.deal_code && <div><span className="text-hint">Сделка:</span><span className="font-medium ml-1">{p.deal_code}</span></div>}
                {p.manager_name && <div><span className="text-hint">Менеджер:</span><span className="font-medium ml-1">{p.manager_name}</span></div>}
                {p.serial_project_name && <div><span className="text-hint">Проект:</span><span className="font-medium ml-1">{p.serial_project_name}</span></div>}
                {p.configuration_name && <div><span className="text-hint">Комплектация:</span><span className="font-medium ml-1">{p.configuration_name}</span></div>}
                {p.deal_budget && <div><span className="text-hint">Сумма:</span><span className="font-medium text-emerald-700 ml-1">₽ {p.deal_budget.toLocaleString("ru")}</span></div>}
                {p.signed_date && <div><span className="text-hint">Подписан:</span><span className="font-medium ml-1">{new Date(p.signed_date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</span></div>}
              </div>

              {/* Кнопка «Ссылка на ЛК клиента» — всегда активна если есть токен */}
              {p.client_token && (
                <button
                  onClick={handleCopyClientLink}
                  className={`mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border text-[12px] font-medium transition-colors ${
                    copied
                      ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                      : "bg-white border-blue-300 text-blue-700 hover:bg-blue-50"
                  }`}
                >
                  <Icon name={copied ? "Check" : "Link"} size={13} />
                  {copied ? "Ссылка скопирована!" : "Ссылка на ЛК клиента"}
                </button>
              )}
            </div>
          )}

          {/* Мини Гант (превью этапов) */}
          <div className="px-5 py-4">
            <div className="text-hint mb-3 text-[12px]">
              Этапы строительства · {p.stages?.length ?? 0} этапов
            </div>
            {p.stages && p.stages.length > 0 ? (
              <div className="flex items-center gap-1.5">
                {p.stages.map((stage, i) => (
                  <div key={i} className="flex-1 min-w-0">
                    <div
                      className={`h-7 rounded flex items-center justify-center text-[10px] font-medium truncate px-1 transition-all ${getStageColor(stage)}`}
                      title={stage.name}
                    >
                      {getStageLabel(stage, p)}
                    </div>
                    <div className="text-[10px] text-hint mt-1 truncate text-center">
                      {stage.name.split(" ")[0]}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-hint text-[12px]">Этапы не заданы</div>
            )}
            {showGanttTab && (
              <button
                onClick={() => setCardTab("gantt")}
                className="mt-3 text-[11px] text-primary hover:underline flex items-center gap-1"
              >
                <Icon name="BarChart2" size={12} />
                Открыть полный план работ
              </button>
            )}
          </div>
        </>
      )}

      {/* ── Вкладка: Гант ─────────────────────────────────────────────── */}
      {cardTab === "gantt" && showGanttTab && (
        <div className="px-5 py-4">
          <GanttTab project={p} role={role} />
        </div>
      )}

      {/* ── Вкладка: Документы ────────────────────────────────────────── */}
      {cardTab === "documents" && (
        <div className="px-5 py-6 flex flex-col items-center gap-3 text-muted-foreground">
          <Icon name="FileText" size={28} />
          <span className="text-[13px] font-medium">Документы проекта</span>
          <span className="text-hint text-center text-[12px]">
            Раздел в разработке. Здесь будут договоры, акты и сметы по проекту.
          </span>
        </div>
      )}
    </div>
  );
}