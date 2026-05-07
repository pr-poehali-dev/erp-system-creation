import { useEffect, useRef, useState } from "react";
import { Role } from "@/App";
import Icon from "@/components/ui/icon";
import { api, Project, ProjectStage } from "@/lib/api";
import MaterialRequestModal from "@/components/construction/MaterialRequestModal";

interface Props { role: Role; }

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

export default function Construction({ role }: Props) {
  const [projects, setProjects]         = useState<Project[]>([]);
  const [archived, setArchived]         = useState<Project[]>([]);
  const [loading, setLoading]           = useState(true);
  const [tab, setTab]                   = useState<"active" | "archive">("active");
  const [actionId, setActionId]         = useState<number | null>(null);
  const [confirmId, setConfirmId]       = useState<number | null>(null);
  const [materialModalProject, setMaterialModalProject] = useState<Project | null>(null);
  const [editAddressId, setEditAddressId] = useState<number | null>(null);
  const [editAddressVal, setEditAddressVal] = useState("");
  const addressInputRef = useRef<HTMLInputElement>(null);

  const isDirector = role === "director";
  const isConstructionDirector = role === "construction_director";
  const canArchive = role === "director";

  const load = () => {
    setLoading(true);
    api.projects.list()
      .then(setProjects)
      .finally(() => setLoading(false));
  };

  const loadArchived = () => {
    setLoading(true);
    api.projects.listArchived()
      .then(setArchived)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (tab === "archive") loadArchived();
    else load();
  }, [tab]);

  const handleArchive = async (p: Project) => {
    setActionId(p.id);
    try {
      await api.projects.archive(p.id);
      setConfirmId(null);
      load();
    } finally { setActionId(null); }
  };

  const handleRestore = async (p: Project) => {
    setActionId(p.id);
    try {
      await api.projects.restore(p.id);
      loadArchived();
    } finally { setActionId(null); }
  };

  const handleApprove = async (p: Project) => {
    setActionId(p.id);
    try {
      await api.projects.approve(p.id);
      load();
    } finally { setActionId(null); }
  };

  const handleCancel = async (p: Project) => {
    if (!confirm(`Расторгнуть договор и отменить проект ${p.code}?\nСлот будет освобождён, сделка переведена в «Отказ».`)) return;
    setActionId(p.id);
    try {
      await api.projects.cancel(p.id);
      load();
    } finally { setActionId(null); }
  };

  const handleComplete = async (p: Project) => {
    if (!confirm(`Отметить проект ${p.code} как завершённый (сдан клиенту)?`)) return;
    setActionId(p.id);
    try {
      await api.projects.complete(p.id);
      load();
    } finally { setActionId(null); }
  };

  const startEditAddress = (p: Project) => {
    setEditAddressId(p.id);
    setEditAddressVal(p.address || "");
    setTimeout(() => addressInputRef.current?.focus(), 50);
  };

  const saveAddress = async (projectId: number) => {
    await api.projects.updateAddress(projectId, editAddressVal.trim());
    setEditAddressId(null);
    load();
  };

  const planningProjects = projects.filter(p => p.status === "planning");
  const activeProjects  = projects.filter(p => p.status === "active");
  const doneProjects    = projects.filter(p => p.status === "done");
  const onTimeProjects  = activeProjects.filter(p => p.days_left >= 7);
  const lateProjects    = activeProjects.filter(p => p.days_left < 7);

  const displayProjects = tab === "archive" ? archived : projects;

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Строительство (Проекты ИЖС)</h1>
          <p className="text-hint mt-0.5">
            Гант-план · 62 дня на дом ·{" "}
            {loading ? "—" : `${activeProjects.length} активных проектов`}
          </p>
        </div>
        <button
          onClick={() => tab === "archive" ? loadArchived() : load()}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          disabled={loading}
        >
          <Icon name="RefreshCw" size={14} className={loading ? "animate-spin" : ""} />
          Обновить
        </button>
      </div>

      {/* Вкладки */}
      <div className="flex border-b border-border gap-1">
        <button
          onClick={() => setTab("active")}
          className={`flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${
            tab === "active" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}>
          <Icon name="HardHat" size={14} />
          Активные проекты
          {projects.length > 0 && (
            <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${tab === "active" ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}>
              {projects.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("archive")}
          className={`flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${
            tab === "archive" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}>
          <Icon name="Archive" size={14} />
          Архив
          {archived.length > 0 && tab === "archive" && (
            <span className="text-[11px] px-1.5 py-0.5 rounded-full font-bold bg-secondary text-muted-foreground">
              {archived.length}
            </span>
          )}
        </button>
      </div>

      {/* Stats — только для активной вкладки */}
      {tab === "active" && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "В планировании",    value: loading ? "—" : String(planningProjects.length), icon: "CalendarCheck", cls: "text-amber-500" },
            { label: "Активных домов",    value: loading ? "—" : String(activeProjects.length),   icon: "Home",          cls: "text-primary" },
            { label: "В срок",            value: loading ? "—" : String(onTimeProjects.length),   icon: "Clock",         cls: "text-emerald-500" },
            { label: "С отставанием",     value: loading ? "—" : String(lateProjects.length),     icon: "AlertTriangle", cls: "text-red-500" },
          ].map(c => (
            <div key={c.label} className="bg-white rounded-xl border border-border p-4 flex items-center gap-3">
              <Icon name={c.icon} size={20} className={`${c.cls} shrink-0`} />
              <div>
                <div className={`text-[22px] font-bold text-foreground ${loading ? "animate-pulse text-muted-foreground" : ""}`}>
                  {c.value}
                </div>
                <div className="text-hint">{c.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Архив — заголовок */}
      {tab === "archive" && !loading && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-2">
          <Icon name="Archive" size={14} className="text-gray-500 shrink-0" />
          <span className="text-[13px] text-gray-700">
            {archived.length === 0
              ? "Архив пуст — здесь будут скрытые проекты"
              : `${archived.length} проект(ов) в архиве · восстановление возвращает в активные`}
          </span>
        </div>
      )}

      {/* Projects list */}
      <div className="space-y-4">
        {loading ? (
          [1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-xl border border-border overflow-hidden animate-pulse">
              <div className="px-5 py-4 border-b border-border flex items-center gap-4">
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-secondary rounded w-32" />
                  <div className="h-4 bg-secondary rounded w-48" />
                  <div className="h-3 bg-secondary rounded w-64" />
                </div>
                <div className="h-8 bg-secondary rounded w-24" />
                <div className="h-8 bg-secondary rounded w-24" />
              </div>
              <div className="px-5 py-4">
                <div className="h-7 bg-secondary rounded" />
              </div>
            </div>
          ))
        ) : displayProjects.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-border p-12 flex flex-col items-center gap-3 text-muted-foreground">
            <Icon name={tab === "archive" ? "Archive" : "HardHat"} size={32} />
            <span className="text-[14px] font-medium">
              {tab === "archive" ? "Архив пуст" : "Проектов пока нет"}
            </span>
            <span className="text-hint text-center">
              {tab === "archive"
                ? "Заархивированные проекты появятся здесь"
                : "Проекты создаются автоматически при переводе сделки в статус «Договор»"}
            </span>
          </div>
        ) : (
          displayProjects.map(p => {
            const status    = getProjectStatus(p);
            const isAction  = actionId === p.id;
            const isConfirm = confirmId === p.id;

            return (
              <div
                key={p.id}
                className={`rounded-xl border overflow-hidden transition-all ${
                  tab === "archive" ? "bg-gray-50 border-gray-200" : "bg-white border-border"
                }`}
              >
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
                    {editAddressId === p.id ? (
                      <div className="flex items-center gap-1 mt-0.5">
                        <input
                          ref={addressInputRef}
                          value={editAddressVal}
                          onChange={e => setEditAddressVal(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") saveAddress(p.id); if (e.key === "Escape") setEditAddressId(null); }}
                          className="text-[12px] border border-primary rounded px-2 py-0.5 outline-none flex-1 min-w-0"
                          placeholder="Введите адрес объекта"
                        />
                        <button onClick={() => saveAddress(p.id)} className="text-emerald-600 hover:text-emerald-700 shrink-0">
                          <Icon name="Check" size={14} />
                        </button>
                        <button onClick={() => setEditAddressId(null)} className="text-muted-foreground hover:text-foreground shrink-0">
                          <Icon name="X" size={14} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEditAddress(p)}
                        className="flex items-center gap-1 text-hint text-[12px] hover:text-foreground group transition-colors"
                      >
                        <Icon name="MapPin" size={10} className="shrink-0" />
                        <span className="truncate">{p.address || "Адрес не указан"}</span>
                        <Icon name="Pencil" size={10} className="opacity-0 group-hover:opacity-50 transition-opacity shrink-0" />
                      </button>
                    )}
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

                  {/* Кнопка «Взять в производство» — только для директора по строительству */}
                  {isConstructionDirector && tab === "active" && p.status === "planning" && p.slot_status === "booked" && (
                    <div className="shrink-0">
                      <button
                        onClick={() => handleApprove(p)}
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
                          onClick={() => setConfirmId(p.id)}
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
                            onClick={() => handleArchive(p)}
                            disabled={isAction}
                            className="flex items-center gap-1 px-3 py-1.5 bg-red-500 text-white rounded-lg text-[12px] font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
                          >
                            {isAction ? <Icon name="Loader" size={12} className="animate-spin" /> : null}
                            Да
                          </button>
                          <button
                            onClick={() => setConfirmId(null)}
                            disabled={isAction}
                            className="px-3 py-1.5 border border-border rounded-lg text-[12px] text-muted-foreground hover:bg-secondary transition-colors"
                          >
                            Нет
                          </button>
                        </div>
                      )}

                      {tab === "archive" && (
                        <button
                          onClick={() => handleRestore(p)}
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

                {/* Блок слота — для planning проектов */}
                {p.status === "planning" && p.slot_start_date && tab === "active" && (() => {
                  const today = new Date();
                  const slotDate = new Date(p.slot_start_date);
                  const daysUntil = Math.max(0, Math.round((slotDate.getTime() - today.getTime()) / 86400000));
                  const totalDays = Math.max(1, Math.round((slotDate.getTime() - new Date(p.start_date || p.slot_start_date).getTime()) / 86400000) + daysUntil);
                  const pct = Math.max(0, Math.min(100, 100 - Math.round(daysUntil / Math.max(totalDays, 60) * 100)));
                  return (
                    <div className="mx-5 mt-3 border border-amber-200 bg-amber-50/60 rounded-xl px-4 py-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                          <span className="text-[12px] font-semibold text-amber-800">Слот: {slotDate.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}</span>
                        </div>
                        <span className="text-[12px] font-bold text-amber-700">{daysUntil > 0 ? `${daysUntil} дн. до старта` : "Старт сегодня!"}</span>
                      </div>
                      <div className="h-1.5 bg-amber-100 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })()}

                {/* Кнопки завершения и расторжения */}
                {tab === "active" && (isConstructionDirector || isDirector) && p.status !== "archived" && p.status !== "completed" && (
                  <div className="mx-5 mt-3 flex gap-2 flex-wrap">
                    {p.status === "active" && (
                      <button onClick={() => handleComplete(p)} disabled={isAction}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-300 text-[12px] text-emerald-700 font-medium hover:bg-emerald-100 transition-colors disabled:opacity-50">
                        {isAction ? <Icon name="Loader" size={12} className="animate-spin" /> : <Icon name="CheckCheck" size={12} />}
                        Сдан клиенту
                      </button>
                    )}
                    <button onClick={() => handleCancel(p)} disabled={isAction}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-[12px] text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50">
                      {isAction ? <Icon name="Loader" size={12} className="animate-spin" /> : <Icon name="XCircle" size={12} />}
                      Расторгнуть договор
                    </button>
                  </div>
                )}

                {/* Заявка на материалы — для прораба, директора по строительству и директора */}
                {tab === "active" && ["foreman", "construction_director", "director", "project_manager"].includes(role) && (
                  <div className="mx-5 mt-2 mb-1">
                    <button
                      onClick={() => setMaterialModalProject(p)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-[12px] text-blue-700 font-medium hover:bg-blue-100 transition-colors"
                    >
                      <Icon name="PackagePlus" size={13} />
                      Создать заявку на материалы
                    </button>
                  </div>
                )}

                {/* Панель сделки — режим чтения для директора по строительству */}
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
                  </div>
                )}

                {/* Gantt mini — не показываем в архиве без этапов */}
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
                </div>
              </div>
            );
          })
        )}
      </div>

      {materialModalProject && (
        <MaterialRequestModal
          projectId={materialModalProject.id}
          projectCode={materialModalProject.code}
          onClose={() => setMaterialModalProject(null)}
          onCreated={() => setMaterialModalProject(null)}
        />
      )}
    </div>
  );
}