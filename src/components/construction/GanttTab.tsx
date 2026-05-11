import { useEffect, useState } from "react";
import { api, GanttStage, Project } from "@/lib/api";
import { Role } from "@/App";
import Icon from "@/components/ui/icon";
import GanttChart from "./GanttChart";
import GanttTable from "./GanttTable";

interface Props {
  project: Project;
  role: Role;
}

type ViewMode = "table" | "chart";

export default function GanttTab({ project, role }: Props) {
  const [stages, setStages] = useState<GanttStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [successMsg, setSuccessMsg] = useState("");

  const canEdit = ["construction_director", "director", "foreman"].includes(role);

  const load = () => {
    setLoading(true);
    api.gantt.list(project.id)
      .then(setStages)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [project.id]);

  useEffect(() => {
    if (!successMsg) return;
    const t = setTimeout(() => setSuccessMsg(""), 3000);
    return () => clearTimeout(t);
  }, [successMsg]);

  const handleUpdateProgress = async (stageId: number, progress: number) => {
    await api.gantt.updateProgress(stageId, progress);
    setStages(prev => updateStageInTree(prev, stageId, progress));
    setSuccessMsg(`Прогресс обновлён: ${progress}%`);
  };

  // Сводная статистика
  const allFlat = flattenStages(stages);
  const totalStages = allFlat.length;
  const doneStages  = allFlat.filter(s => s.status === "done").length;
  const lateStages  = allFlat.filter(s => s.deviation_days > 0 && s.status !== "done").length;
  const avgProgress = totalStages > 0
    ? Math.round(allFlat.reduce((s, x) => s + x.progress_percent, 0) / totalStages)
    : 0;

  return (
    <div className="space-y-4">
      {/* Шапка */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className="text-[20px] font-bold text-primary">{avgProgress}%</div>
            <div className="text-[10px] text-hint">Готовность</div>
          </div>
          <div className="text-center">
            <div className="text-[20px] font-bold">{doneStages}/{totalStages}</div>
            <div className="text-[10px] text-hint">Этапов завершено</div>
          </div>
          {lateStages > 0 && (
            <div className="text-center">
              <div className="text-[20px] font-bold text-red-600">{lateStages}</div>
              <div className="text-[10px] text-hint">Отставание</div>
            </div>
          )}
        </div>

        {/* Переключатель вида */}
        <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
          <button
            onClick={() => setViewMode("table")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-medium transition-colors ${
              viewMode === "table"
                ? "bg-white text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon name="List" size={13} />
            Таблица
          </button>
          <button
            onClick={() => setViewMode("chart")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-medium transition-colors ${
              viewMode === "chart"
                ? "bg-white text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon name="BarChart2" size={13} />
            Диаграмма
          </button>
        </div>
      </div>

      {/* Уведомление */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5 flex items-center gap-2">
          <Icon name="CheckCircle" size={14} className="text-emerald-600 shrink-0" />
          <span className="text-[12px] text-emerald-800">{successMsg}</span>
        </div>
      )}

      {/* Контент */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-10 bg-secondary rounded animate-pulse" />
          ))}
        </div>
      ) : stages.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-border p-10 flex flex-col items-center gap-3 text-muted-foreground">
          <Icon name="CalendarCheck" size={32} />
          <span className="text-[14px] font-medium">Этапы не заданы</span>
          <span className="text-hint text-center text-[12px]">
            Этапы создаются автоматически при создании проекта из сделки
          </span>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          {viewMode === "table" ? (
            <GanttTable
              stages={stages}
              canEdit={canEdit}
              onUpdateProgress={handleUpdateProgress}
            />
          ) : (
            <div className="p-4">
              <GanttChart
                stages={stages}
                projectStart={project.start_date}
              />
            </div>
          )}
        </div>
      )}

      {/* Подсказка прогресса */}
      {canEdit && stages.length > 0 && (
        <div className="text-[11px] text-hint flex items-center gap-1">
          <Icon name="Info" size={12} />
          Кнопки +/− меняют прогресс на 25%. При 100% фиксируется дата завершения.
        </div>
      )}
    </div>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────────

function flattenStages(stages: GanttStage[]): GanttStage[] {
  const result: GanttStage[] = [];
  for (const s of stages) {
    if (s.parent_id !== null) {
      result.push(s);
    } else {
      if (s.children && s.children.length > 0) {
        result.push(...s.children);
      } else {
        result.push(s);
      }
    }
  }
  return result;
}

function updateStageInTree(stages: GanttStage[], stageId: number, progress: number): GanttStage[] {
  const newStatus = progress === 100 ? "done" : progress > 0 ? "in_progress" : "pending";
  const today = new Date().toISOString().split("T")[0];

  return stages.map(stage => {
    if (stage.id === stageId) {
      return {
        ...stage,
        progress_percent: progress,
        status: newStatus,
        actual_end: progress === 100 ? today : stage.actual_end,
        actual_start: progress > 0 && !stage.actual_start ? today : stage.actual_start,
      };
    }
    if (stage.children && stage.children.length > 0) {
      const updatedChildren = stage.children.map(c =>
        c.id === stageId
          ? {
              ...c,
              progress_percent: progress,
              status: newStatus,
              actual_end: progress === 100 ? today : c.actual_end,
              actual_start: progress > 0 && !c.actual_start ? today : c.actual_start,
            }
          : c
      );
      const avgProgress = Math.round(
        updatedChildren.reduce((s, c) => s + c.progress_percent, 0) / updatedChildren.length
      );
      const groupStatus = avgProgress === 100 ? "done" : avgProgress > 0 ? "in_progress" : "pending";
      return { ...stage, children: updatedChildren, progress_percent: avgProgress, status: groupStatus };
    }
    return stage;
  });
}
