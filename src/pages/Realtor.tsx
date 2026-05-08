import { useEffect, useMemo, useState } from "react";
import { Role } from "@/App";
import Icon from "@/components/ui/icon";
import { api, SerialProject, Deal, SlotItem, Staff, getCurrentUser } from "@/lib/api";
import RealtorNewDealModal from "@/components/realtor/RealtorNewDealModal";
import {
  QUALIFICATIONS,
  qualificationFor,
  commissionRate,
  nextLevelInfo,
  progressToNext,
} from "@/lib/commission";

interface Props { role: Role; }

const STAGE_LABEL: Record<string, { text: string; cls: string }> = {
  lead:       { text: "Новый",        cls: "bg-blue-100 text-blue-700" },
  kp:         { text: "КП",           cls: "bg-amber-100 text-amber-700" },
  contract:   { text: "Договор",      cls: "bg-violet-100 text-violet-700" },
  planning:   { text: "Планирование", cls: "bg-emerald-100 text-emerald-700" },
  closed:     { text: "Закрыта",      cls: "bg-emerald-100 text-emerald-700" },
};

export default function Realtor({ role }: Props) {
  const [tab, setTab]                       = useState<"catalog" | "deals">("catalog");
  const [projects, setProjects]             = useState<SerialProject[]>([]);
  const [deals, setDeals]                   = useState<Deal[]>([]);
  const [slots, setSlots]                   = useState<SlotItem[]>([]);
  const [me, setMe]                         = useState<Staff | null>(null);
  const [loading, setLoading]               = useState(true);
  const [search, setSearch]                 = useState("");
  const [newDealProject, setNewDealProject] = useState<SerialProject | null>(null);

  const loadAll = () => {
    setLoading(true);
    const { userId } = getCurrentUser();
    Promise.all([
      api.serial_projects.list(),
      api.deals.list(),
      api.slots.free(),
      api.staff("realtor"),
    ]).then(([sp, ds, sl, realtors]) => {
      setProjects(sp.filter(p => p.is_active));
      setDeals(ds);
      setSlots(sl);
      const meRow = realtors.find(r => r.id === userId) || realtors[0] || null;
      setMe(meRow);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { loadAll(); }, []);

  // Бэкенд уже отдаёт только сделки текущего риэлтора (по X-User-Id),
  // но для надёжности оставляем фильтр по realtor_name.
  const myDeals = useMemo(() =>
    deals.filter(d => d.realtor_name),
  [deals]);

  // Квалификация и текущая ставка комиссии
  const closedCount   = me?.closed_deals_count ?? 0;
  const qualKey       = me?.qualification ?? qualificationFor(closedCount);
  const qualInfo      = QUALIFICATIONS[qualKey];
  const currentRate   = commissionRate(closedCount); // % (3 / 4.5 / 5.5)
  const nextLvl       = nextLevelInfo(closedCount);
  const progressPct   = progressToNext(closedCount);

  // Сумма уже зафиксированной комиссии (по закрытым сделкам)
  // + прогноз по открытым сделкам по текущей ставке.
  const earnedCommission = useMemo(() =>
    myDeals.reduce((sum, d) => sum + (d.commission_amount || 0), 0),
  [myDeals]);
  const forecastCommission = useMemo(() =>
    myDeals
      .filter(d => d.stage !== "closed")
      .reduce((sum, d) => sum + (d.budget || 0) * (currentRate / 100), 0),
  [myDeals, currentRate]);

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(p => p.name.toLowerCase().includes(q));
  }, [projects, search]);

  return (
    <div className="space-y-5 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Личный кабинет риэлтора</h1>
          <p className="text-hint mt-0.5">
            {me?.name ? `${me.name} · ` : ""}квалификация «{qualInfo.label}» · комиссия {currentRate}% от суммы новых сделок
          </p>
        </div>
      </div>

      {/* Карточка квалификации */}
      <div className="bg-white border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon name="Award" size={20} className="text-primary" />
            </div>
            <div>
              <div className="text-[12px] text-hint">Текущая квалификация</div>
              <div className="text-[15px] font-semibold">
                {qualInfo.label} · {qualInfo.rate}%
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[12px] text-hint">Закрыто сделок</div>
            <div className="text-[15px] font-semibold">{closedCount}</div>
          </div>
        </div>
        {nextLvl ? (
          <>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="text-[12px] text-hint mt-1.5">
              До уровня «{QUALIFICATIONS[nextLvl.next].label}» ({QUALIFICATIONS[nextLvl.next].rate}%) — ещё {nextLvl.remaining} сделок
            </div>
          </>
        ) : (
          <div className="text-[12px] text-emerald-600 font-medium flex items-center gap-1">
            <Icon name="Trophy" size={13} />
            Достигнут максимальный уровень
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-hint text-[12px] mb-1">
            <Icon name="Briefcase" size={13} />
            Мои сделки
          </div>
          <div className="text-2xl font-bold">{myDeals.length}</div>
        </div>
        <div className="bg-white border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-hint text-[12px] mb-1">
            <Icon name="DollarSign" size={13} />
            Общая сумма сделок
          </div>
          <div className="text-2xl font-bold text-primary">
            ₽ {myDeals.reduce((s, d) => s + (d.budget || 0), 0).toLocaleString("ru")}
          </div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-emerald-700 text-[12px] mb-1 font-medium">
            <Icon name="Coins" size={13} />
            Заработано / прогноз
          </div>
          <div className="text-2xl font-bold text-emerald-700">
            ₽ {Math.round(earnedCommission).toLocaleString("ru")}
          </div>
          {forecastCommission > 0 && (
            <div className="text-[11px] text-emerald-700/70 mt-0.5">
              + ₽ {Math.round(forecastCommission).toLocaleString("ru")} прогноз по открытым
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button onClick={() => setTab("catalog")}
          className={`px-5 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${
            tab === "catalog" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}>
          <Icon name="LayoutGrid" size={13} className="inline mr-1.5" />
          Каталог проектов · {projects.length}
        </button>
        <button onClick={() => setTab("deals")}
          className={`px-5 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${
            tab === "deals" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}>
          <Icon name="Briefcase" size={13} className="inline mr-1.5" />
          Мои сделки · {myDeals.length}
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-secondary rounded-xl animate-pulse" />)}
        </div>
      ) : tab === "catalog" ? (
        <>
          {/* Поиск */}
          <div className="relative max-w-md">
            <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Поиск по названию проекта..."
              className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-[13px] bg-white outline-none focus:ring-1 focus:ring-primary" />
          </div>

          {/* Каталог */}
          {filteredProjects.length === 0 ? (
            <div className="text-center py-12 text-hint">
              <Icon name="PackageOpen" size={32} className="mx-auto mb-2" />
              {search ? "Ничего не найдено" : "Каталог пока пуст"}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredProjects.map(p => (
                <div key={p.id} className="bg-white border border-border rounded-xl p-4 space-y-3 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="font-semibold text-[14px]">{p.name}</div>
                      <div className="text-hint text-[12px] mt-0.5">
                        {p.area_sqm} м² · {p.base_duration_days} дн.
                      </div>
                    </div>
                    <div className="px-2 py-0.5 rounded-md bg-secondary text-[11px] font-medium text-muted-foreground shrink-0">
                      {p.config_count} конф.
                    </div>
                  </div>

                  {p.description && (
                    <div className="text-[12px] text-muted-foreground line-clamp-2">
                      {p.description}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <div>
                      <div className="text-hint text-[11px]">от</div>
                      <div className="text-[15px] font-bold text-primary">
                        ₽ {p.base_price.toLocaleString("ru")}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-hint text-[11px]">комиссия {currentRate}%</div>
                      <div className="text-[13px] font-semibold text-emerald-600">
                        ₽ {Math.round(p.base_price * currentRate / 100).toLocaleString("ru")}
                      </div>
                    </div>
                  </div>

                  <button type="button" onClick={() => setNewDealProject(p)}
                    className="w-full px-3 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5">
                    <Icon name="Plus" size={13} />
                    Создать сделку
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        // Мои сделки
        <>
          {myDeals.length === 0 ? (
            <div className="text-center py-12 text-hint">
              <Icon name="Briefcase" size={32} className="mx-auto mb-2" />
              У вас пока нет сделок
              <div className="mt-2">
                <button onClick={() => setTab("catalog")}
                  className="text-primary font-medium text-[13px] hover:underline">
                  Перейти в каталог →
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-border rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-secondary/50 text-left text-[11px] uppercase text-hint">
                    <th className="px-4 py-2.5 font-medium">Код</th>
                    <th className="px-4 py-2.5 font-medium">Клиент</th>
                    <th className="px-4 py-2.5 font-medium">Проект</th>
                    <th className="px-4 py-2.5 font-medium">Сумма</th>
                    <th className="px-4 py-2.5 font-medium">Этап</th>
                    <th className="px-4 py-2.5 font-medium text-right">Комиссия</th>
                  </tr>
                </thead>
                <tbody>
                  {myDeals.map(d => {
                    const stage = STAGE_LABEL[d.stage] || { text: d.stage, cls: "bg-secondary text-muted-foreground" };
                    const fixed = d.commission_amount != null;
                    const rateUsed = fixed ? (d.commission_rate ?? 0) : currentRate;
                    const commission = fixed
                      ? (d.commission_amount ?? 0)
                      : (d.budget || 0) * (currentRate / 100);
                    return (
                      <tr key={d.id} className="border-t border-border hover:bg-secondary/30 transition-colors">
                        <td className="px-4 py-3 text-[13px] font-bold text-primary">{d.code}</td>
                        <td className="px-4 py-3 text-[13px]">
                          <div className="font-medium">{d.client_name}</div>
                          <div className="text-hint text-[11px]">{d.client_phone}</div>
                        </td>
                        <td className="px-4 py-3 text-[12px] text-muted-foreground">
                          {d.serial_project_name || (d.project_type === "individual" ? "Индивидуальный" : "—")}
                        </td>
                        <td className="px-4 py-3 text-[13px] font-semibold">
                          ₽ {(d.budget || 0).toLocaleString("ru")}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[11px] px-2 py-0.5 rounded-md font-medium ${stage.cls}`}>
                            {stage.text}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="text-[13px] font-bold text-emerald-600">
                            ₽ {Math.round(commission).toLocaleString("ru")}
                          </div>
                          <div className="text-[10px] text-hint">
                            {fixed ? `зафикс. ${rateUsed}%` : `прогноз ${rateUsed}%`}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-emerald-50/50">
                    <td colSpan={3} className="px-4 py-3 text-[13px] font-semibold text-right">Итого:</td>
                    <td className="px-4 py-3 text-[13px] font-bold">
                      ₽ {myDeals.reduce((s, d) => s + (d.budget || 0), 0).toLocaleString("ru")}
                    </td>
                    <td></td>
                    <td className="px-4 py-3 text-[14px] font-bold text-emerald-700 text-right">
                      ₽ {Math.round(earnedCommission + forecastCommission).toLocaleString("ru")}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}

      {/* Модал создания сделки */}
      {newDealProject && (
        <RealtorNewDealModal
          project={newDealProject}
          slots={slots}
          onClose={() => setNewDealProject(null)}
          onCreated={() => {
            setNewDealProject(null);
            setTab("deals");
            loadAll();
          }}
        />
      )}
    </div>
  );
}