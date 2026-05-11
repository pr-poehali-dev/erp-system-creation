import { useEffect, useState } from "react";
import { api, GanttStage } from "@/lib/api";
import Icon from "@/components/ui/icon";
import { STAGE_CFG, fmtShort } from "./portal.shared";

export default function ClientGantt({ projectId }: { projectId: number }) {
  const [stages, setStages] = useState<GanttStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  useEffect(() => {
    setLoading(true);
    api.gantt.list(projectId).then(setStages).finally(() => setLoading(false));
  }, [projectId]);

  const toggleGroup = (id: number) =>
    setCollapsed(prev => {
      const s = new Set(prev);
      if (s.has(id)) { s.delete(id); } else { s.add(id); }
      return s;
    });

  if (loading) return (
    <div className="space-y-2 py-2">
      {[1,2,3].map(i => <div key={i} className="h-9 bg-gray-100 rounded-lg animate-pulse" />)}
    </div>
  );

  if (stages.length === 0) return (
    <div className="py-8 text-center text-muted-foreground text-[13px]">
      <Icon name="CalendarCheck" size={28} className="mx-auto mb-2 opacity-40" />
      План работ ещё не составлен
    </div>
  );

  // Считаем итоги
  const allLeaf = stages.flatMap(s => s.children && s.children.length > 0 ? s.children : [s]);
  const done = allLeaf.filter(s => s.status === "done").length;
  const total = allLeaf.length;
  const pct = total > 0 ? Math.round(done / total * 100) : 0;

  return (
    <div className="space-y-3">
      {/* Общий прогресс */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-[12px] text-muted-foreground">
          <span>{done} из {total} этапов выполнено</span>
          <span className="font-semibold text-foreground">{pct}%</span>
        </div>
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Список этапов */}
      <div className="divide-y divide-gray-100">
        {stages.map(stage => {
          const isGroup = stage.parent_id === null;
          const hasChildren = isGroup && stage.children && stage.children.length > 0;
          const isCollapsed = collapsed.has(stage.id);
          const cfg = STAGE_CFG[stage.status] || STAGE_CFG["pending"];

          return [
            /* Группа или одиночный этап */
            <div
              key={stage.id}
              className={`flex items-start gap-3 py-3 ${isGroup && hasChildren ? "cursor-pointer" : ""}`}
              onClick={hasChildren ? () => toggleGroup(stage.id) : undefined}
            >
              {/* Цветной кружок статуса */}
              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${cfg.dotCls}`}>
                {stage.status === "done" && <Icon name="Check" size={11} className="text-white" />}
                {stage.status === "in_progress" && <div className="w-2 h-2 bg-white rounded-full" />}
                {stage.deviation_days > 0 && stage.status !== "done" && <Icon name="AlertCircle" size={11} className="text-white" />}
              </div>

              <div className="flex-1 min-w-0">
                <div className={`flex items-center gap-2 ${isGroup ? "font-semibold text-[14px]" : "text-[13px]"}`}>
                  {stage.name}
                  {hasChildren && (
                    <Icon name={isCollapsed ? "ChevronRight" : "ChevronDown"} size={13} className="text-muted-foreground" />
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {stage.planned_start ? `${fmtShort(stage.planned_start)} — ${fmtShort(stage.planned_end)}` : ""}
                  {stage.duration_days ? ` · ${stage.duration_days} дн.` : ""}
                </div>

                {/* Мини прогресс-бар для группы */}
                {isGroup && hasChildren && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${stage.progress_percent === 100 ? "bg-emerald-500" : "bg-primary"}`}
                        style={{ width: `${stage.progress_percent}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">{stage.progress_percent}%</span>
                  </div>
                )}
              </div>

              <div className="shrink-0 flex flex-col items-end gap-1">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cfg.badgeCls}`}>
                  {cfg.label}
                </span>
                {stage.deviation_days > 0 && stage.status !== "done" && (
                  <span className="text-[10px] text-red-600 font-medium">+{stage.deviation_days} дн.</span>
                )}
                {stage.deviation_label === "Опережение" && (
                  <span className="text-[10px] text-emerald-600 font-medium">↑ опережение</span>
                )}
              </div>
            </div>,

            /* Подэтапы */
            ...(!isCollapsed && hasChildren
              ? stage.children!.map(child => {
                  const ccfg = STAGE_CFG[child.status] || STAGE_CFG["pending"];
                  return (
                    <div key={child.id} className="flex items-start gap-3 py-2.5 pl-8 bg-gray-50/60">
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${ccfg.dotCls}`}>
                        {child.status === "done" && <Icon name="Check" size={9} className="text-white" />}
                        {child.status === "in_progress" && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px]">{child.name}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {child.planned_start ? `${fmtShort(child.planned_start)} — ${fmtShort(child.planned_end)}` : ""}
                          {child.duration_days ? ` · ${child.duration_days} дн.` : ""}
                        </div>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${ccfg.badgeCls}`}>
                        {ccfg.label}
                      </span>
                    </div>
                  );
                })
              : []),
          ];
        })}
      </div>
    </div>
  );
}
