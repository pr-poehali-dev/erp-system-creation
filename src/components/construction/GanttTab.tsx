import { useEffect, useRef, useState } from "react";
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

// ── Форма добавления группы ────────────────────────────────────────────────
interface AddGroupFormProps {
  projectStart: string;
  onSave: (name: string, plannedStart: string, plannedEnd: string) => Promise<void>;
  onCancel: () => void;
}

function AddGroupForm({ projectStart, onSave, onCancel }: AddGroupFormProps) {
  const [name, setName] = useState("");
  const [start, setStart] = useState(projectStart || "");
  const [end, setEnd] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try { await onSave(name.trim(), start, end); }
    finally { setSaving(false); }
  };

  return (
    <div className="border border-primary/30 bg-primary/5 rounded-xl p-4 space-y-3">
      <div className="text-[12px] font-semibold text-primary flex items-center gap-1.5">
        <Icon name="FolderPlus" size={14} />
        Новая группа этапов
      </div>
      <input
        ref={inputRef}
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") onCancel(); }}
        placeholder="Название группы (например: Фундамент)"
        className="w-full px-3 py-2 text-[13px] rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
      <div className="flex gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-hint w-14 shrink-0">Начало</span>
          <input
            type="date"
            value={start}
            onChange={e => setStart(e.target.value)}
            className="px-2 py-1.5 text-[12px] rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-hint w-14 shrink-0">Конец</span>
          <input
            type="date"
            value={end}
            onChange={e => setEnd(e.target.value)}
            className="px-2 py-1.5 text-[12px] rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-[12px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {saving ? <Icon name="Loader" size={13} className="animate-spin" /> : <Icon name="Check" size={13} />}
          Добавить
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 border border-border rounded-lg text-[12px] text-muted-foreground hover:bg-secondary transition-colors"
        >
          Отмена
        </button>
      </div>
    </div>
  );
}

// ── Форма добавления подэтапа ──────────────────────────────────────────────
interface AddSubstageFormProps {
  groups: GanttStage[];
  defaultParentId?: number;
  projectStart: string;
  onSave: (parentId: number, name: string, duration: number, plannedStart: string, plannedEnd: string) => Promise<void>;
  onCancel: () => void;
}

function AddSubstageForm({ groups, defaultParentId, projectStart, onSave, onCancel }: AddSubstageFormProps) {
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<number>(defaultParentId ?? (groups[0]?.id ?? 0));
  const [duration, setDuration] = useState("7");
  const [start, setStart] = useState(projectStart || "");
  const [end, setEnd] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Автовычисляем конец по длительности
  useEffect(() => {
    if (start && duration) {
      const d = new Date(start);
      d.setDate(d.getDate() + parseInt(duration, 10));
      setEnd(d.toISOString().split("T")[0]);
    }
  }, [start, duration]);

  const handleSave = async () => {
    if (!name.trim() || !parentId) return;
    setSaving(true);
    try { await onSave(parentId, name.trim(), parseInt(duration, 10) || 7, start, end); }
    finally { setSaving(false); }
  };

  return (
    <div className="border border-amber-300 bg-amber-50/60 rounded-xl p-4 space-y-3">
      <div className="text-[12px] font-semibold text-amber-800 flex items-center gap-1.5">
        <Icon name="Plus" size={14} />
        Новый подэтап
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <input
            ref={inputRef}
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") onCancel(); }}
            placeholder="Название подэтапа (например: Заливка опалубки)"
            className="w-full px-3 py-2 text-[13px] rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-amber-300"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-hint w-16 shrink-0">Группа</span>
          <select
            value={parentId}
            onChange={e => setParentId(Number(e.target.value))}
            className="flex-1 px-2 py-1.5 text-[12px] rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-amber-300"
          >
            {groups.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-hint w-16 shrink-0">Дней</span>
          <input
            type="number"
            min={1}
            max={365}
            value={duration}
            onChange={e => setDuration(e.target.value)}
            className="w-20 px-2 py-1.5 text-[12px] rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-amber-300"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-hint w-16 shrink-0">Начало</span>
          <input
            type="date"
            value={start}
            onChange={e => setStart(e.target.value)}
            className="flex-1 px-2 py-1.5 text-[12px] rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-amber-300"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-hint w-16 shrink-0">Конец</span>
          <input
            type="date"
            value={end}
            onChange={e => setEnd(e.target.value)}
            className="flex-1 px-2 py-1.5 text-[12px] rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-amber-300"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving || !name.trim() || !parentId}
          className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white rounded-lg text-[12px] font-medium hover:bg-amber-600 transition-colors disabled:opacity-50"
        >
          {saving ? <Icon name="Loader" size={13} className="animate-spin" /> : <Icon name="Check" size={13} />}
          Добавить
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 border border-border rounded-lg text-[12px] text-muted-foreground hover:bg-secondary transition-colors"
        >
          Отмена
        </button>
      </div>
    </div>
  );
}

// ── Основной компонент ─────────────────────────────────────────────────────
export default function GanttTab({ project, role }: Props) {
  const [stages, setStages] = useState<GanttStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [successMsg, setSuccessMsg] = useState("");
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [showAddSubstage, setShowAddSubstage] = useState(false);
  const [addSubstageParentId, setAddSubstageParentId] = useState<number | undefined>();

  const canEdit = ["construction_director", "director", "foreman"].includes(role);

  const load = () => {
    setLoading(true);
    api.gantt.list(project.id)
      .then(setStages)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [project.id]);

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

  const handleAddGroup = async (name: string, plannedStart: string, plannedEnd: string) => {
    await api.gantt.addGroup(project.id, { name, planned_start: plannedStart, planned_end: plannedEnd });
    setShowAddGroup(false);
    setSuccessMsg(`Группа «${name}» добавлена`);
    load();
  };

  const handleAddSubstage = async (parentId: number, name: string, duration: number, plannedStart: string, plannedEnd: string) => {
    await api.gantt.addSubstage(project.id, {
      parent_id: parentId,
      name,
      duration_days: duration,
      planned_start: plannedStart,
      planned_end: plannedEnd,
    });
    setShowAddSubstage(false);
    setAddSubstageParentId(undefined);
    setSuccessMsg(`Подэтап «${name}» добавлен`);
    load();
  };

  const handleDeleteStage = async (stage: GanttStage) => {
    const what = stage.parent_id === null ? "группу" : "подэтап";
    const withChildren = stage.parent_id === null && stage.children && stage.children.length > 0
      ? ` (и все ${stage.children.length} подэтапов)`
      : "";
    if (!confirm(`Удалить ${what} «${stage.name}»${withChildren}?`)) return;
    await api.gantt.deleteStage(stage.id);
    setSuccessMsg(`«${stage.name}» удалён`);
    load();
  };

  // Только группы (parent_id === null) — для селекта подэтапа
  const groups = stages.filter(s => s.parent_id === null);

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

        <div className="flex items-center gap-2 flex-wrap">
          {/* Кнопки добавления — только для редакторов */}
          {canEdit && !showAddGroup && !showAddSubstage && (
            <>
              <button
                onClick={() => { setShowAddGroup(true); setShowAddSubstage(false); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/30 text-primary bg-primary/5 text-[12px] font-medium hover:bg-primary/10 transition-colors"
              >
                <Icon name="FolderPlus" size={13} />
                + Группа
              </button>
              {groups.length > 0 && (
                <button
                  onClick={() => { setShowAddSubstage(true); setShowAddGroup(false); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 text-amber-700 bg-amber-50 text-[12px] font-medium hover:bg-amber-100 transition-colors"
                >
                  <Icon name="Plus" size={13} />
                  + Подэтап
                </button>
              )}
            </>
          )}

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
      </div>

      {/* Форма добавления группы */}
      {showAddGroup && (
        <AddGroupForm
          projectStart={project.start_date}
          onSave={handleAddGroup}
          onCancel={() => setShowAddGroup(false)}
        />
      )}

      {/* Форма добавления подэтапа */}
      {showAddSubstage && groups.length > 0 && (
        <AddSubstageForm
          groups={groups}
          defaultParentId={addSubstageParentId}
          projectStart={project.start_date}
          onSave={handleAddSubstage}
          onCancel={() => { setShowAddSubstage(false); setAddSubstageParentId(undefined); }}
        />
      )}

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
          {canEdit ? (
            <button
              onClick={() => setShowAddGroup(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors mt-1"
            >
              <Icon name="FolderPlus" size={14} />
              Добавить первую группу
            </button>
          ) : (
            <span className="text-hint text-center text-[12px]">
              Этапы создаются автоматически при создании проекта из сделки
            </span>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          {viewMode === "table" ? (
            <GanttTable
              stages={stages}
              canEdit={canEdit}
              onUpdateProgress={handleUpdateProgress}
              onAddSubstage={canEdit ? (parentId) => {
                setAddSubstageParentId(parentId);
                setShowAddSubstage(true);
                setShowAddGroup(false);
              } : undefined}
              onDeleteStage={canEdit ? handleDeleteStage : undefined}
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

      {/* Подсказка */}
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