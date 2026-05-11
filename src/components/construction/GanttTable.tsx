import { useState } from "react";
import { GanttStage } from "@/lib/api";
import Icon from "@/components/ui/icon";

interface Props {
  stages: GanttStage[];
  canEdit: boolean;
  onUpdateProgress: (stageId: number, progress: number) => Promise<void>;
}

const PROGRESS_STEPS = [0, 25, 50, 75, 100];

const statusBadge = (stage: GanttStage) => {
  if (stage.status === "done")
    return <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-medium">✓ Готово</span>;
  if (stage.deviation_days > 0)
    return <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">⚠ Отставание +{stage.deviation_days}д</span>;
  if (stage.deviation_label === "Опережение")
    return <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">↑ Опережение</span>;
  if (stage.status === "in_progress")
    return <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">▶ В работе</span>;
  return <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-secondary text-muted-foreground rounded-full font-medium">○ Ожидание</span>;
};

const ProgressBar = ({ value }: { value: number }) => (
  <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
    <div
      className={`h-full rounded-full transition-all ${
        value === 100 ? "bg-emerald-500" :
        value >= 50  ? "bg-blue-500" :
        value > 0    ? "bg-amber-500" :
        "bg-transparent"
      }`}
      style={{ width: `${value}%` }}
    />
  </div>
);

function StageRow({
  stage,
  canEdit,
  onUpdateProgress,
  isChild = false,
}: {
  stage: GanttStage;
  canEdit: boolean;
  onUpdateProgress: (stageId: number, progress: number) => Promise<void>;
  isChild?: boolean;
}) {
  const [saving, setSaving] = useState(false);

  const handleStep = async (dir: 1 | -1) => {
    const idx = PROGRESS_STEPS.indexOf(stage.progress_percent);
    const next = PROGRESS_STEPS[idx + dir];
    if (next === undefined) return;
    setSaving(true);
    try { await onUpdateProgress(stage.id, next); }
    finally { setSaving(false); }
  };

  const fmt = (s: string | null | undefined) =>
    s ? new Date(s).toLocaleDateString("ru", { day: "numeric", month: "short" }) : "—";

  return (
    <tr className={`border-t border-border hover:bg-secondary/20 transition-colors ${
      isChild ? "bg-secondary/5" : ""
    }`}>
      <td className="px-3 py-2.5">
        <div className={`flex items-center gap-2 ${isChild ? "pl-5" : ""}`}>
          {isChild && <span className="text-border">└</span>}
          <div>
            <div className={`${isChild ? "text-[12px]" : "text-[13px] font-semibold"}`}>
              {stage.name}
            </div>
            {stage.group_name && !isChild && (
              <div className="text-[10px] text-hint">{stage.group_name}</div>
            )}
          </div>
        </div>
      </td>

      <td className="px-3 py-2.5 text-center">
        {statusBadge(stage)}
      </td>

      <td className="px-3 py-2.5 text-[11px] text-muted-foreground whitespace-nowrap">
        {fmt(stage.planned_start)} — {fmt(stage.planned_end)}
      </td>

      <td className="px-3 py-2.5 text-[11px] text-muted-foreground whitespace-nowrap">
        {stage.actual_start ? (
          <span className="text-blue-600">
            {fmt(stage.actual_start)} — {stage.actual_end ? fmt(stage.actual_end) : "сейчас"}
          </span>
        ) : "—"}
      </td>

      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2 min-w-[120px]">
          <ProgressBar value={stage.progress_percent} />
          <span className={`text-[12px] font-semibold w-9 shrink-0 text-right ${
            stage.progress_percent === 100 ? "text-emerald-600" :
            stage.deviation_days > 0 ? "text-red-600" : "text-foreground"
          }`}>
            {stage.progress_percent}%
          </span>
        </div>
      </td>

      <td className="px-3 py-2.5">
        {canEdit && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleStep(-1)}
              disabled={saving || stage.progress_percent === 0}
              className="w-7 h-7 rounded bg-secondary flex items-center justify-center hover:bg-border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Уменьшить на 25%"
            >
              <Icon name="Minus" size={12} />
            </button>
            <button
              onClick={() => handleStep(1)}
              disabled={saving || stage.progress_percent === 100}
              className="w-7 h-7 rounded bg-secondary flex items-center justify-center hover:bg-border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Увеличить на 25%"
            >
              {saving ? <Icon name="Loader" size={12} className="animate-spin" /> : <Icon name="Plus" size={12} />}
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

export default function GanttTable({ stages, canEdit, onUpdateProgress }: Props) {
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  const toggleGroup = (id: number) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px]">
        <thead>
          <tr className="bg-secondary/50 text-left text-[10px] uppercase text-hint">
            <th className="px-3 py-2 font-medium">Этап / подэтап</th>
            <th className="px-3 py-2 font-medium text-center">Статус</th>
            <th className="px-3 py-2 font-medium">Плановые даты</th>
            <th className="px-3 py-2 font-medium">Фактические даты</th>
            <th className="px-3 py-2 font-medium">Прогресс</th>
            <th className="px-3 py-2 font-medium w-20">Действие</th>
          </tr>
        </thead>
        <tbody>
          {stages.map(stage => {
            const isGroup = stage.parent_id === null;
            const hasChildren = isGroup && stage.children && stage.children.length > 0;
            const isCollapsed = collapsed.has(stage.id);

            return [
              /* Строка группы или одиночного этапа */
              <tr
                key={stage.id}
                className={`border-t border-border ${
                  isGroup
                    ? "bg-secondary/30 hover:bg-secondary/50"
                    : "hover:bg-secondary/20"
                } transition-colors`}
              >
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    {hasChildren && (
                      <button
                        onClick={() => toggleGroup(stage.id)}
                        className="w-5 h-5 rounded flex items-center justify-center hover:bg-border transition-colors shrink-0"
                      >
                        <Icon name={isCollapsed ? "ChevronRight" : "ChevronDown"} size={12} />
                      </button>
                    )}
                    {!hasChildren && isGroup && <div className="w-5 shrink-0" />}
                    <div>
                      <div className={`${isGroup ? "text-[13px] font-bold" : "text-[13px]"}`}>
                        {stage.name}
                      </div>
                      {isGroup && hasChildren && (
                        <div className="text-[10px] text-hint">
                          {stage.children!.length} подэтапов · {stage.progress_percent}% готово
                        </div>
                      )}
                    </div>
                  </div>
                </td>

                <td className="px-3 py-2.5 text-center">
                  {statusBadge(stage)}
                </td>

                <td className="px-3 py-2.5 text-[11px] text-muted-foreground whitespace-nowrap">
                  {stage.planned_start
                    ? `${new Date(stage.planned_start).toLocaleDateString("ru", { day: "numeric", month: "short" })} — ${stage.planned_end ? new Date(stage.planned_end).toLocaleDateString("ru", { day: "numeric", month: "short" }) : "—"}`
                    : "—"}
                </td>

                <td className="px-3 py-2.5 text-[11px] text-muted-foreground whitespace-nowrap">
                  {stage.actual_start ? (
                    <span className="text-blue-600">
                      {new Date(stage.actual_start).toLocaleDateString("ru", { day: "numeric", month: "short" })}
                      {" — "}
                      {stage.actual_end
                        ? new Date(stage.actual_end).toLocaleDateString("ru", { day: "numeric", month: "short" })
                        : "сейчас"}
                    </span>
                  ) : "—"}
                </td>

                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2 min-w-[120px]">
                    <ProgressBar value={stage.progress_percent} />
                    <span className={`text-[12px] font-semibold w-9 shrink-0 text-right ${
                      stage.progress_percent === 100 ? "text-emerald-600" :
                      stage.deviation_days > 0 ? "text-red-600" : "text-foreground"
                    }`}>
                      {stage.progress_percent}%
                    </span>
                  </div>
                </td>

                <td className="px-3 py-2.5">
                  {canEdit && !hasChildren && (
                    <ProgressButtons stage={stage} onUpdateProgress={onUpdateProgress} />
                  )}
                </td>
              </tr>,

              /* Подэтапы (если не свёрнуто) */
              ...(!isCollapsed && hasChildren
                ? stage.children!.map(child => (
                    <StageRow
                      key={child.id}
                      stage={child}
                      canEdit={canEdit}
                      onUpdateProgress={onUpdateProgress}
                      isChild
                    />
                  ))
                : []),
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}

function ProgressButtons({
  stage,
  onUpdateProgress,
}: {
  stage: GanttStage;
  onUpdateProgress: (stageId: number, progress: number) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);

  const handleStep = async (dir: 1 | -1) => {
    const idx = PROGRESS_STEPS.indexOf(stage.progress_percent);
    const next = PROGRESS_STEPS[idx + dir];
    if (next === undefined) return;
    setSaving(true);
    try { await onUpdateProgress(stage.id, next); }
    finally { setSaving(false); }
  };

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => handleStep(-1)}
        disabled={saving || stage.progress_percent === 0}
        className="w-7 h-7 rounded bg-secondary flex items-center justify-center hover:bg-border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        title="−25%"
      >
        <Icon name="Minus" size={12} />
      </button>
      <button
        onClick={() => handleStep(1)}
        disabled={saving || stage.progress_percent === 100}
        className="w-7 h-7 rounded bg-secondary flex items-center justify-center hover:bg-border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        title="+25%"
      >
        {saving ? <Icon name="Loader" size={12} className="animate-spin" /> : <Icon name="Plus" size={12} />}
      </button>
    </div>
  );
}
