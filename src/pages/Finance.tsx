import { useEffect, useState } from "react";
import { Role } from "@/App";
import Icon from "@/components/ui/icon";
import { api, Payment, PLSummary, Project, Deal } from "@/lib/api";

interface Props { role: Role; }

const fmt = (n: number) =>
  n >= 1_000_000
    ? `₽ ${(n / 1_000_000).toFixed(2)} млн`
    : n >= 1000
    ? `₽ ${n.toLocaleString("ru")}`
    : `₽ ${n}`;

const CONTRACT_CATEGORIES = ["Основной договор", "Дополнительные услуги"] as const;

const EMPTY_FORM = {
  project_id: "",
  deal_id: "",
  type: "income",
  category: "Основной договор",
  amount: "",
  payment_date: "",
  description: "",
};

export default function Finance({ role }: Props) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [pl, setPl] = useState<PLSummary | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [plLoading, setPlLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const loadPayments = () => {
    setLoading(true);
    api.payments
      .list()
      .then(setPayments)
      .finally(() => setLoading(false));
  };

  const loadPl = () => {
    setPlLoading(true);
    api.payments
      .pl()
      .then(setPl)
      .finally(() => setPlLoading(false));
  };

  useEffect(() => {
    loadPayments();
    loadPl();
    api.projects.list().then(setProjects);
    api.deals.list().then(setDeals);
  }, []);

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
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) { setFormError("Укажите сумму"); return; }
    if (!form.payment_date) { setFormError("Укажите дату платежа"); return; }

    setSaving(true);
    setFormError("");
    try {
      await api.payments.create({
        project_id: form.project_id ? Number(form.project_id) : null,
        deal_id: form.deal_id ? Number(form.deal_id) : null,
        type: form.type,
        category: form.category,
        amount: Number(form.amount),
        payment_date: form.payment_date,
        description: form.description.trim(),
      });
      handleCloseModal();
      loadPayments();
      loadPl();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  // Group P&L rows by type
  const plIncomeRows = pl?.rows.filter((r) => r.type === "income") ?? [];
  const plExpenseRows = pl?.rows.filter((r) => r.type === "expense") ?? [];

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Финансы</h1>
          <p className="text-hint mt-0.5">P&L · платежи · движение средств</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { loadPayments(); loadPl(); }}
            className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-[13px] hover:bg-secondary transition-colors"
          >
            <Icon
              name="RefreshCw"
              size={13}
              className={loading || plLoading ? "animate-spin" : ""}
            />
            Обновить
          </button>
          <button
            onClick={handleOpenModal}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors"
          >
            <Icon name="BadgeCheck" size={14} />
            Зафиксировать оплату
          </button>
        </div>
      </div>

      {/* P&L Summary */}
      <div className="bg-white rounded-xl border border-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <Icon name="BarChart2" size={18} className="text-primary" />
          <h2 className="font-semibold text-[15px]">P&L — Прибыли и убытки</h2>
        </div>

        {plLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-background rounded-lg p-4 animate-pulse">
                <div className="h-3 bg-secondary rounded w-2/3 mb-3" />
                <div className="h-7 bg-secondary rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : pl ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
              <div className="bg-emerald-50 rounded-lg p-4">
                <div className="text-hint mb-1">Доходы</div>
                <div className="text-[20px] font-bold text-emerald-700">
                  {fmt(pl.income)}
                </div>
              </div>
              <div className="bg-red-50 rounded-lg p-4">
                <div className="text-hint mb-1">Расходы</div>
                <div className="text-[20px] font-bold text-red-600">
                  {fmt(pl.expense)}
                </div>
              </div>
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-hint mb-1">Прибыль</div>
                <div
                  className={`text-[20px] font-bold ${
                    pl.profit >= 0 ? "text-blue-700" : "text-red-600"
                  }`}
                >
                  {fmt(pl.profit)}
                </div>
              </div>
              <div className="bg-background rounded-lg p-4">
                <div className="text-hint mb-1">Маржа</div>
                <div
                  className={`text-[20px] font-bold ${
                    pl.margin >= 20
                      ? "text-emerald-700"
                      : pl.margin >= 10
                      ? "text-amber-600"
                      : "text-red-600"
                  }`}
                >
                  {pl.margin.toFixed(1)}%
                </div>
              </div>
            </div>

            {(plIncomeRows.length > 0 || plExpenseRows.length > 0) && (
              <div className="border-t border-border pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {plIncomeRows.length > 0 && (
                    <div>
                      <div className="text-[13px] font-semibold text-emerald-700 mb-2 flex items-center gap-1.5">
                        <Icon name="ArrowDownLeft" size={14} />
                        Доходы по категориям
                      </div>
                      <div className="space-y-1.5">
                        {plIncomeRows.map((row, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between text-[13px]"
                          >
                            <span className="text-foreground">{row.category}</span>
                            <span className="font-semibold text-emerald-600">
                              {fmt(row.total)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {plExpenseRows.length > 0 && (
                    <div>
                      <div className="text-[13px] font-semibold text-red-600 mb-2 flex items-center gap-1.5">
                        <Icon name="ArrowUpRight" size={14} />
                        Расходы по категориям
                      </div>
                      <div className="space-y-1.5">
                        {plExpenseRows.map((row, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between text-[13px]"
                          >
                            <span className="text-foreground">{row.category}</span>
                            <span className="font-semibold text-red-500">
                              {fmt(row.total)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-hint text-center py-8">Нет данных P&L</div>
        )}
      </div>

      {/* Payments table */}
      <div className="bg-white rounded-xl border border-border">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-[15px]">Последние платежи</h2>
          <span className="text-hint text-[13px]">
            {loading ? "—" : `${payments.length} записей`}
          </span>
        </div>

        {loading ? (
          <div className="divide-y divide-border">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="px-5 py-3.5 flex items-center gap-4 animate-pulse">
                <div className="h-4 bg-secondary rounded w-20" />
                <div className="h-4 bg-secondary rounded flex-1" />
                <div className="h-4 bg-secondary rounded w-24" />
                <div className="h-5 bg-secondary rounded-full w-20" />
                <div className="h-4 bg-secondary rounded w-28" />
              </div>
            ))}
          </div>
        ) : payments.length === 0 ? (
          <div className="px-5 py-10 text-center text-hint">
            <Icon name="CreditCard" size={28} className="mx-auto mb-2 text-muted-foreground" />
            Платежей пока нет
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {["Код", "Дата", "Тип", "Категория", "Сумма", "Проект", "Создал"].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-hint font-medium whitespace-nowrap"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-background transition-colors">
                    <td className="px-4 py-3 text-[13px] text-primary font-medium whitespace-nowrap">
                      {p.code}
                    </td>
                    <td className="px-4 py-3 text-hint whitespace-nowrap">
                      {new Date(p.payment_date).toLocaleDateString("ru-RU")}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                          p.type === "income" ? "badge-success" : "badge-error"
                        }`}
                      >
                        {p.type === "income" ? "Приход" : "Расход"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[13px] whitespace-nowrap">
                      {p.category}
                    </td>
                    <td
                      className={`px-4 py-3 text-[14px] font-bold whitespace-nowrap ${
                        p.type === "income" ? "text-emerald-600" : "text-red-500"
                      }`}
                    >
                      {p.type === "income" ? "+" : "−"}
                      {fmt(p.amount)}
                    </td>
                    <td className="px-4 py-3 text-[13px] whitespace-nowrap">
                      {p.project_code || p.deal_code || "—"}
                    </td>
                    <td className="px-4 py-3 text-hint whitespace-nowrap">
                      {p.created_by_name || "—"}
                    </td>
                  </tr>
                ))}
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
              <h2 className="font-semibold text-[15px]">Зафиксировать оплату</h2>
              <button
                onClick={handleCloseModal}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Icon name="X" size={18} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="px-5 py-4 space-y-4">
              {/* Сделка */}
              <div>
                <label className="block text-[13px] font-medium text-foreground mb-1">
                  Сделка / Проект <span className="text-red-500">*</span>
                </label>
                <select
                  name="deal_id"
                  value={form.deal_id}
                  onChange={handleField}
                  className="w-full border border-border rounded-lg px-3 py-2 text-[13px] bg-white outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">— Выберите сделку —</option>
                  {deals.filter(d => !d.is_archived).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.code} · {d.client_name}
                    </option>
                  ))}
                </select>
                {!form.deal_id && (
                  <div className="text-[11px] text-muted-foreground mt-1">
                    Или выберите проект:
                    <select
                      name="project_id"
                      value={form.project_id}
                      onChange={handleField}
                      className="ml-1 border border-border rounded px-2 py-0.5 text-[11px] bg-white outline-none"
                    >
                      <option value="">— без проекта —</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>{p.code} · {p.client_name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Тип */}
              <div>
                <label className="block text-[13px] font-medium text-foreground mb-1">
                  Тип платежа <span className="text-red-500">*</span>
                </label>
                <select
                  name="type"
                  value={form.type}
                  onChange={handleField}
                  className="w-full border border-border rounded-lg px-3 py-2 text-[13px] bg-white outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="income">Приход</option>
                  <option value="expense">Расход</option>
                </select>
              </div>

              {/* Назначение */}
              <div>
                <label className="block text-[13px] font-medium text-foreground mb-1">
                  Назначение <span className="text-red-500">*</span>
                </label>
                <select
                  name="category"
                  value={form.category}
                  onChange={handleField}
                  className="w-full border border-border rounded-lg px-3 py-2 text-[13px] bg-white outline-none focus:ring-1 focus:ring-primary"
                >
                  {CONTRACT_CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                  <option value="Другое">Другое</option>
                </select>
              </div>

              <div>
                <label className="block text-[13px] font-medium text-foreground mb-1">
                  Сумма (₽) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="amount"
                  value={form.amount}
                  onChange={handleField}
                  placeholder="150000"
                  min={0}
                  step="any"
                  className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-foreground mb-1">
                  Дата платежа <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="payment_date"
                  value={form.payment_date}
                  onChange={handleField}
                  className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-foreground mb-1">
                  Описание
                </label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleField}
                  rows={3}
                  placeholder="Дополнительная информация..."
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