import Icon from "@/components/ui/icon";

interface Props {
  tab: "active" | "archive";
  loading: boolean;
  projectsCount: number;
  archivedCount: number;
  planningCount: number;
  activeCount: number;
  onTimeCount: number;
  lateCount: number;
  onTabChange: (t: "active" | "archive") => void;
  onRefresh: () => void;
}

export default function ConstructionHeader({
  tab, loading, projectsCount, archivedCount,
  planningCount, activeCount, onTimeCount, lateCount,
  onTabChange, onRefresh,
}: Props) {
  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Строительство (Проекты ИЖС)</h1>
          <p className="text-hint mt-0.5">
            Гант-план · 62 дня на дом ·{" "}
            {loading ? "—" : `${activeCount} активных проектов`}
          </p>
        </div>
        <button
          onClick={onRefresh}
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
          onClick={() => onTabChange("active")}
          className={`flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${
            tab === "active" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}>
          <Icon name="HardHat" size={14} />
          Активные проекты
          {projectsCount > 0 && (
            <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${tab === "active" ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}>
              {projectsCount}
            </span>
          )}
        </button>
        <button
          onClick={() => onTabChange("archive")}
          className={`flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${
            tab === "archive" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}>
          <Icon name="Archive" size={14} />
          Архив
          {archivedCount > 0 && tab === "archive" && (
            <span className="text-[11px] px-1.5 py-0.5 rounded-full font-bold bg-secondary text-muted-foreground">
              {archivedCount}
            </span>
          )}
        </button>
      </div>

      {/* Stats — только для активной вкладки */}
      {tab === "active" && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "В планировании",    value: loading ? "—" : String(planningCount), icon: "CalendarCheck", cls: "text-amber-500" },
            { label: "Активных домов",    value: loading ? "—" : String(activeCount),   icon: "Home",          cls: "text-primary" },
            { label: "В срок",            value: loading ? "—" : String(onTimeCount),   icon: "Clock",         cls: "text-emerald-500" },
            { label: "С отставанием",     value: loading ? "—" : String(lateCount),     icon: "AlertTriangle", cls: "text-red-500" },
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
            {archivedCount === 0
              ? "Архив пуст — здесь будут скрытые проекты"
              : `${archivedCount} проект(ов) в архиве · восстановление возвращает в активные`}
          </span>
        </div>
      )}
    </>
  );
}
