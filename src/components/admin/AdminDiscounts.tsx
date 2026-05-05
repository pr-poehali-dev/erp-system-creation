import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { api, SerialProject, Configuration } from "@/lib/api";

const fmtN = (n: number) => n.toLocaleString("ru");

export default function AdminDiscounts() {
  const [projects, setProjects] = useState<SerialProject[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState<number | null>(null);
  const [successId, setSuccessId] = useState<number | null>(null);

  // Форма скидки по cfg.id
  const [discounts, setDiscounts] = useState<Record<number, { pct: string; until: string }>>({});
  const [popularId, setPopularId] = useState<Record<number, number | null>>({}); // per project_id → cfg_id

  const load = async () => {
    setLoading(true);
    try {
      const projs = await api.serial_projects.list();
      setProjects(projs);
      // Инициализируем значения из данных
      const disc: Record<number, { pct: string; until: string }> = {};
      const pop: Record<number, number | null> = {};
      projs.forEach(p => {
        const popularCfg = p.configurations?.find(c => c.is_popular);
        pop[p.id] = popularCfg ? popularCfg.id : null;
        p.configurations?.forEach(c => {
          disc[c.id] = {
            pct:   c.discount_pct ? String(c.discount_pct) : "",
            until: c.discount_until || "",
          };
        });
      });
      setDiscounts(disc);
      setPopularId(pop);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSaveDiscount = async (cfg: Configuration, spId: number) => {
    setSaving(cfg.id);
    try {
      const pct   = parseFloat(discounts[cfg.id]?.pct || "0") || 0;
      const until = discounts[cfg.id]?.until || null;
      await api.configurations.update(cfg.id, { discount_pct: pct, discount_until: until });
      setSuccessId(cfg.id);
      setTimeout(() => setSuccessId(null), 3000);
      load();
    } finally { setSaving(null); }
  };

  const handleSetPopular = async (cfg: Configuration, spId: number) => {
    setSaving(cfg.id);
    try {
      const sp = projects.find(p => p.id === spId);
      // Снимаем популярное со всех конфигураций этого проекта
      if (sp?.configurations) {
        for (const c of sp.configurations) {
          if (c.is_popular && c.id !== cfg.id) {
            await api.configurations.update(c.id, { is_popular: false });
          }
        }
      }
      const newVal = popularId[spId] === cfg.id ? false : true;
      await api.configurations.update(cfg.id, { is_popular: newVal });
      setPopularId(p => ({ ...p, [spId]: newVal ? cfg.id : null }));
      load();
    } finally { setSaving(null); }
  };

  if (loading) return (
    <div className="bg-white rounded-xl border border-border p-5 space-y-2">
      {[1,2].map(i => <div key={i} className="h-16 bg-secondary rounded-lg animate-pulse" />)}
    </div>
  );

  return (
    <div className="bg-white rounded-xl border border-border">
      <div className="px-5 py-4 border-b border-border flex items-center gap-2">
        <Icon name="Tag" size={16} className="text-primary" />
        <h2 className="font-semibold text-[15px]">Скидки и популярные комплектации</h2>
      </div>

      <div className="px-5 py-3 bg-amber-50 border-b border-amber-100">
        <div className="text-[12px] text-amber-800 flex items-start gap-2">
          <Icon name="Info" size={13} className="shrink-0 mt-0.5" />
          При установке скидки менеджеры CRM получат уведомление. Отметьте «Самое популярное» — это социальное доказательство для клиентов.
        </div>
      </div>

      <div className="divide-y divide-border">
        {projects.map(project => (
          <div key={project.id} className="px-5 py-4 space-y-3">
            <div className="flex items-center gap-2">
              <Icon name="Home" size={14} className="text-primary shrink-0" />
              <span className="text-[14px] font-semibold">{project.name}</span>
              <span className="text-hint text-[12px]">{project.area_sqm} м²</span>
            </div>

            <div className="space-y-2">
              {(project.configurations || []).sort((a, b) => a.price_coefficient - b.price_coefficient).map(cfg => {
                const basePrice  = Math.round(project.base_price * cfg.price_coefficient);
                const discPct    = parseFloat(discounts[cfg.id]?.pct || "0") || 0;
                const finalPrice = discPct > 0 ? Math.round(basePrice * (1 - discPct / 100)) : basePrice;
                const isPopular  = popularId[project.id] === cfg.id;
                const isSaving   = saving === cfg.id;
                const isSuccess  = successId === cfg.id;

                return (
                  <div key={cfg.id} className={`border rounded-xl p-3 space-y-3 transition-all ${
                    isPopular ? "border-amber-300 bg-amber-50/60" : "border-border"
                  }`}>
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
                              <Icon name="Tag" size={9} />-{cfg.discount_pct}%
                            </span>
                          )}
                        </div>
                        <div className="text-hint text-[11px] mt-0.5">{cfg.description}</div>
                      </div>
                      <div className="text-right shrink-0">
                        {discPct > 0 && (
                          <div className="text-[11px] text-muted-foreground line-through">₽ {fmtN(basePrice)}</div>
                        )}
                        <div className={`text-[14px] font-bold ${discPct > 0 ? "text-red-600" : "text-emerald-600"}`}>
                          ₽ {fmtN(finalPrice)}
                        </div>
                      </div>
                    </div>

                    {/* Управление скидкой */}
                    <div className="flex items-end gap-2 flex-wrap">
                      <div className="flex-1 min-w-[120px]">
                        <label className="block text-[11px] font-medium text-muted-foreground mb-1">Скидка (%)</label>
                        <input type="number" min={0} max={50} step={1}
                          value={discounts[cfg.id]?.pct || ""}
                          onChange={e => setDiscounts(p => ({ ...p, [cfg.id]: { ...p[cfg.id], pct: e.target.value } }))}
                          placeholder="0"
                          className="w-full border border-border rounded-lg px-3 py-1.5 text-[12px] outline-none focus:ring-1 focus:ring-primary" />
                      </div>
                      <div className="flex-1 min-w-[140px]">
                        <label className="block text-[11px] font-medium text-muted-foreground mb-1">Действует до</label>
                        <input type="date"
                          value={discounts[cfg.id]?.until || ""}
                          onChange={e => setDiscounts(p => ({ ...p, [cfg.id]: { ...p[cfg.id], until: e.target.value } }))}
                          className="w-full border border-border rounded-lg px-3 py-1.5 text-[12px] outline-none focus:ring-1 focus:ring-primary" />
                      </div>
                      <button disabled={isSaving} onClick={() => handleSaveDiscount(cfg, project.id)}
                        className="px-3 py-1.5 bg-primary text-white rounded-lg text-[12px] font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors shrink-0">
                        {isSaving ? "..." : isSuccess ? "✓ Сохранено" : "Сохранить"}
                      </button>
                    </div>

                    {/* Кнопка популярное */}
                    <div className="pt-1 border-t border-border/60 flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">Отметить как «Самое популярное»:</span>
                      <button disabled={isSaving} onClick={() => handleSetPopular(cfg, project.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-colors ${
                          isPopular
                            ? "bg-amber-100 border-amber-300 text-amber-700 hover:bg-amber-200"
                            : "border-border text-muted-foreground hover:border-amber-300 hover:text-amber-700"
                        }`}>
                        <Icon name="Star" size={11} />
                        {isPopular ? "Снять метку" : "Отметить популярным"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
