import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { Deal, SerialProject, StageDuration, Configuration } from "@/lib/api";

const fmtN = (n: number) => n.toLocaleString("ru");
const fmt  = (n: number) => `₽ ${fmtN(n)}`;

function calcDuration(stages: StageDuration[], selected: number[], buffer: number): number {
  if (!selected.length || !stages.length) return buffer;
  const filtered = stages.filter(s => selected.includes(s.stage_num));
  if (!filtered.length) return buffer;
  const sequential = filtered.filter(s => s.parallel_group === null);
  const groups: Record<number, StageDuration[]> = {};
  filtered.filter(s => s.parallel_group !== null).forEach(s => {
    const g = s.parallel_group!;
    if (!groups[g]) groups[g] = [];
    groups[g].push(s);
  });
  let total = sequential.reduce((s, x) => s + x.duration, 0);
  Object.values(groups).forEach(gStages => { total += Math.max(...gStages.map(s => s.duration)); });
  return total + buffer;
}

// Считаем цену с учётом скидки
function priceWithDiscount(base: number, coeff: number, discount_pct: number): { final: number; original: number; hasDiscount: boolean } {
  const original = Math.round(base * coeff);
  const hasDiscount = discount_pct > 0;
  const final = hasDiscount ? Math.round(original * (1 - discount_pct / 100)) : original;
  return { final, original, hasDiscount };
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
  const [spId, setSpId]             = useState(String(deal.serial_project_id || ""));
  const [configs, setConfigs]       = useState<Configuration[]>([]);
  const [cfgId, setCfgId]           = useState(String(deal.configuration_id || ""));
  const [expandedCfgId, setExpandedCfgId] = useState<string | null>(null);
  const [customMode, setCustomMode] = useState(false);
  const [selected, setSelected]     = useState<number[]>(deal.selected_stages || []);
  const [budget, setBudget]         = useState(String(deal.budget || ""));
  const [kpNotes, setKpNotes]       = useState(deal.kp_notes || "");
  const [buffer, setBuffer]         = useState(deal.buffer_days || 7);
  const [error, setError]           = useState("");

  const sp = serialProjects.find(p => String(p.id) === spId);

  // При смене проекта — сбрасываем и сортируем конфигурации по коэффициенту
  useEffect(() => {
    if (spId) {
      const found = serialProjects.find(p => String(p.id) === spId);
      if (found?.configurations?.length) {
        const sorted = [...found.configurations].sort((a, b) => a.price_coefficient - b.price_coefficient);
        setConfigs(sorted);
        // Авто-выбираем первую (Тёплый контур) и разворачиваем её
        const first = sorted[0];
        if (first) {
          setCfgId(String(first.id));
          setExpandedCfgId(String(first.id));
        }
      }
    } else {
      setConfigs([]);
    }
  }, [spId, serialProjects]);

  // При выборе конфигурации — заполняем этапы и бюджет
  useEffect(() => {
    if (cfgId && spId) {
      const found = serialProjects.find(p => String(p.id) === spId);
      const cfg   = configs.find(c => String(c.id) === cfgId);
      if (found && cfg) {
        setSelected(cfg.included_stages);
        const { final } = priceWithDiscount(found.base_price, cfg.price_coefficient, cfg.discount_pct || 0);
        setBudget(String(final));
      }
    }
  }, [cfgId, configs]);

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

          {/* Выбор серийного проекта */}
          {deal.project_type === "serial" && (
            <div>
              <label className="block text-[13px] font-medium mb-2">Выберите дом</label>
              <div className="grid grid-cols-1 gap-2">
                {serialProjects.map(project => {
                  const isSelected = spId === String(project.id);
                  // Минимальная цена (Тёплый контур — первая конфиг с мин коэффициентом)
                  const minCfg = project.configurations?.reduce((a, b) => a.price_coefficient < b.price_coefficient ? a : b, project.configurations[0]);
                  const minPrice = minCfg ? Math.round(project.base_price * minCfg.price_coefficient) : project.base_price;
                  return (
                    <button key={project.id} type="button"
                      onClick={() => { setSpId(String(project.id)); setCfgId(""); setSelected([]); setExpandedCfgId(null); setCustomMode(false); }}
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
                        <div className="text-right shrink-0">
                          <div className="text-[11px] text-muted-foreground">Тёплый контур от</div>
                          <div className="text-[14px] font-bold text-emerald-600">₽ {fmtN(minPrice)}</div>
                          <div className="text-hint text-[11px]">{project.base_duration_days} дней</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Комплектации — accordion-стиль: первая открыта, остальные сворачиваются */}
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
                  const { final, original, hasDiscount } = priceWithDiscount(sp.base_price, cfg.price_coefficient, cfg.discount_pct || 0);
                  const isSel      = cfgId === String(cfg.id);
                  const isExpanded = expandedCfgId === String(cfg.id);

                  return (
                    <div key={cfg.id} className={`rounded-xl border transition-all overflow-hidden ${
                      isSel ? "border-primary ring-1 ring-primary" : "border-border"
                    }`}>
                      {/* Шапка карточки */}
                      <button type="button"
                        onClick={() => {
                          setCfgId(String(cfg.id));
                          setExpandedCfgId(isExpanded ? null : String(cfg.id));
                        }}
                        className={`w-full text-left p-3 flex items-center justify-between gap-3 transition-colors ${
                          isSel ? "bg-primary/5" : "bg-white hover:bg-secondary/50"
                        }`}>
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                            isSel ? "border-primary" : "border-border"
                          }`}>
                            {isSel && <div className="w-2 h-2 rounded-full bg-primary" />}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[13px] font-semibold">{cfg.name}</span>
                              {cfg.is_popular && (
                                <span className="flex items-center gap-1 text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-md font-semibold">
                                  <Icon name="Star" size={9} />Самое популярное
                                </span>
                              )}
                              {hasDiscount && (
                                <span className="flex items-center gap-1 text-[10px] bg-red-50 text-red-600 border border-red-200 px-1.5 py-0.5 rounded-md font-semibold">
                                  <Icon name="Tag" size={9} />-{cfg.discount_pct}%
                                </span>
                              )}
                            </div>
                            <div className="text-hint text-[11px] mt-0.5 truncate">{cfg.description}</div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          {hasDiscount && (
                            <div className="text-[11px] text-muted-foreground line-through">₽ {fmtN(original)}</div>
                          )}
                          <div className={`text-[15px] font-bold ${hasDiscount ? "text-red-600" : "text-emerald-600"}`}>
                            ₽ {fmtN(final)}
                          </div>
                          <div className="text-hint text-[11px]">{cfg.duration_days} дн.</div>
                        </div>
                      </button>

                      {/* Развёрнутые детали */}
                      {isExpanded && (
                        <div className="px-4 pb-3 pt-2 bg-secondary/30 border-t border-border space-y-2">
                          <div className="text-[12px] text-muted-foreground">
                            <span className="font-medium">Включённые этапы:</span> {cfg.included_stages.join(", ")}
                          </div>
                          {cfg.discount_until && (
                            <div className="flex items-center gap-1.5 text-[11px] text-red-600">
                              <Icon name="Clock" size={11} />
                              Скидка действует до {new Date(cfg.discount_until).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
                            </div>
                          )}
                          <div className="text-[12px] text-muted-foreground">
                            Срок строительства: <span className="font-medium text-foreground">{cfg.duration_days} дней</span>
                          </div>
                          {/* Поле ввода бюджета для выбранной комплектации */}
                          {isSel && (
                            <div>
                              <label className="block text-[11px] font-medium text-muted-foreground mb-1">Итоговая сумма договора (₽)</label>
                              <input type="number" value={budget} onChange={e => setBudget(e.target.value)} min={0}
                                className="w-full border border-border rounded-lg px-3 py-1.5 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
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
                  <button type="button" onClick={() => setCustomMode(false)}
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
                        <span className="text-[12px]">Этап {s.stage_num}: {s.name}</span>
                        {s.parallel_group && (
                          <span className="text-[10px] bg-secondary text-hint px-1.5 py-0.5 rounded-md">параллельный</span>
                        )}
                      </div>
                      <span className="text-[11px] text-hint shrink-0">{s.duration} дн.</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Бюджет (не для кастома — там выше) */}
          {(customMode || deal.project_type === "individual") && (
            <div>
              <label className="block text-[13px] font-medium mb-1">Сумма договора (₽)</label>
              <input type="number" value={budget} onChange={e => setBudget(e.target.value)} min={0} placeholder="0"
                className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
            </div>
          )}

          {/* Итоговый срок */}
          {selected.length > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon name="CalendarCheck" size={15} className="text-emerald-600" />
                <span className="text-[13px] font-medium text-emerald-900">Срок строительства</span>
              </div>
              <div className="text-right">
                <span className="text-[15px] font-bold text-emerald-700">{totalDays} дней</span>
                <div className="text-[11px] text-emerald-600">включая {buffer} дн. буфера</div>
              </div>
            </div>
          )}

          {/* Заметки */}
          <div>
            <label className="block text-[13px] font-medium mb-1">Заметки КП</label>
            <textarea value={kpNotes} onChange={e => setKpNotes(e.target.value)} rows={2} placeholder="Пожелания, нюансы..."
              className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary resize-none" />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-[13px]">
              <Icon name="AlertCircle" size={14} />{error}
            </div>
          )}

          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 border border-border rounded-lg text-[13px] hover:bg-secondary transition-colors">Отмена</button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {saving ? "Сохранение..." : "Сохранить КП"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
