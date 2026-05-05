import { useEffect, useState } from "react";
import { Role } from "@/App";
import Icon from "@/components/ui/icon";
import { api, Employee } from "@/lib/api";

interface Props { role: Role; }

const ROLE_LABELS: Record<string, string> = {
  crm_manager: "Менеджер CRM", realtor: "Риэлтор",
  foreman: "Прораб", quality: "Инспектор ОТК",
  mechanic: "Механик", supplier: "Снабженец",
  accountant: "Бухгалтер", director: "Генеральный директор",
  commercial: "Коммерческий директор", construction_director: "Директор по строительству",
  supply_director: "Директор по снабжению", finance_director: "Финансовый директор",
  project_manager: "Руководитель проекта",
};

const DEPTS = ["Все", "Продажи", "Строительство", "Снабжение", "Качество", "Техника", "Финансы"];

const EMPTY_FORM = { name: "", role: "crm_manager" };

export default function Employees({ role }: Props) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDept, setActiveDept] = useState("Все");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const load = () => {
    setLoading(true);
    api.employees.list().then(setEmployees).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = activeDept === "Все"
    ? employees
    : employees.filter(e => e.dept === activeDept);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setFormError("Введите имя"); return; }
    setSaving(true);
    setFormError("");
    try {
      await api.employees.create(form);
      setModalOpen(false);
      load();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Сотрудники</h1>
          <p className="text-hint mt-0.5">Команда · {employees.length} человек</p>
        </div>
        {(role === "director" || role === "commercial") && (
          <button
            onClick={() => { setForm({ ...EMPTY_FORM }); setFormError(""); setModalOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors"
          >
            <Icon name="Plus" size={14} />
            Добавить сотрудника
          </button>
        )}
      </div>

      {/* Dept filter */}
      <div className="flex gap-2 flex-wrap">
        {DEPTS.map(d => (
          <button
            key={d}
            onClick={() => setActiveDept(d)}
            className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
              activeDept === d
                ? "bg-primary text-white"
                : "bg-white border border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            {d}
            {d !== "Все" && (
              <span className="ml-1.5 text-[11px] opacity-70">
                {employees.filter(e => e.dept === d).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="bg-white rounded-xl border border-border p-5 animate-pulse">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-full bg-secondary shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-secondary rounded w-3/4" />
                  <div className="h-3 bg-secondary rounded w-1/2" />
                </div>
              </div>
              <div className="mt-4 h-1.5 bg-secondary rounded-full" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(emp => (
            <div key={emp.id} className="bg-white rounded-xl border border-border p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-[15px] shrink-0">
                  {emp.name.split(" ").slice(0, 2).map(n => n[0]).join("")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold truncate">{emp.name}</div>
                  <div className="text-hint text-[12px]">{ROLE_LABELS[emp.role] || emp.role}</div>
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-medium badge-success mt-1 inline-block">
                    {emp.dept}
                  </span>
                </div>
              </div>

              {/* KPI bar */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-hint">KPI</span>
                  <span className={`text-[12px] font-bold ${emp.kpi >= 80 ? "text-emerald-600" : "text-amber-600"}`}>
                    {emp.kpi}%
                  </span>
                </div>
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${emp.kpi >= 80 ? "bg-emerald-500" : "bg-amber-400"}`}
                    style={{ width: `${emp.kpi}%` }}
                  />
                </div>
              </div>

              {/* Stats */}
              <div className="mt-3 flex items-center justify-between text-[12px] text-hint">
                <span>{emp.dept}</span>
                {emp.deals_count !== null && emp.deals_count !== undefined && (
                  <span>{emp.deals_count} сделок · {emp.contracts_count ?? 0} договоров</span>
                )}
                {emp.active_projects !== undefined && (
                  <span>{emp.active_projects} активных объектов</span>
                )}
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="col-span-3 py-16 text-center text-hint">
              <Icon name="Users" size={32} className="mx-auto mb-3 opacity-30" />
              Сотрудники не найдены
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl border border-border shadow-xl w-full max-w-md animate-fade-in">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="font-semibold text-[15px]">Новый сотрудник</h2>
              <button onClick={() => setModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <Icon name="X" size={18} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-[13px] font-medium mb-1">ФИО <span className="text-red-500">*</span></label>
                <input
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Иванов Иван Иванович"
                  className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium mb-1">Роль <span className="text-red-500">*</span></label>
                <select
                  value={form.role}
                  onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-[13px] bg-white outline-none focus:ring-1 focus:ring-primary"
                >
                  {Object.entries(ROLE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              {formError && (
                <div className="flex items-center gap-2 text-red-600 text-[13px]">
                  <Icon name="AlertCircle" size={14} /> {formError}
                </div>
              )}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-border rounded-lg text-[13px] hover:bg-secondary transition-colors">
                  Отмена
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
                  {saving ? "Сохранение..." : "Добавить"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
