import { useEffect, useRef, useState } from "react";
import { api, Project, ProjectStage } from "@/lib/api";
import Icon from "@/components/ui/icon";

interface Props {
  project: Project;
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateActModal({ project, onClose, onCreated }: Props) {
  const [stages, setStages] = useState<ProjectStage[]>([]);
  const [stageId, setStageId] = useState<number | "">("");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const firstRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    setStages(project.stages || []);
    setTimeout(() => firstRef.current?.focus(), 50);
  }, [project]);

  const selectedStage = stages.find(s => s.id === stageId);

  const handleStageChange = (id: number) => {
    setStageId(id);
    const s = stages.find(st => st.id === id);
    if (s && !title) setTitle(`Акт по этапу «${s.name}»`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stageId) { setError("Выберите этап"); return; }
    setSaving(true);
    setError("");
    try {
      await api.client_portal.createAct(project.id, stageId as number, 0, title.trim());
      onCreated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ошибка при создании акта");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="font-semibold text-[15px]">Создать акт</h2>
            <p className="text-hint text-[12px] mt-0.5">{project.code} · {project.client_name}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <Icon name="X" size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Этап */}
          <div>
            <label className="block text-[12px] font-medium text-foreground mb-1.5">
              Этап строительства <span className="text-red-500">*</span>
            </label>
            {stages.length === 0 ? (
              <div className="text-[13px] text-muted-foreground bg-secondary rounded-lg px-3 py-2">
                Этапы не найдены — сначала утвердите проект в производство
              </div>
            ) : (
              <select
                ref={firstRef}
                value={stageId}
                onChange={e => handleStageChange(Number(e.target.value))}
                className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:border-primary transition-colors bg-white"
              >
                <option value="">— Выберите этап —</option>
                {stages.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.status === "done" ? " ✓" : s.status === "in_progress" || s.actual_start ? " (в работе)" : ""}
                  </option>
                ))}
              </select>
            )}
            {selectedStage && (
              <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                {selectedStage.planned_start && (
                  <span>С {new Date(selectedStage.planned_start).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</span>
                )}
                {selectedStage.planned_end && (
                  <span>по {new Date(selectedStage.planned_end).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</span>
                )}
              </div>
            )}
          </div>

          {/* Название акта */}
          <div>
            <label className="block text-[12px] font-medium text-foreground mb-1.5">
              Название акта
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Акт по этапу «Фундамент»"
              className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:border-primary transition-colors"
            />
            <div className="text-[11px] text-muted-foreground mt-1">
              Заполняется автоматически при выборе этапа
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-[13px] text-red-700 flex items-center gap-2">
              <Icon name="AlertCircle" size={14} className="shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-border rounded-lg text-[13px] text-muted-foreground hover:bg-secondary transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={saving || stages.length === 0}
              className="flex-1 px-4 py-2.5 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving
                ? <><Icon name="Loader2" size={14} className="animate-spin" /> Создаём...</>
                : <><Icon name="FileSignature" size={14} /> Создать акт</>
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
