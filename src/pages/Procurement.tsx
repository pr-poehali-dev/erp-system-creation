import { useEffect, useState } from "react";
import { Role } from "@/App";
import Icon from "@/components/ui/icon";
import { api, MaterialRequest, Project } from "@/lib/api";
import SuppliersTab from "@/components/procurement/SuppliersTab";
import MaterialsTab from "@/components/procurement/MaterialsTab";
import InvoicesTab from "@/components/procurement/InvoicesTab";
import PurchaseRequestsTab from "@/components/procurement/PurchaseRequestsTab";
import PurchasePlanTab from "@/components/procurement/PurchasePlanTab";
import TemplatesTab from "@/components/procurement/TemplatesTab";
import CategoriesTab from "@/components/procurement/CategoriesTab";

interface Props { role: Role; }

type ProcTab = "requests" | "suppliers" | "materials" | "invoices" | "purchase_requests" | "plan" | "templates" | "categories";

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  new:         { label: "Новая",     cls: "bg-amber-100 text-amber-700 border-amber-200" },
  in_progress: { label: "В работе",  cls: "bg-blue-100 text-blue-700 border-blue-200" },
  purchased:   { label: "Закуплено", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  ordered:     { label: "Заказан",   cls: "bg-blue-100 text-blue-700 border-blue-200" },
  delivered:   { label: "Доставлен", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
};

const STATUS_TRANSITIONS: Record<string, { value: string; label: string }[]> = {
  new:         [{ value: "in_progress", label: "В работе" }, { value: "purchased", label: "Закуплено" }],
  in_progress: [{ value: "purchased", label: "Закуплено" }],
  ordered:     [{ value: "in_progress", label: "В работе" }, { value: "purchased", label: "Закуплено" }],
  purchased:   [],
  delivered:   [],
};

const UNITS = ["шт", "м²", "м³", "т", "л", "кг"];

const EMPTY_FORM = { project_id: "", material: "", quantity: "", unit: "шт", required_date: "", priority: "normal", notes: "" };

const canChangeStatus = (role: Role) => ["director", "supply_director", "supplier"].includes(role);

// Статус доставки по дате: просрочено / сегодня / в срок (закрытые заявки не считаем)
const deliveryState = (req: MaterialRequest): "overdue" | "today" | "ok" | "done" => {
  if (["purchased", "delivered"].includes(req.status)) return "done";
  if (!req.required_date) return "ok";
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(req.required_date); due.setHours(0, 0, 0, 0);
  if (due < today) return "overdue";
  if (due.getTime() === today.getTime()) return "today";
  return "ok";
};

const TABS: { key: ProcTab; label: string; icon: string; roles?: Role[] }[] = [
  { key: "requests",          label: "Заявки на материалы", icon: "ClipboardList" },
  { key: "suppliers",         label: "Поставщики",          icon: "Building2" },
  { key: "materials",         label: "Материалы",           icon: "Package" },
  { key: "invoices",          label: "Счета",               icon: "FileText" },
  { key: "purchase_requests", label: "Заявки на закупку",   icon: "ShoppingCart" },
  { key: "plan",              label: "Плановые закупки",    icon: "CalendarRange" },
  { key: "categories",        label: "Категории",           icon: "FolderTree",
    roles: ["director", "supply_director"] },
  { key: "templates",         label: "Шаблоны",             icon: "BookOpen",
    roles: ["director", "supply_director", "supplier"] },
];

export default function Procurement({ role }: Props) {
  const [activeTab, setActiveTab] = useState<ProcTab>("requests");
  const [requests, setRequests]   = useState<MaterialRequest[]>([]);
  const [projects, setProjects]   = useState<Project[]>([]);
  const [loading, setLoading]     = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm]           = useState({ ...EMPTY_FORM });
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState("");
  const [statusSaving, setStatusSaving] = useState<number | null>(null);
  const [filterProject, setFilterProject] = useState("");
  const [filterStatus,  setFilterStatus]  = useState("");
  const [onlyOverdue,   setOnlyOverdue]    = useState(false);

  const loadRequests = () => {
    setLoading(true);
    api.procurement.list().then(setRequests).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadRequests();
    api.projects.list().then(setProjects);
  }, []);

  const pendingCount    = requests.filter(r => r.status === "new").length;
  const inProgressCount = requests.filter(r => r.status === "in_progress" || r.status === "ordered").length;
  const purchasedCount  = requests.filter(r => r.status === "purchased" || r.status === "delivered").length;
  const overdueCount    = requests.filter(r => deliveryState(r) === "overdue").length;

  // Уникальные проекты для фильтра (по коду)
  const projectCodes = Array.from(new Set(requests.map(r => r.project_code).filter(Boolean)));

  // Применяем фильтры к списку заявок на материалы
  const filteredRequests = requests.filter(r => {
    if (filterProject && r.project_code !== filterProject) return false;
    if (filterStatus && r.status !== filterStatus) return false;
    if (onlyOverdue && deliveryState(r) !== "overdue") return false;
    return true;
  });

  const handleOpenModal = () => { setForm({ ...EMPTY_FORM }); setFormError(""); setModalOpen(true); };
  const handleCloseModal = () => { setModalOpen(false); setFormError(""); };
  const handleField = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.material.trim()) { setFormError("Укажите материал"); return; }
    if (!form.quantity || Number(form.quantity) <= 0) { setFormError("Укажите количество"); return; }
    if (!form.required_date) { setFormError("Укажите дату поставки"); return; }
    setSaving(true); setFormError("");
    try {
      await api.procurement.create({
        project_id: form.project_id ? Number(form.project_id) : null,
        material: form.material.trim(), quantity: Number(form.quantity),
        unit: form.unit, required_date: form.required_date,
        priority: form.priority, notes: form.notes.trim(),
      });
      handleCloseModal(); loadRequests();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally { setSaving(false); }
  };

  const handleStatusChange = async (req: MaterialRequest, nextStatus: string) => {
    setStatusSaving(req.id);
    try { await api.procurement.updateStatus(req.id, nextStatus); loadRequests(); }
    finally { setStatusSaving(null); }
  };

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Снабжение и Закупки</h1>
          <p className="text-hint mt-0.5">Поставщики · Материалы · Счета · Заявки · Планирование</p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === "requests" && (
            <>
              <button onClick={loadRequests}
                className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-[13px] hover:bg-secondary transition-colors">
                <Icon name="RefreshCw" size={13} className={loading ? "animate-spin" : ""} />
                Обновить
              </button>
              {role !== "supplier" && (
                <button onClick={handleOpenModal}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors">
                  <Icon name="Plus" size={14} />
                  Новая заявка
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Статистика (только на вкладке Заявки) */}
      {activeTab === "requests" && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Новых заявок",  value: loading ? "—" : String(pendingCount),    icon: "Clock",        color: "text-amber-600 bg-amber-50" },
            { label: "В работе",      value: loading ? "—" : String(inProgressCount), icon: "Truck",        color: "text-blue-600 bg-blue-50" },
            { label: "Закуплено",     value: loading ? "—" : String(purchasedCount),  icon: "PackageCheck", color: "text-emerald-600 bg-emerald-50" },
            { label: "Просрочено",    value: loading ? "—" : String(overdueCount),    icon: "AlertTriangle", color: "text-red-600 bg-red-50" },
          ].map(c => (
            <div key={c.label} className="bg-white rounded-xl border border-border p-4 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${c.color}`}>
                <Icon name={c.icon} size={20} />
              </div>
              <div>
                <div className={`text-[20px] font-bold ${loading ? "animate-pulse text-muted-foreground" : "text-foreground"}`}>{c.value}</div>
                <div className="text-hint">{c.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Вкладки */}
      <div className="flex items-center border-b border-border gap-0 overflow-x-auto">
        {TABS.filter(t => !t.roles || t.roles.includes(role)).map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium border-b-2 whitespace-nowrap transition-colors ${
              activeTab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            <Icon name={t.icon} size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Содержимое вкладок */}
      {activeTab === "requests" && (
        <div className="bg-white rounded-xl border border-border">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-wrap gap-3">
            <h2 className="font-semibold text-[15px]">Заявки на материалы</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
                className="border border-border rounded-lg px-3 py-1.5 text-[13px] bg-white outline-none focus:ring-1 focus:ring-primary">
                <option value="">Все проекты</option>
                {projectCodes.map(code => <option key={code} value={code}>{code}</option>)}
              </select>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                className="border border-border rounded-lg px-3 py-1.5 text-[13px] bg-white outline-none focus:ring-1 focus:ring-primary">
                <option value="">Все статусы</option>
                {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <button onClick={() => setOnlyOverdue(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium border transition-colors ${
                  onlyOverdue ? "bg-red-50 border-red-300 text-red-700" : "border-border text-muted-foreground hover:bg-secondary"
                }`}>
                <Icon name="AlertTriangle" size={13} />
                Только просрочка
              </button>
              {(filterProject || filterStatus || onlyOverdue) && (
                <button onClick={() => { setFilterProject(""); setFilterStatus(""); setOnlyOverdue(false); }}
                  className="text-[12px] text-hint hover:text-foreground underline">
                  Сбросить
                </button>
              )}
            </div>
          </div>
          {loading ? (
            <div className="divide-y divide-border">
              {[1,2,3,4].map(i => (
                <div key={i} className="px-4 py-3.5 flex items-center gap-4 animate-pulse">
                  <div className="h-4 bg-secondary rounded w-24" /><div className="h-4 bg-secondary rounded w-20" />
                  <div className="h-4 bg-secondary rounded flex-1" /><div className="h-5 bg-secondary rounded-full w-16" />
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    {["№","Проект","Материал","Кол-во","Дата поставки","Прораб","Статус","Действие"].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-hint font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredRequests.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-hint">
                      {requests.length === 0 ? "Заявок пока нет" : "Нет заявок по выбранным фильтрам"}
                    </td></tr>
                  ) : filteredRequests.map(r => {
                    const st = STATUS_MAP[r.status] || STATUS_MAP["new"];
                    const transitions = STATUS_TRANSITIONS[r.status] || [];
                    const isSaving = statusSaving === r.id;
                    const dstate = deliveryState(r);
                    return (
                      <tr key={r.id} className={`hover:bg-background transition-colors ${dstate === "overdue" ? "bg-red-50/40" : ""}`}>
                        <td className="px-4 py-3 text-[13px] text-primary font-medium whitespace-nowrap">{r.code}</td>
                        <td className="px-4 py-3 text-[13px] font-medium whitespace-nowrap">{r.project_code || "—"}</td>
                        <td className="px-4 py-3 text-[13px] max-w-[200px]">
                          <div className="truncate" title={r.material}>{r.material}</div>
                          {r.notes && <div className="text-hint truncate text-[11px]">{r.notes}</div>}
                        </td>
                        <td className="px-4 py-3 text-[13px] whitespace-nowrap">{r.quantity} {r.unit}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[13px] ${dstate === "overdue" ? "text-red-600 font-semibold" : dstate === "today" ? "text-amber-600 font-medium" : "text-hint"}`}>
                              {r.required_date ? new Date(r.required_date).toLocaleDateString("ru-RU") : "—"}
                            </span>
                            {dstate === "overdue" && (
                              <span className="flex items-center gap-0.5 text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-md font-bold">
                                <Icon name="AlertTriangle" size={9} />
                                Просрочено
                              </span>
                            )}
                            {dstate === "today" && (
                              <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-md font-bold">
                                Сегодня
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[13px] whitespace-nowrap">{r.foreman_name || "—"}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${st.cls}`}>{st.label}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {canChangeStatus(role) && transitions.length > 0 && (
                            <div className="flex items-center gap-1.5">
                              {transitions.map(t => (
                                <button key={t.value} onClick={() => handleStatusChange(r, t.value)} disabled={isSaving}
                                  className="text-[12px] px-3 py-1.5 border border-border rounded-lg hover:bg-secondary transition-colors disabled:opacity-50 whitespace-nowrap flex items-center gap-1">
                                  {isSaving && <Icon name="Loader" size={11} className="animate-spin" />}
                                  {t.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === "suppliers"         && <SuppliersTab />}
      {activeTab === "materials"         && <MaterialsTab />}
      {activeTab === "invoices"          && <InvoicesTab role={role} />}
      {activeTab === "purchase_requests" && <PurchaseRequestsTab />}
      {activeTab === "plan"              && <PurchasePlanTab />}
      {activeTab === "categories"        && <CategoriesTab role={role} />}
      {activeTab === "templates"         && <TemplatesTab />}

      {/* Модалка создания заявки на материал */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl border border-border shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="font-semibold text-[15px]">Новая заявка на материал</h2>
              <button onClick={handleCloseModal} className="text-muted-foreground hover:text-foreground"><Icon name="X" size={18} /></button>
            </div>
            <form onSubmit={handleCreate} className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-[13px] font-medium mb-1">Проект</label>
                <select name="project_id" value={form.project_id} onChange={handleField}
                  className="w-full border border-border rounded-lg px-3 py-2 text-[13px] bg-white outline-none focus:ring-1 focus:ring-primary">
                  <option value="">— Без проекта —</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.code} · {p.client_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[13px] font-medium mb-1">Материал <span className="text-red-500">*</span></label>
                <input type="text" name="material" value={form.material} onChange={handleField} placeholder="Блок газобетонный D400"
                  className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[13px] font-medium mb-1">Количество <span className="text-red-500">*</span></label>
                  <input type="number" name="quantity" value={form.quantity} onChange={handleField} placeholder="10" min={0} step="any"
                    className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-[13px] font-medium mb-1">Единица</label>
                  <select name="unit" value={form.unit} onChange={handleField}
                    className="w-full border border-border rounded-lg px-3 py-2 text-[13px] bg-white outline-none focus:ring-1 focus:ring-primary">
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[13px] font-medium mb-1">Дата поставки <span className="text-red-500">*</span></label>
                <input type="date" name="required_date" value={form.required_date} onChange={handleField}
                  className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-[13px] font-medium mb-1">Приоритет</label>
                <select name="priority" value={form.priority} onChange={handleField}
                  className="w-full border border-border rounded-lg px-3 py-2 text-[13px] bg-white outline-none focus:ring-1 focus:ring-primary">
                  <option value="normal">Обычно</option>
                  <option value="urgent">Срочно</option>
                </select>
              </div>
              <div>
                <label className="block text-[13px] font-medium mb-1">Примечание</label>
                <textarea name="notes" value={form.notes} onChange={handleField} rows={2}
                  className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary resize-none" />
              </div>
              {formError && <div className="text-red-500 text-[13px]">{formError}</div>}
              <div className="flex gap-2">
                <button type="submit" disabled={saving}
                  className="flex-1 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1.5">
                  {saving && <Icon name="Loader" size={13} className="animate-spin" />}
                  Создать заявку
                </button>
                <button type="button" onClick={handleCloseModal}
                  className="px-4 py-2 border border-border rounded-lg text-[13px] text-muted-foreground hover:bg-secondary transition-colors">
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}