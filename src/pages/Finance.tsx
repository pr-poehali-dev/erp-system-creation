import { useEffect, useState, useMemo } from "react";
import { Role } from "@/App";
import Icon from "@/components/ui/icon";
import { api, Payment, PLSummary, Project, Deal, Client } from "@/lib/api";

interface Props { role: Role; }

const fmt = (n: number) =>
  n >= 1_000_000
    ? `₽ ${(n / 1_000_000).toFixed(2)} млн`
    : n >= 1000
    ? `₽ ${n.toLocaleString("ru")}`
    : `₽ ${n}`;

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(n) + " ₽";

const INCOME_CATEGORIES = [
  "Основной договор",
  "Дополнительные услуги",
  "Предоплата",
  "Прочий доход",
];

const EXPENSE_CATEGORIES = [
  "Материалы",
  "Субподряд",
  "Зарплата",
  "Аренда техники",
  "Транспорт",
  "Накладные расходы",
  "Прочий расход",
];

const EMPTY_FORM = {
  project_id: "",
  deal_id: "",
  type: "income" as "income" | "expense",
  category: "Основной договор",
  amount: "",
  payment_date: new Date().toISOString().slice(0, 10),
  description: "",
  counterparty: "",
};

export default function Finance({ role }: Props) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [pl, setPl] = useState<PLSummary | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [plLoading, setPlLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Фильтры ДДС
  const [filterType, setFilterType] = useState<"" | "income" | "expense">("");
  const [filterProject, setFilterProject] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  const loadPayments = () => {
    setLoading(true);
    api.payments.list().then(setPayments).finally(() => setLoading(false));
  };

  const loadPl = () => {
    setPlLoading(true);
    api.payments.pl().then(setPl).finally(() => setPlLoading(false));
  };

  useEffect(() => {
    loadPayments();
    loadPl();
    api.projects.list().then(setProjects);
    api.deals.list().then(setDeals);
    api.clients().then(setClients);
  }, []);

  const openModal = (type: "income" | "expense") => {
    setForm({
      ...EMPTY_FORM,
      type,
      category: type === "income" ? "Основной договор" : "Материалы",
    });
    setFormError("");
    setModalOpen(true);
  };

  const handleField = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) { setFormError("Укажите сумму"); return; }
    if (!form.payment_date) { setFormError("Укажите дату"); return; }
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
        description: [form.description.trim(), form.counterparty.trim()].filter(Boolean).join(" · "),
      });
      setModalOpen(false);
      loadPayments();
      loadPl();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  // Фильтрация ДДС
  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      if (filterType && p.type !== filterType) return false;
      if (filterCategory && p.category !== filterCategory) return false;
      if (filterProject && p.project_code !== filterProject && p.deal_code !== filterProject) return false;
      if (filterFrom && p.payment_date < filterFrom) return false;
      if (filterTo && p.payment_date > filterTo) return false;
      return true;
    });
  }, [payments, filterType, filterCategory, filterProject, filterFrom, filterTo]);

  const totalIncome  = filteredPayments.filter(p => p.type === "income").reduce((s, p) => s + p.amount, 0);
  const totalExpense = filteredPayments.filter(p => p.type === "expense").reduce((s, p) => s + p.amount, 0);

  const plIncomeRows  = pl?.rows.filter(r => r.type === "income") ?? [];
  const plExpenseRows = pl?.rows.filter(r => r.type === "expense") ?? [];

  const allCategories = [...new Set(payments.map(p => p.category))].sort();
  const allProjectCodes = [...new Set(payments.map(p => p.project_code || p.deal_code).filter(Boolean))].sort();

  const categories = form.type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Финансы</h1>
          <p className="text-hint mt-0.5">P&L · ДДС · движение денежных средств</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { loadPayments(); loadPl(); }}
            className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-[13px] hover:bg-secondary transition-colors">
            <Icon name="RefreshCw" size={13} className={loading || plLoading ? "animate-spin" : ""} />
            Обновить
          </button>
          <button onClick={() => openModal("income")}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-[13px] font-medium hover:bg-emerald-700 transition-colors">
            <Icon name="ArrowDownLeft" size={14} />
            + ПРИХОД
          </button>
          <button onClick={() => openModal("expense")}
            className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg text-[13px] font-medium hover:bg-red-600 transition-colors">
            <Icon name="ArrowUpRight" size={14} />
            + РАСХОД
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
            {[1,2,3,4].map(i => (
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
                <div className="text-[20px] font-bold text-emerald-700">{fmt(pl.income)}</div>
              </div>
              <div className="bg-red-50 rounded-lg p-4">
                <div className="text-hint mb-1">Расходы</div>
                <div className="text-[20px] font-bold text-red-600">{fmt(pl.expense)}</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-hint mb-1">Прибыль</div>
                <div className={`text-[20px] font-bold ${pl.profit >= 0 ? "text-blue-700" : "text-red-600"}`}>
                  {fmt(pl.profit)}
                </div>
              </div>
              <div className="bg-background rounded-lg p-4">
                <div className="text-hint mb-1">Маржа</div>
                <div className={`text-[20px] font-bold ${pl.margin >= 20 ? "text-emerald-700" : pl.margin >= 10 ? "text-amber-600" : "text-red-600"}`}>
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
                        <Icon name="ArrowDownLeft" size={14} />Доходы по статьям
                      </div>
                      <div className="space-y-1.5">
                        {plIncomeRows.map((row, i) => (
                          <div key={i} className="flex items-center justify-between text-[13px]">
                            <span className="text-foreground">{row.category}</span>
                            <span className="font-semibold text-emerald-600">{fmt(row.total)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {plExpenseRows.length > 0 && (
                    <div>
                      <div className="text-[13px] font-semibold text-red-600 mb-2 flex items-center gap-1.5">
                        <Icon name="ArrowUpRight" size={14} />Расходы по статьям
                      </div>
                      <div className="space-y-1.5">
                        {plExpenseRows.map((row, i) => (
                          <div key={i} className="flex items-center justify-between text-[13px]">
                            <span className="text-foreground">{row.category}</span>
                            <span className="font-semibold text-red-500">{fmt(row.total)}</span>
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

      {/* ДДС — таблица операций */}
      <div className="bg-white rounded-xl border border-border">
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-[15px]">ДДС — Движение денежных средств</h2>
            <div className="flex items-center gap-4 text-[13px]">
              <span className="text-emerald-600 font-semibold">+{fmtMoney(totalIncome)}</span>
              <span className="text-red-500 font-semibold">−{fmtMoney(totalExpense)}</span>
              <span className={`font-bold ${totalIncome - totalExpense >= 0 ? "text-blue-700" : "text-red-600"}`}>
                = {fmtMoney(totalIncome - totalExpense)}
              </span>
            </div>
          </div>
          {/* Фильтры */}
          <div className="flex flex-wrap gap-2">
            <select value={filterType} onChange={e => setFilterType(e.target.value as "" | "income" | "expense")}
              className="border border-border rounded-lg px-2 py-1.5 text-[12px] bg-white outline-none focus:ring-1 focus:ring-primary">
              <option value="">Все типы</option>
              <option value="income">Приходы</option>
              <option value="expense">Расходы</option>
            </select>
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
              className="border border-border rounded-lg px-2 py-1.5 text-[12px] bg-white outline-none focus:ring-1 focus:ring-primary">
              <option value="">Все статьи</option>
              {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
              className="border border-border rounded-lg px-2 py-1.5 text-[12px] bg-white outline-none focus:ring-1 focus:ring-primary">
              <option value="">Все проекты</option>
              {allProjectCodes.map(c => <option key={c as string} value={c as string}>{c}</option>)}
            </select>
            <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
              className="border border-border rounded-lg px-2 py-1.5 text-[12px] outline-none focus:ring-1 focus:ring-primary" />
            <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
              className="border border-border rounded-lg px-2 py-1.5 text-[12px] outline-none focus:ring-1 focus:ring-primary" />
            {(filterType || filterCategory || filterProject || filterFrom || filterTo) && (
              <button onClick={() => { setFilterType(""); setFilterCategory(""); setFilterProject(""); setFilterFrom(""); setFilterTo(""); }}
                className="flex items-center gap-1 px-2 py-1.5 text-[12px] text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-secondary transition-colors">
                <Icon name="X" size={11} />Сбросить
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="divide-y divide-border">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="px-5 py-3.5 flex items-center gap-4 animate-pulse">
                <div className="h-4 bg-secondary rounded w-20" />
                <div className="h-4 bg-secondary rounded flex-1" />
                <div className="h-4 bg-secondary rounded w-24" />
                <div className="h-5 bg-secondary rounded-full w-20" />
                <div className="h-4 bg-secondary rounded w-28" />
              </div>
            ))}
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="px-5 py-10 text-center text-hint">
            <Icon name="CreditCard" size={28} className="mx-auto mb-2 text-muted-foreground" />
            {payments.length === 0 ? "Операций пока нет" : "Нет операций по фильтру"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {["Дата","Тип","Статья","Сумма","Проект/Сделка","Описание","Создал"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-hint font-medium whitespace-nowrap text-[12px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredPayments.map(p => (
                  <tr key={p.id} className="hover:bg-background transition-colors">
                    <td className="px-4 py-3 text-[12px] text-hint whitespace-nowrap">
                      {new Date(p.payment_date).toLocaleDateString("ru-RU")}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium ${
                        p.type === "income"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-red-100 text-red-700"
                      }`}>
                        <Icon name={p.type === "income" ? "ArrowDownLeft" : "ArrowUpRight"} size={10} />
                        {p.type === "income" ? "Приход" : "Расход"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[13px] whitespace-nowrap">{p.category}</td>
                    <td className={`px-4 py-3 text-[14px] font-bold whitespace-nowrap ${
                      p.type === "income" ? "text-emerald-600" : "text-red-500"
                    }`}>
                      {p.type === "income" ? "+" : "−"}{fmt(p.amount)}
                    </td>
                    <td className="px-4 py-3 text-[13px] whitespace-nowrap text-primary font-medium">
                      {p.project_code || p.deal_code || "—"}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-hint max-w-[200px] truncate">
                      {p.description || "—"}
                    </td>
                    <td className="px-4 py-3 text-hint text-[12px] whitespace-nowrap">
                      {p.created_by_name || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Модалка создания операции */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl border border-border shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-fade-in">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                  form.type === "income" ? "bg-emerald-100" : "bg-red-100"
                }`}>
                  <Icon name={form.type === "income" ? "ArrowDownLeft" : "ArrowUpRight"} size={15}
                    className={form.type === "income" ? "text-emerald-700" : "text-red-600"} />
                </div>
                <h2 className="font-semibold text-[15px]">
                  {form.type === "income" ? "Новый приход" : "Новый расход"}
                </h2>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <Icon name="X" size={18} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="px-5 py-4 space-y-4">

              {/* Сумма */}
              <div>
                <label className="block text-[13px] font-medium mb-1">
                  Сумма (₽) <span className="text-red-500">*</span>
                </label>
                <input type="number" name="amount" value={form.amount} onChange={handleField}
                  placeholder="150 000"
                  min={0} step="any"
                  className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
              </div>

              {/* Дата */}
              <div>
                <label className="block text-[13px] font-medium mb-1">
                  Дата <span className="text-red-500">*</span>
                </label>
                <input type="date" name="payment_date" value={form.payment_date} onChange={handleField}
                  className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
              </div>

              {/* Статья */}
              <div>
                <label className="block text-[13px] font-medium mb-1">Статья <span className="text-red-500">*</span></label>
                <select name="category" value={form.category} onChange={handleField}
                  className="w-full border border-border rounded-lg px-3 py-2 text-[13px] bg-white outline-none focus:ring-1 focus:ring-primary">
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Проект / Сделка */}
              <div>
                <label className="block text-[13px] font-medium mb-1">Проект / Сделка (опционально)</label>
                <select name="deal_id" value={form.deal_id} onChange={handleField}
                  className="w-full border border-border rounded-lg px-3 py-2 text-[13px] bg-white outline-none focus:ring-1 focus:ring-primary mb-2">
                  <option value="">— Выберите сделку —</option>
                  {deals.filter(d => !d.is_archived).map(d => (
                    <option key={d.id} value={d.id}>{d.code} · {d.client_name}</option>
                  ))}
                </select>
                {!form.deal_id && (
                  <select name="project_id" value={form.project_id} onChange={handleField}
                    className="w-full border border-border rounded-lg px-3 py-2 text-[13px] bg-white outline-none focus:ring-1 focus:ring-primary">
                    <option value="">— или выберите проект —</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.code} · {p.client_name}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Контрагент */}
              <div>
                <label className="block text-[13px] font-medium mb-1">Контрагент</label>
                <input type="text" name="counterparty" value={form.counterparty} onChange={handleField}
                  placeholder="Название или ФИО"
                  list="counterparty-list"
                  className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
                <datalist id="counterparty-list">
                  {clients.map(c => <option key={c.id} value={c.name} />)}
                </datalist>
              </div>

              {/* Описание */}
              <div>
                <label className="block text-[13px] font-medium mb-1">Описание</label>
                <textarea name="description" value={form.description} onChange={handleField}
                  rows={2}
                  placeholder="Дополнительная информация..."
                  className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary resize-none" />
              </div>

              {formError && (
                <div className="flex items-center gap-2 text-red-600 text-[13px]">
                  <Icon name="AlertCircle" size={14} />{formError}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-border rounded-lg text-[13px] hover:bg-secondary transition-colors">
                  Отмена
                </button>
                <button type="submit" disabled={saving}
                  className={`flex-1 px-4 py-2 text-white rounded-lg text-[13px] font-medium transition-colors disabled:opacity-50 ${
                    form.type === "income"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-red-500 hover:bg-red-600"
                  }`}>
                  {saving ? "Сохранение..." : form.type === "income" ? "Сохранить приход" : "Сохранить расход"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
