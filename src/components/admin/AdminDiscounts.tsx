import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { api, SerialProject } from "@/lib/api";

const fmtN = (n: number) => n.toLocaleString("ru");

export default function AdminDiscounts() {
  const [projects, setProjects]     = useState<SerialProject[]>([]);
  const [loading, setLoading]       = useState(true);
  const [savingId, setSavingId]     = useState<number | null>(null);
  const [successId, setSuccessId]   = useState<number | null>(null);
  const [errorMsg, setErrorMsg]     = useState("");

  // локальные правки скидок: cfg.id → { pct, until }
  const [discounts, setDiscounts] = useState<Record<number, { pct: string; until: string }>>({});
  // популярное: project_id → cfg_id (или null)
  const [popularMap, setPopularMap] = useState<Record<number, number | null>>({});

  const load = async () => {
    setLoading(true);
    try {
      const projs = await api.serial_projects.list();
      setProjects(projs);
      const disc: Record<number, { pct: string; until: string }> = {};
      const pop: Record<number, number | null> = {};
      projs.forEach(p => {
        const popCfg = p.configurations?.find(c => c.is_popular);
        pop[p.id] = popCfg ? popCfg.id : null;
        p.configurations?.forEach(c => {
          disc[c.id] = {
            pct:   c.discount_pct > 0 ? String(c.discount_pct) : "",
            until: c.discount_until || "",
          };
        });
      });
      setDiscounts(disc);
      setPopularMap(pop);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // Авто-сброс уведомления об успехе с корректным cleanup таймера
  useEffect(() => {
    if (successId === null) return;
    const t = setTimeout(() => setSuccessId(null), 3000);
    return () => clearTimeout(t);
  }, [successId]);

  const handleSaveDiscount = async (cfgId: number) => {
    setSavingId(cfgId);
    setErrorMsg("");
    try {
      const pct   = parseFloat(discounts[cfgId]?.pct || "0") || 0;
      const until = discounts[cfgId]?.until || null;
      await api.configurations.update(cfgId, { discount_pct: pct, discount_until: until || "" });
      setSuccessId(cfgId);
      // Обновляем только данные проектов без сброса форм
      const projs = await api.serial_projects.list();
      setProjects(projs);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Не удалось сохранить скидку. Попробуйте ещё раз.");
    } finally { setSavingId(null); }
  };

  const handleTogglePopular = async (cfgId: number, projectId: number) => {
    setSavingId(cfgId);
    setErrorMsg("");
    try {
      const currentPopular = popularMap[projectId];
      const isAlreadyPopular = currentPopular === cfgId;

      // Если уже популярно — снимаем, иначе — ставим
      if (isAlreadyPopular) {
        await api.configurations.update(cfgId, { is_popular: false });
        setPopularMap(p => ({ ...p, [projectId]: null }));
      } else {
        // Снимаем со старого
        if (currentPopular) {
          await api.configurations.update(currentPopular, { is_popular: false });
        }
        await api.configurations.update(cfgId, { is_popular: true });
        setPopularMap(p => ({ ...p, [projectId]: cfgId }));
      }
      // Обновляем данные
      const projs = await api.serial_projects.list();
      setProjects(projs);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Не удалось обновить настройку. Попробуйте ещё раз.");
    } finally { setSavingId(null); }
  };

  if (loading) return (
    <div className="p-5 space-y-2">
      {[1,2].map(i => <div key={i} className="h-16 bg-secondary rounded-lg animate-pulse" />)}
    </div>
  );

  return (
    <div className="divide-y divide-border">
      {errorMsg && (
        <div className="px-5 py-3 bg-red-50 flex items-start gap-2">
          <Icon name="AlertCircle" size={13} className="text-red-500 shrink-0 mt-0.5" />
          <span className="text-[12px] text-red-700 flex-1">{errorMsg}</span>
          <button onClick={() => setErrorMsg("")} className="text-red-400 hover:text-red-600">
            <Icon name="X" size={13} />
          </button>
        </div>
      )}
      <div className="px-5 py-3 bg-amber-50 flex items-start gap-2">
        <Icon name="Info" size={13} className="text-amber-600 shrink-0 mt-0.5" />
        <span className="text-[12px] text-amber-800">
          При установке скидки менеджеры CRM получат уведомление в колокольчик. Изменения применяются к новым КП.
        </span>
      </div>

      {projects.map(project => (
        <div key={project.id} className="px-5 py-4 space-y-3">
          <div className="flex items-center gap-2">
            <Icon name="Home" size={14} className="text-primary shrink-0" />
            <span className="text-[14px] font-semibold">{project.name}</span>
            <span className="text-hint text-[12px]">{project.area_sqm} м²</span>
          </div>

          <div className="space-y-2">
            {[...(project.configurations || [])].sort((a, b) => a.price_coefficient - b.price_coefficient).map(cfg => {
              const basePrice   = Math.round(project.base_price * cfg.price_coefficient);
              const localPct    = parseFloat(discounts[cfg.id]?.pct || "0") || 0;
              const finalPrice  = localPct > 0 ? Math.round(basePrice * (1 - localPct / 100)) : basePrice;
              const isPopular   = popularMap[project.id] === cfg.id;
              const isSaving    = savingId === cfg.id;
              const isSuccess   = successId === cfg.id;

              return (
                <div key={cfg.id} className={`border rounded-xl p-3 space-y-3 transition-colors ${
                  isPopular ? "border-amber-300 bg-amber-50/60" : "border-border"
                }`}>
                  {/* Заголовок */}
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-semibold">{cfg.name}</span>
                        {isPopular && (
                          <span className="flex items-center gap-1 text-[10px] bg-amber-100 text-amber-700 border border-amber-300 px-1.5 py-0.5 rounded-md font-semibold">
                            <Icon name="Star" size={9} />Самое популярное
                          </span>
                        )}
                        {cfg.discount_pct > 0 && (
                          <span className="flex items-center gap-1 text-[10px] bg-red-50 text-red-600 border border-red-200 px-1.5 py-0.5 rounded-md font-semibold">
                            <Icon name="Tag" size={9} />−{cfg.discount_pct}%
                          </span>
                        )}
                      </div>
                      <div className="text-hint text-[11px] mt-0.5">{cfg.description}</div>
                    </div>
                    <div className="text-right shrink-0">
                      {localPct > 0 && (
                        <div className="text-[11px] text-muted-foreground line-through">₽ {fmtN(basePrice)}</div>
                      )}
                      <div className={`text-[14px] font-bold ${localPct > 0 ? "text-red-600" : "text-emerald-600"}`}>
                        ₽ {fmtN(finalPrice)}
                      </div>
                    </div>
                  </div>

                  {/* Скидка */}
                  <div className="flex items-end gap-2 flex-wrap">
                    <div className="w-24 shrink-0">
                      <label className="block text-[11px] font-medium text-muted-foreground mb-1">Скидка %</label>
                      <input type="number" min={0} max={50} step={1}
                        value={discounts[cfg.id]?.pct || ""}
                        onChange={e => setDiscounts(p => ({ ...p, [cfg.id]: { ...p[cfg.id], pct: e.target.value } }))}
                        placeholder="0"
                        className="w-full border border-border rounded-lg px-3 py-1.5 text-[12px] outline-none focus:ring-1 focus:ring-primary" />
                    </div>
                    <div className="flex-1 min-w-[130px]">
                      <label className="block text-[11px] font-medium text-muted-foreground mb-1">Действует до</label>
                      <input type="date"
                        value={discounts[cfg.id]?.until || ""}
                        onChange={e => setDiscounts(p => ({ ...p, [cfg.id]: { ...p[cfg.id], until: e.target.value } }))}
                        className="w-full border border-border rounded-lg px-3 py-1.5 text-[12px] outline-none focus:ring-1 focus:ring-primary" />
                    </div>
                    <button disabled={isSaving} onClick={() => handleSaveDiscount(cfg.id)}
                      className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors shrink-0 ${
                        isSuccess
                          ? "bg-emerald-500 text-white"
                          : "bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
                      }`}>
                      {isSaving ? "..." : isSuccess ? "✓ Сохранено" : "Сохранить"}
                    </button>
                  </div>

                  {/* Популярное */}
                  <div className="flex items-center justify-between pt-1 border-t border-border/50">
                    <span className="text-[11px] text-muted-foreground">Социальное доказательство:</span>
                    <button disabled={isSaving} onClick={() => handleTogglePopular(cfg.id, project.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-colors ${
                        isPopular
                          ? "bg-amber-100 border-amber-300 text-amber-800 hover:bg-amber-200"
                          : "border-border text-muted-foreground hover:border-amber-300 hover:text-amber-700 hover:bg-amber-50"
                      }`}>
                      <Icon name="Star" size={10} />
                      {isSaving ? "..." : isPopular ? "Убрать «Популярное»" : "Отметить как популярное"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}