import { useEffect, useMemo, useState } from "react";
import { Role } from "@/App";
import Icon from "@/components/ui/icon";
import { api, Deal, Staff, getCurrentUser } from "@/lib/api";
import {
  QUALIFICATIONS,
  qualificationFor,
  nextLevelInfo,
  progressToNext,
} from "@/lib/commission";

interface Props { role: Role; }

const STAGE_LABEL: Record<string, { text: string; cls: string }> = {
  lead:        { text: "Новый лид",    cls: "bg-blue-100 text-blue-700" },
  kp:          { text: "КП",          cls: "bg-amber-100 text-amber-700" },
  contract:    { text: "Договор",     cls: "bg-violet-100 text-violet-700" },
  planning:    { text: "Планирование",cls: "bg-emerald-100 text-emerald-700" },
  closed:      { text: "Закрыта",     cls: "bg-gray-100 text-gray-600" },
  lost:        { text: "Отказ",       cls: "bg-red-100 text-red-600" },
  negotiation: { text: "Переговоры",  cls: "bg-blue-100 text-blue-700" },
  proposal:    { text: "Предложение", cls: "bg-amber-100 text-amber-700" },
};

export default function Realtor({ role: _role }: Props) {
  const [deals, setDeals]   = useState<Deal[]>([]);
  const [me, setMe]         = useState<Staff | null>(null);
  const [loading, setLoading] = useState(true);

  const { userId } = getCurrentUser();

  const load = () => {
    setLoading(true);
    Promise.all([
      api.deals.list(),
      api.deals.listArchived(),
      api.staff("realtor"),
    ]).then(([active, archived, realtors]) => {
      // Объединяем активные и архивные — бэкенд уже отдаёт только сделки текущего риэлтора
      setDeals([...active, ...archived]);
      const meRow = realtors.find(r => r.id === userId) || realtors[0] || null;
      setMe(meRow);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // Бэкенд уже фильтрует по realtor_id = user_id, поэтому все сделки — наши
  const myDeals = useMemo(() => deals, [deals]);

  const closedCount  = me?.closed_deals_count ?? 0;
  const qualKey      = me?.qualification ?? qualificationFor(closedCount);
  const qualInfo     = QUALIFICATIONS[qualKey];
  const nextLvl      = nextLevelInfo(closedCount);
  const progressPct  = progressToNext(closedCount);

  // Только фактически зафиксированная комиссия по закрытым сделкам
  const earnedCommission = useMemo(() =>
    myDeals
      .filter(d => d.stage === "closed")
      .reduce((s, d) => s + (d.commission_amount || 0), 0),
  [myDeals]);

  return (
    <div className="space-y-5 max-w-[1200px]">
      <div>
        <h1 className="text-xl font-semibold">Мои KPI</h1>
        <p className="text-hint mt-0.5">
          {me?.name ? `${me.name} · ` : ""}квалификация «{qualInfo.label}» · {qualInfo.rate}% комиссии
        </p>
      </div>

      {/* Карточка квалификации */}
      <div className="bg-white border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
              <Icon name="Award" size={22} className="text-primary" />
            </div>
            <div>
              <div className="text-[12px] text-hint">Текущая квалификация</div>
              <div className="text-[16px] font-bold">{qualInfo.label} · {qualInfo.rate}%</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[12px] text-hint">Закрыто сделок</div>
            <div className="text-[22px] font-bold">{closedCount}</div>
          </div>
        </div>

        {nextLvl ? (
          <>
            <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progressPct}%` }} />
            </div>
            <div className="text-[12px] text-hint mt-1.5">
              До уровня «{QUALIFICATIONS[nextLvl.next].label}» ({QUALIFICATIONS[nextLvl.next].rate}%) — ещё {nextLvl.remaining} сделок
            </div>
          </>
        ) : (
          <div className="text-[12px] text-emerald-600 font-medium flex items-center gap-1.5">
            <Icon name="Trophy" size={14} />
            Достигнут максимальный уровень — Профи 5.5%
          </div>
        )}
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-hint text-[12px] mb-1">
            <Icon name="Briefcase" size={13} />
            Всего сделок
          </div>
          <div className="text-2xl font-bold">{myDeals.length}</div>
          <div className="text-[11px] text-hint mt-0.5">{closedCount} закрыто</div>
        </div>
        <div className="bg-white border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-hint text-[12px] mb-1">
            <Icon name="TrendingUp" size={13} />
            Выручка (закрытые)
          </div>
          <div className="text-2xl font-bold text-primary">
            ₽ {myDeals.filter(d => d.stage === "closed").reduce((s, d) => s + (d.budget || 0), 0).toLocaleString("ru")}
          </div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-emerald-700 text-[12px] mb-1 font-medium">
            <Icon name="Coins" size={13} />
            Комиссия заработана
          </div>
          <div className="text-2xl font-bold text-emerald-700">
            ₽ {Math.round(earnedCommission).toLocaleString("ru")}
          </div>
          <div className="text-[11px] text-emerald-700/70 mt-0.5">
            фактически, по закрытым сделкам
          </div>
        </div>
      </div>

      {/* Таблица сделок с комиссиями */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[14px] font-semibold">История сделок</h2>
          <button onClick={load} className="text-[12px] text-muted-foreground hover:text-foreground flex items-center gap-1">
            <Icon name="RefreshCw" size={12} className={loading ? "animate-spin" : ""} />
            Обновить
          </button>
        </div>

        {loading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 bg-secondary rounded-xl animate-pulse" />)}</div>
        ) : myDeals.length === 0 ? (
          <div className="text-center py-10 text-hint bg-white border border-dashed border-border rounded-xl">
            <Icon name="Briefcase" size={28} className="mx-auto mb-2" />
            <div className="text-[13px]">Сделок пока нет</div>
            <div className="text-[12px] mt-1">Перейдите в раздел «Продажи и CRM» чтобы создать первую сделку</div>
          </div>
        ) : (
          <div className="bg-white border border-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-secondary/50 text-left text-[11px] uppercase text-hint">
                  <th className="px-4 py-2.5 font-medium">Код</th>
                  <th className="px-4 py-2.5 font-medium">Клиент</th>
                  <th className="px-4 py-2.5 font-medium">Проект</th>
                  <th className="px-4 py-2.5 font-medium text-right">Сумма</th>
                  <th className="px-4 py-2.5 font-medium">Этап</th>
                  <th className="px-4 py-2.5 font-medium text-right">Комиссия</th>
                </tr>
              </thead>
              <tbody>
                {myDeals.map(d => {
                  const stage    = STAGE_LABEL[d.stage] || { text: d.stage, cls: "bg-secondary text-muted-foreground" };
                  const isClosed = d.stage === "closed";
                  return (
                    <tr key={d.id} className={`border-t border-border hover:bg-secondary/30 transition-colors ${d.is_archived ? "opacity-70" : ""}`}>
                      <td className="px-4 py-3 text-[13px] font-bold text-primary">
                        {d.code}
                        {d.is_archived && <span className="ml-1 text-[10px] text-hint font-normal">(архив)</span>}
                      </td>
                      <td className="px-4 py-3 text-[13px]">
                        <div className="font-medium">{d.client_name}</div>
                        <div className="text-hint text-[11px]">{d.client_phone}</div>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-muted-foreground">
                        {d.serial_project_name || (d.project_type === "individual" ? "Индивидуальный" : "—")}
                      </td>
                      <td className="px-4 py-3 text-[13px] font-semibold text-right">
                        {d.budget ? `₽ ${Number(d.budget).toLocaleString("ru")}` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[11px] px-2 py-0.5 rounded-md font-medium ${stage.cls}`}>
                          {stage.text}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isClosed && d.commission_amount != null ? (
                          <>
                            <div className="text-[13px] font-bold text-emerald-700">
                              ₽ {Math.round(Number(d.commission_amount)).toLocaleString("ru")}
                            </div>
                            <div className="text-[10px] text-emerald-600 font-medium">
                              к выплате · {d.commission_rate}%
                            </div>
                          </>
                        ) : (
                          <span className="text-hint text-[12px]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-emerald-50/50">
                  <td colSpan={3} className="px-4 py-3 text-[13px] font-semibold text-right">Итого:</td>
                  <td className="px-4 py-3 text-[13px] font-bold text-right">
                    ₽ {myDeals.reduce((s, d) => s + (d.budget || 0), 0).toLocaleString("ru")}
                  </td>
                  <td></td>
                  <td className="px-4 py-3 text-[14px] font-bold text-emerald-700 text-right">
                    ₽ {Math.round(earnedCommission).toLocaleString("ru")}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}