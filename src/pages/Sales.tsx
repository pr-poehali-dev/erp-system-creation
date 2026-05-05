import { useEffect, useState } from "react";
import { Role } from "@/App";
import Icon from "@/components/ui/icon";
import { api, Deal, Client, Staff } from "@/lib/api";

interface Props { role: Role; }

const STAGES: Record<string, string> = {
  new: "Новая",
  qualification: "Квалификация",
  proposal: "КП отправлено",
  negotiation: "Переговоры",
  contract: "Договор",
  lost: "Отказ",
};

const STAGE_CLS: Record<string, string> = {
  new: "badge-info",
  qualification: "badge-info",
  proposal: "badge-warning",
  negotiation: "badge-warning",
  contract: "badge-success",
  lost: "bg-gray-100 text-gray-600",
};

const SOURCES = ["Авито", "Сайт", "Рекомендация", "Инстаграм", "ВКонтакте", "Другое"];

const fmt = (n: number) =>
  n >= 1_000_000
    ? `₽ ${(n / 1_000_000).toFixed(1)} млн`
    : n >= 1000
    ? `₽ ${n.toLocaleString("ru")}`
    : `₽ ${n}`;

const EMPTY_FORM = {
  client_id: "",
  source: "",
  budget: "",
  start_date: "",
  manager_id: "",
  realtor_id: "",
  notes: "",
};

export default function Sales({ role }: Props) {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [managers, setManagers] = useState<Staff[]>([]);
  const [realtors, setRealtors] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [contractMsg, setContractMsg] = useState<number | null>(null);
  const [stagingSaving, setStagingSaving] = useState<number | null>(null);

  const loadDeals = () => {
    setLoading(true);
    api.deals
      .list()
      .then(setDeals)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDeals();
    api.clients().then(setClients);
    api.staff("crm_manager").then(setManagers);
    api.staff("realtor").then(setRealtors);
  }, []);

  const filtered = deals.filter(
    (d) =>
      d.client_name.toLowerCase().includes(search.toLowerCase()) ||
      d.code.toLowerCase().includes(search.toLowerCase())
  );

  const handleOpenModal = () => {
    setForm({ ...EMPTY_FORM });
    setFormError("");
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setFormError("");
  };

  const handleField = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.client_id) { setFormError("Выберите клиента"); return; }
    if (!form.budget) { setFormError("Укажите бюджет"); return; }
    if (!form.start_date) { setFormError("Укажите дату начала"); return; }
    if (!form.manager_id) { setFormError("Выберите менеджера"); return; }

    setSaving(true);
    setFormError("");
    try {
      await api.deals.create({
        client_id: Number(form.client_id),
        source: form.source,
        budget: Number(form.budget),
        start_date: form.start_date,
        manager_id: Number(form.manager_id),
        realtor_id: form.realtor_id ? Number(form.realtor_id) : null,
        notes: form.notes,
      });
      handleCloseModal();
      loadDeals();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const handleStageChange = async (deal: Deal, newStage: string) => {
    setStagingSaving(deal.id);
    try {
      await api.deals.updateStage(deal.id, newStage);
      if (newStage === "contract") {
        setContractMsg(deal.id);
        setTimeout(() => setContractMsg(null), 4000);
      }
      loadDeals();
    } finally {
      setStagingSaving(null);
    }
  };

  const stageCounts = Object.keys(STAGES).reduce(
    (acc, s) => ({ ...acc, [s]: deals.filter((d) => d.stage === s).length }),
    {} as Record<string, number>
  );
  const totalDeals = deals.length;
  const contractDeals = stageCounts["contract"] || 0;
  const conversion = totalDeals > 0 ? ((contractDeals / totalDeals) * 100).toFixed(1) : "0.0";
  const totalBudget = deals.reduce((s, d) => s + (d.budget || 0), 0);
  const avgBudget = totalDeals > 0 ? Math.round(totalBudget / totalDeals) : 0;

  const FUNNEL_COLORS: Record<string, string> = {
    new: "bg-blue-500",
    qualification: "bg-indigo-500",
    proposal: "bg-violet-500",
    negotiation: "bg-amber-500",
    contract: "bg-emerald-500",
    lost: "bg-gray-400",
  };
  const maxCount = Math.max(...Object.values(stageCounts), 1);

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Продажи и CRM</h1>
          <p className="text-hint mt-0.5">Воронка продаж, сделки, договоры</p>
        </div>
        <button
          onClick={handleOpenModal}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors"
        >
          <Icon name="Plus" size={14} />
          Новая сделка
        </button>
      </div>

      {/* Funnel */}
      <div className="bg-white rounded-xl border border-border p-5">
        <h2 className="font-semibold text-[15px] mb-4">Воронка продаж</h2>
        <div className="flex items-end gap-3 h-32">
          {Object.entries(STAGES).map(([key, label]) => (
            <div key={key} className="flex-1 flex flex-col items-center gap-2">
              <span className="text-[13px] font-semibold text-foreground">
                {loading ? "—" : stageCounts[key] ?? 0}
              </span>
              <div
                className={`w-full rounded-t-md ${FUNNEL_COLORS[key]} transition-all`}
                style={{
                  height: loading
                    ? "20%"
                    : `${(((stageCounts[key] ?? 0) / maxCount) * 100) || 4}%`,
                }}
              />
              <span className="text-hint text-[11px] text-center leading-tight">
                {label}
              </span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-4 mt-5 pt-4 border-t border-border">
          <div>
            <div className="text-hint">Конверсия (лид→договор)</div>
            <div className="text-[18px] font-bold text-foreground mt-1">
              {loading ? "—" : `${conversion}%`}
            </div>
          </div>
          <div>
            <div className="text-hint">Средний бюджет</div>
            <div className="text-[18px] font-bold text-foreground mt-1">
              {loading ? "—" : fmt(avgBudget)}
            </div>
          </div>
          <div>
            <div className="text-hint">Всего сделок</div>
            <div className="text-[18px] font-bold text-foreground mt-1">
              {loading ? "—" : totalDeals}
            </div>
          </div>
        </div>
      </div>

      {/* Contract message */}
      {contractMsg !== null && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-5 py-3 flex items-center gap-2">
          <Icon name="CheckCircle" size={15} className="text-emerald-600 shrink-0" />
          <span className="text-[13px] text-emerald-800">
            Сделка переведена в «Договор» — проект создан автоматически
          </span>
        </div>
      )}

      {/* Deals table */}
      <div className="bg-white rounded-xl border border-border">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <Icon name="Search" size={15} className="text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по клиенту или коду сделки..."
            className="flex-1 bg-transparent text-[13px] outline-none text-foreground placeholder:text-muted-foreground"
          />
          <button
            onClick={loadDeals}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-[12px] hover:bg-secondary transition-colors"
          >
            <Icon name="RefreshCw" size={12} className={loading ? "animate-spin" : ""} />
            Обновить
          </button>
        </div>

        {loading ? (
          <div className="divide-y divide-border">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="px-4 py-3.5 flex items-center gap-4 animate-pulse">
                <div className="h-4 bg-secondary rounded w-24" />
                <div className="h-4 bg-secondary rounded w-32 flex-1" />
                <div className="h-4 bg-secondary rounded w-20" />
                <div className="h-4 bg-secondary rounded w-20" />
                <div className="h-5 bg-secondary rounded-full w-24" />
                <div className="h-4 bg-secondary rounded w-28" />
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {["Код", "Клиент", "Телефон", "Источник", "Бюджет", "Менеджер", "Риэлтор", "Этап", ""].map(
                    (h) => (
                      <th key={h} className="px-4 py-3 text-left text-hint font-medium whitespace-nowrap">
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-hint">
                      Сделки не найдены
                    </td>
                  </tr>
                ) : (
                  filtered.map((d) => (
                    <tr key={d.id} className="hover:bg-background transition-colors">
                      <td className="px-4 py-3 text-[13px] text-primary font-medium whitespace-nowrap">
                        {d.code}
                      </td>
                      <td className="px-4 py-3 text-[13px] font-medium whitespace-nowrap">
                        {d.client_name}
                      </td>
                      <td className="px-4 py-3 text-hint whitespace-nowrap">
                        {d.client_phone}
                      </td>
                      <td className="px-4 py-3 text-[13px] whitespace-nowrap">
                        {d.source || "—"}
                      </td>
                      <td className="px-4 py-3 text-[13px] font-medium whitespace-nowrap">
                        {d.budget ? fmt(d.budget) : "—"}
                      </td>
                      <td className="px-4 py-3 text-[13px] whitespace-nowrap">
                        {d.manager_name || "—"}
                      </td>
                      <td className="px-4 py-3 text-[13px] whitespace-nowrap">
                        {d.realtor_name || "—"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                            STAGE_CLS[d.stage] || "badge-info"
                          }`}
                        >
                          {STAGES[d.stage] || d.stage}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <select
                          value={d.stage}
                          disabled={stagingSaving === d.id}
                          onChange={(e) => handleStageChange(d, e.target.value)}
                          className="text-[12px] border border-border rounded-md px-2 py-1 bg-white outline-none cursor-pointer hover:bg-secondary transition-colors disabled:opacity-50"
                        >
                          {Object.entries(STAGES).map(([key, label]) => (
                            <option key={key} value={key}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl border border-border shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="font-semibold text-[15px]">Новая сделка</h2>
              <button
                onClick={handleCloseModal}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Icon name="X" size={18} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-foreground mb-1">
                  Клиент <span className="text-red-500">*</span>
                </label>
                <select
                  name="client_id"
                  value={form.client_id}
                  onChange={handleField}
                  className="w-full border border-border rounded-lg px-3 py-2 text-[13px] bg-white outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">— Выберите клиента —</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[13px] font-medium text-foreground mb-1">
                  Источник
                </label>
                <select
                  name="source"
                  value={form.source}
                  onChange={handleField}
                  className="w-full border border-border rounded-lg px-3 py-2 text-[13px] bg-white outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">— Источник —</option>
                  {SOURCES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[13px] font-medium text-foreground mb-1">
                  Бюджет (₽) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="budget"
                  value={form.budget}
                  onChange={handleField}
                  placeholder="6500000"
                  min={0}
                  className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-foreground mb-1">
                  Дата начала <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="start_date"
                  value={form.start_date}
                  onChange={handleField}
                  className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-foreground mb-1">
                  Менеджер <span className="text-red-500">*</span>
                </label>
                <select
                  name="manager_id"
                  value={form.manager_id}
                  onChange={handleField}
                  className="w-full border border-border rounded-lg px-3 py-2 text-[13px] bg-white outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">— Выберите менеджера —</option>
                  {managers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[13px] font-medium text-foreground mb-1">
                  Риэлтор (опционально)
                </label>
                <select
                  name="realtor_id"
                  value={form.realtor_id}
                  onChange={handleField}
                  className="w-full border border-border rounded-lg px-3 py-2 text-[13px] bg-white outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">— Без риэлтора —</option>
                  {realtors.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[13px] font-medium text-foreground mb-1">
                  Примечания
                </label>
                <textarea
                  name="notes"
                  value={form.notes}
                  onChange={handleField}
                  rows={3}
                  placeholder="Комментарии к сделке..."
                  className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>

              {formError && (
                <div className="flex items-center gap-2 text-red-600 text-[13px]">
                  <Icon name="AlertCircle" size={14} />
                  {formError}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 px-4 py-2 border border-border rounded-lg text-[13px] hover:bg-secondary transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {saving ? "Сохранение..." : "Сохранить"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
