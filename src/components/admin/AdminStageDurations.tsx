import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { api, StageDuration } from "@/lib/api";

export default function AdminStageDurations() {
  const [stages, setStages] = useState<StageDuration[]>([]);
  const [editing, setEditing] = useState<{ num: number; val: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.stage_durations.list().then(setStages); }, []);

  const total = stages.reduce((acc, s) => {
    if (s.parallel_group === null) return acc + s.duration;
    const maxInGroup = stages
      .filter(x => x.parallel_group === s.parallel_group)
      .reduce((m, x) => Math.max(m, x.duration), 0);
    return acc + (s.stage_num === Math.min(...stages.filter(x => x.parallel_group === s.parallel_group).map(x => x.stage_num)) ? maxInGroup : 0);
  }, 0);

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await api.stage_durations.update(editing.num, Number(editing.val));
      const updated = await api.stage_durations.list();
      setStages(updated);
      setEditing(null);
    } finally { setSaving(false); }
  };

  return (
    <div className="bg-white rounded-xl border border-border">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="Hammer" size={16} className="text-primary" />
          <h2 className="font-semibold text-[15px]">Нормативы этапов строительства</h2>
        </div>
        <div className="text-[13px] text-hint">
          Итого: <span className="font-bold text-foreground">{total} дней</span> (без буфера)
        </div>
      </div>
      <div className="divide-y divide-border">
        {stages.map(s => {
          const isEditing = editing?.num === s.stage_num;
          return (
            <div key={s.stage_num} className="px-5 py-3 flex items-center gap-4">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-[11px] font-bold text-primary">{s.stage_num}</span>
              </div>
              <div className="flex-1">
                <div className="text-[13px] font-medium">{s.name}</div>
                <div className="text-hint text-[11px]">
                  {s.parallel_group !== null ? `Параллельно (группа ${s.parallel_group})` : "Последовательный"}
                  {s.depends_on?.length > 0 ? ` · после этапов ${s.depends_on.join(", ")}` : ""}
                </div>
              </div>
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <input type="number" min={1} max={90} value={editing.val}
                    onChange={e => setEditing(prev => prev ? { ...prev, val: e.target.value } : null)}
                    className="w-16 border border-border rounded-lg px-2 py-1.5 text-[13px] outline-none focus:ring-1 focus:ring-primary text-center" />
                  <span className="text-hint text-[12px]">дн.</span>
                  <button onClick={handleSave} disabled={saving}
                    className="px-3 py-1.5 bg-primary text-white rounded-lg text-[12px] font-medium disabled:opacity-50">
                    {saving ? "..." : "OK"}
                  </button>
                  <button onClick={() => setEditing(null)} className="text-muted-foreground hover:text-foreground">
                    <Icon name="X" size={14} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-[14px] font-bold text-foreground w-12 text-right">{s.duration} дн.</span>
                  <button onClick={() => setEditing({ num: s.stage_num, val: String(s.duration) })}
                    className="text-muted-foreground hover:text-primary transition-colors">
                    <Icon name="Edit2" size={14} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="px-5 py-3 bg-blue-50 border-t border-blue-100">
        <div className="text-[12px] text-blue-700 flex items-center gap-2">
          <Icon name="Info" size={13} className="shrink-0" />
          Изменения применяются ко всем новым проектам. Существующие Гант-планы не затрагиваются.
        </div>
      </div>
    </div>
  );
}
