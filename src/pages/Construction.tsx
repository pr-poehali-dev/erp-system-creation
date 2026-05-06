import { useEffect, useState } from "react";
import { Role } from "@/App";
import Icon from "@/components/ui/icon";
import { api, Project, ProjectStage } from "@/lib/api";

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

  const isDirector = role === "director";

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
            { label: "Активных домов",    value: loading ? "—" : String(activeProjects.length),  icon: "Home" },
            { label: "Завершено",         value: loading ? "—" : String(doneProjects.length),     icon: "CheckCircle" },
            { label: "В срок",            value: loading ? "—" : String(onTimeProjects.length),   icon: "Clock" },
            { label: "С отставанием",     value: loading ? "—" : String(lateProjects.length),     icon: "AlertTriangle" },
          ].map(c => (
            <div key={c.label} className="bg-white rounded-xl border border-border p-4 flex items-center gap-3">
              <Icon name={c.icon} size={20} className="text-primary shrink-0" />
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
                      {tab === "active" && (
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
                    <div className="text-hint truncate">{p.address || "Адрес не указан"}</div>
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

                  {/* Кнопки директора */}
                  {isDirector && (
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
    </div>
  );
}