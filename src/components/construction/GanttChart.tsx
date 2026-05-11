import { useMemo } from "react";
import { GanttStage } from "@/lib/api";

interface Props {
  stages: GanttStage[];
  projectStart: string;
}

const BAR_COLORS = {
  plan: { bg: "bg-emerald-100", bar: "bg-emerald-400", text: "text-emerald-900" },
  fact: { bg: "bg-blue-100",    bar: "bg-blue-500",    text: "text-blue-900" },
  late: { bg: "bg-red-100",     bar: "bg-red-500",     text: "text-red-900" },
  done: { bg: "bg-gray-100",    bar: "bg-gray-400",    text: "text-gray-700" },
};

function getBarColor(stage: GanttStage): typeof BAR_COLORS.plan {
  if (stage.status === "done")            return BAR_COLORS.done;
  if (stage.deviation_days > 0)           return BAR_COLORS.late;
  if (stage.actual_start)                 return BAR_COLORS.fact;
  return BAR_COLORS.plan;
}

function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export default function GanttChart({ stages, projectStart }: Props) {
  const origin = useMemo(() => {
    const d = parseDate(projectStart);
    return d || new Date();
  }, [projectStart]);

  const { totalDays, allRows } = useMemo(() => {
    const rows: GanttStage[] = [];
    let maxDay = 30;

    for (const g of stages) {
      rows.push(g);
      if (g.children && g.children.length > 0) {
        for (const c of g.children) rows.push(c);
      }
      const end = parseDate(g.planned_end || g.actual_end);
      if (end) {
        const d = daysBetween(origin, end);
        if (d > maxDay) maxDay = d;
      }
      if (g.children) {
        for (const c of g.children) {
          const ce = parseDate(c.planned_end || c.actual_end);
          if (ce) {
            const d = daysBetween(origin, ce);
            if (d > maxDay) maxDay = d;
          }
        }
      }
    }
    return { totalDays: maxDay + 7, allRows: rows };
  }, [stages, origin]);

  // Генерируем заголовок недель
  const weeks = useMemo(() => {
    const result: { label: string; day: number }[] = [];
    for (let d = 0; d < totalDays; d += 7) {
      const dt = new Date(origin);
      dt.setDate(dt.getDate() + d);
      result.push({
        label: dt.toLocaleDateString("ru", { day: "numeric", month: "short" }),
        day: d,
      });
    }
    return result;
  }, [totalDays, origin]);

  const pct = (day: number) => `${(day / totalDays) * 100}%`;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[700px]">
        {/* Шкала времени */}
        <div className="flex border-b border-border mb-1">
          <div className="w-[220px] shrink-0" />
          <div className="flex-1 relative h-7">
            {weeks.map((w, i) => (
              <div
                key={i}
                className="absolute top-0 h-full flex items-center"
                style={{ left: pct(w.day), width: pct(7) }}
              >
                <span className="text-[10px] text-hint pl-1 whitespace-nowrap">{w.label}</span>
                <div className="absolute right-0 top-0 h-full w-px bg-border opacity-50" />
              </div>
            ))}
          </div>
        </div>

        {/* Строки этапов */}
        <div className="space-y-0.5">
          {allRows.map((stage) => {
            const isGroup = stage.parent_id === null;
            const ps = parseDate(stage.planned_start);
            const pe = parseDate(stage.planned_end);
            const as_ = parseDate(stage.actual_start);
            const ae = parseDate(stage.actual_end);

            const planLeft  = ps ? daysBetween(origin, ps) : 0;
            const planWidth = ps && pe ? Math.max(daysBetween(ps, pe), 1) : (stage.duration_days || 1);
            const factLeft  = as_ ? daysBetween(origin, as_) : planLeft;
            const factWidth = as_ ? (ae ? daysBetween(as_, ae) : daysBetween(as_, new Date())) : 0;

            const colors = getBarColor(stage);

            return (
              <div key={stage.id} className={`flex items-center gap-0 ${isGroup ? "mt-2" : ""}`}>
                {/* Название */}
                <div
                  className={`w-[220px] shrink-0 pr-2 truncate text-right ${
                    isGroup
                      ? "text-[12px] font-semibold text-foreground"
                      : "text-[11px] text-muted-foreground pl-4"
                  }`}
                  title={stage.name}
                >
                  {!isGroup && <span className="mr-1 opacity-40">└</span>}
                  {stage.name}
                </div>

                {/* Полоса */}
                <div className="flex-1 relative h-6">
                  {/* Вертикальные линии недель */}
                  {weeks.map((w, i) => (
                    <div
                      key={i}
                      className="absolute top-0 h-full w-px bg-border opacity-20"
                      style={{ left: pct(w.day) }}
                    />
                  ))}

                  {/* Плановая полоса */}
                  {ps && pe && (
                    <div
                      className={`absolute top-1 h-4 rounded ${colors.bar} opacity-30`}
                      style={{
                        left: pct(Math.max(planLeft, 0)),
                        width: pct(planWidth),
                      }}
                    />
                  )}

                  {/* Фактическая полоса */}
                  {as_ && factWidth > 0 && (
                    <div
                      className={`absolute top-1.5 h-3 rounded ${colors.bar}`}
                      style={{
                        left: pct(Math.max(factLeft, 0)),
                        width: pct(factWidth),
                      }}
                    />
                  )}

                  {/* Прогресс внутри плановой полосы */}
                  {ps && pe && stage.progress_percent > 0 && !as_ && (
                    <div
                      className={`absolute top-1.5 h-3 rounded ${colors.bar}`}
                      style={{
                        left: pct(Math.max(planLeft, 0)),
                        width: pct(planWidth * stage.progress_percent / 100),
                      }}
                    />
                  )}

                  {/* Метка отклонения */}
                  {stage.deviation_label && stage.deviation_label !== "По плану" && (
                    <div
                      className={`absolute top-0 text-[9px] font-bold px-1 rounded ${
                        stage.deviation_label === "Отставание"
                          ? "bg-red-100 text-red-700"
                          : "bg-emerald-100 text-emerald-700"
                      }`}
                      style={{ left: pct(Math.max(planLeft + planWidth + 1, 0)) }}
                    >
                      {stage.deviation_label === "Отставание" ? `+${stage.deviation_days}д` : `−${Math.abs(stage.deviation_days)}д`}
                    </div>
                  )}
                </div>

                {/* % */}
                <div className={`w-10 text-right text-[11px] shrink-0 ${
                  stage.status === "done" ? "text-emerald-600 font-bold" :
                  stage.deviation_days > 0 ? "text-red-600 font-bold" : "text-muted-foreground"
                }`}>
                  {stage.progress_percent}%
                </div>
              </div>
            );
          })}
        </div>

        {/* Легенда */}
        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border flex-wrap">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <div className="w-6 h-3 rounded bg-emerald-400 opacity-50" />
            <span>План</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <div className="w-6 h-3 rounded bg-blue-500" />
            <span>Факт</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <div className="w-6 h-3 rounded bg-red-500" />
            <span>Отставание</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <div className="w-6 h-3 rounded bg-gray-400" />
            <span>Выполнено</span>
          </div>
        </div>
      </div>
    </div>
  );
}
