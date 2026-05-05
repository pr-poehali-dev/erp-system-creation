import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { Deal, SerialProject, StageDuration, Configuration } from "@/lib/api";

const fmt = (n: number) => `₽ ${n.toLocaleString("ru")}`;

// Считает длительность по выбранным этапам + буфер
function calcDuration(stages: StageDuration[], selected: number[], buffer: number): number {
  if (!selected.length || !stages.length) return buffer;
  const filtered = stages.filter(s => selected.includes(s.stage_num));
  if (!filtered.length) return buffer;

  // Простой подсчёт: последовательные + параллельные (берём максимум в группе)
  const sequential = filtered.filter(s => s.parallel_group === null);
  const groups: Record<number, StageDuration[]> = {};
  filtered.filter(s => s.parallel_group !== null).forEach(s => {
    const g = s.parallel_group!;
    if (!groups[g]) groups[g] = [];
    groups[g].push(s);
  });

  let total = sequential.reduce((s, x) => s + x.duration, 0);
  Object.values(groups).forEach(gStages => {
    total += Math.max(...gStages.map(s => s.duration));
  });
  return total + buffer;
}

interface Props {
  deal: Deal;
  serialProjects: SerialProject[];
  stageDurations: StageDuration[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (body: object) => void;
}

export default function KpModal({ deal, serialProjects, stageDurations, saving, onClose, onSubmit }: Props) {
  const [spId, setSpId]               = useState(String(deal.serial_project_id || ""));
  const [configs, setConfigs]         = useState<Configuration[]>([]);
  const [cfgId, setCfgId]             = useState(String(deal.configuration_id || ""));
  const [customMode, setCustomMode]   = useState(false);
  const [selected, setSelected]       = useState<number[]>(deal.selected_stages || []);
  const [budget, setBudget]           = useState(String(deal.budget || ""));
  const [kpNotes, setKpNotes]         = useState(deal.kp_notes || "");
  const [buffer, setBuffer]           = useState(deal.buffer_days || 7);
  const [error, setError]             = useState("");

  // Подгружаем конфигурации при смене проекта
  useEffect(() => {
    if (spId) {
      const sp = serialProjects.find(p => String(p.id) === spId);
      if (sp?.configurations?.length) {
        setConfigs(sp.configurations);
      }
    } else {
      setConfigs([]);
    }
  }, [spId, serialProjects]);

  // При выборе конфигурации — заполняем этапы и бюджет
  useEffect(() => {
    if (cfgId && spId) {
      const sp  = serialProjects.find(p => String(p.id) === spId);
      const cfg = configs.find(c => String(c.id) === cfgId);
      if (sp && cfg) {
        setSelected(cfg.included_stages);
        setBudget(String(Math.round(sp.base_price * cfg.price_coefficient)));
      }
    }
  }, [cfgId]);

  const toggleStage = (num: number) => {
    setSelected(prev => prev.includes(num) ? prev.filter(n => n !== num) : [...prev, num].sort((a, b) => a - b));
  };

  const totalDays = calcDuration(stageDurations, selected, buffer);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!budget) { setError("Укажите бюджет"); return; }
    if (selected.length === 0) { setError("Выберите хотя бы один этап"); return; }
    setError("");
    onSubmit({
      serial_project_id: spId ? Number(spId) : null,
      configuration_id:  cfgId && !customMode ? Number(cfgId) : null,
      selected_stages:   selected,
      budget:            Number(budget),
      kp_notes:          kpNotes,
      buffer_days:       buffer,
    });
  };

  const sp = serialProjects.find(p => String(p.id) === spId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl border border-border shadow-xl w-full max-w-xl max-h-[92vh] overflow-y-auto animate-fade-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="font-semibold text-[15px]">Оформить КП · {deal.code}</h2>
            <p className="text-hint text-[12px] mt-0.5">{deal.client_name}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><Icon name="X" size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-5">

          {/* Выбор серийного проекта — красивые карточки */}
          {deal.project_type === "serial" && (
            <div>
              <label className="block text-[13px] font-medium mb-2">Серийный проект</label>
              <div className="grid grid-cols-1 gap-2">
                {serialProjects.map(project => {
                  const isSelected = spId === String(project.id);
                  return (
                    <button key={project.id} type="button"
                      onClick={() => { setSpId(String(project.id)); setCfgId(""); setSelected([]); }}
                      className={`w-full text-left p-3 rounded-xl border transition-all ${
                        isSelected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/30"
                      }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isSelected ? "bg-primary" : "bg-secondary"}`}>
                            <Icon name="Home" size={16} className={isSelected ? "text-white" : "text-muted-foreground"} />
                          </div>
                          <div>
                            <div className="text-[13px] font-semibold text-foreground">{project.name}</div>
                            <div className="text-hint text-[11px]">{project.area_sqm} м² · {project.description}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[13px] font-bold text-primary">{fmt(project.base_price)}</div>
                          <div className="text-hint text-[11px]">{project.base_duration_days} дней</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Комплектации */}
          {sp && configs.length > 0 && !customMode && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[13px] font-medium">Комплектация</label>
                <button type="button" onClick={() => { setCustomMode(true); setCfgId(""); }}
                  className="text-[11px] text-primary hover:underline">
                  Кастомный набор этапов
                </button>
              </div>
              <div className="space-y-2">
                {configs.map(cfg => {
                  const price  = sp ? Math.round(sp.base_price * cfg.price_coefficient) : 0;
                  const isSel  = cfgId === String(cfg.id);
                  return (
                    <button key={cfg.id} type="button"
                      onClick={() => setCfgId(String(cfg.id))}
                      className={`w-full text-left p-3 rounded-xl border transition-all ${
                        isSel ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/30"
                      }`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-[13px] font-semibold">{cfg.name}</div>
                          <div className="text-hint text-[11px] mt-0.5">{cfg.description}</div>
                          <div className="text-hint text-[11px]">Этапы: {cfg.included_stages.join(", ")}</div>
                        </div>
                        <div className="text-right ml-3">
                          <div className="text-[14px] font-bold text-primary">{fmt(price)}</div>
                          <div className="text-hint text-[11px]">{cfg.duration_days} + {buffer} дн. буфер</div>
                          <div className="text-hint text-[11px]">×{cfg.price_coefficient}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Кастомный выбор этапов */}
          {(customMode || deal.project_type === "individual") && stageDurations.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[13px] font-medium">Выберите этапы</label>
                {customMode && (
                  <button type="button" onClick={() => { setCustomMode(false); }}
                    className="text-[11px] text-muted-foreground hover:text-primary">
                    ← Назад к комплектациям
                  </button>
                )}
              </div>
              <div className="space-y-1.5">
                {stageDurations.map(s => {
                  const isSel = selected.includes(s.stage_num);
                  return (
                    <label key={s.stage_num}
                      className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all ${
                        isSel ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                      }`}>
                      <div className="flex items-center gap-2">
                        <input type="checkbox" checked={isSel} onChange={() => toggleStage(s.stage_num)}
                          className="w-4 h-4 accent-primary rounded" />
                        <span className="text-[12px] font-medium">{s.stage_num}. {s.name}</span>
                        {s.parallel_group !== null && (
                          <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-md">параллельно</span>
                        )}
                      </div>
                      <span className="text-[12px] text-muted-foreground shrink-0 ml-2">{s.duration} дн.</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Итог по срокам */}
          {selected.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[13px] font-semibold text-blue-900">Итого: {totalDays} дней</div>
                  <div className="text-[11px] text-blue-700 mt-0.5">
                    {selected.length} этапов · буфер {buffer} дн. на оформление документов
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-blue-700">Буфер:</span>
                  <select value={buffer} onChange={e => setBuffer(Number(e.target.value))}
                    className="border border-blue-300 rounded-lg px-2 py-1 text-[12px] bg-white outline-none">
                    {[3, 5, 7, 10, 14].map(d => <option key={d} value={d}>{d} дн.</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Бюджет */}
          <div>
            <label className="block text-[13px] font-medium mb-1">
              Сумма сделки (₽) <span className="text-red-500">*</span>
            </label>
            <input type="number" value={budget} onChange={e => setBudget(e.target.value)}
              placeholder="6500000" min={0}
              className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
            {cfgId && budget && (
              <div className="text-hint text-[11px] mt-1">Автоподстановка · можно изменить вручную</div>
            )}
          </div>

          {/* Примечания КП */}
          <div>
            <label className="block text-[13px] font-medium mb-1">Примечания к КП</label>
            <textarea value={kpNotes} onChange={e => setKpNotes(e.target.value)} rows={2}
              placeholder="Особые условия, скидки..."
              className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary resize-none" />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-[13px]">
              <Icon name="AlertCircle" size={14} />{error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 border border-border rounded-lg text-[13px] hover:bg-secondary transition-colors">
              Отмена
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-lg text-[13px] font-medium hover:bg-amber-600 transition-colors disabled:opacity-50">
              {saving ? "Сохранение..." : "Сохранить КП"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
