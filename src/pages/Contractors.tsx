import { useEffect, useState } from "react";
import { Role } from "@/App";
import Icon from "@/components/ui/icon";
import { api, Contractor } from "@/lib/api";

interface Props { role: Role; }

const TYPES = [
  { key: "",              label: "Все",            icon: "Building2",   color: "text-foreground" },
  { key: "client",        label: "Заказчики",       icon: "UserCheck",   color: "text-blue-600" },
  { key: "supplier",      label: "Поставщики",      icon: "Package",     color: "text-amber-600" },
  { key: "contractor",    label: "Подрядчики",      icon: "Hammer",      color: "text-violet-600" },
  { key: "subcontractor", label: "Субподрядчики",   icon: "Users",       color: "text-orange-600" },
  { key: "internal",      label: "Внутренние",      icon: "Shield",      color: "text-emerald-600" },
  { key: "general",       label: "Общие",           icon: "Globe",       color: "text-gray-600" },
];

const TYPE_BADGE: Record<string, string> = {
  client:        "bg-blue-50 text-blue-700 border-blue-200",
  supplier:      "bg-amber-50 text-amber-700 border-amber-200",
  contractor:    "bg-violet-50 text-violet-700 border-violet-200",
  subcontractor: "bg-orange-50 text-orange-700 border-orange-200",
  internal:      "bg-emerald-50 text-emerald-700 border-emerald-200",
  general:       "bg-gray-50 text-gray-600 border-gray-200",
};

// Что за документы создаются по типу
const TYPE_DOCS: Record<string, string[]> = {
  supplier:      ["Договоры поставки", "Счета", "УПД", "Накладные", "Сертификаты"],
  contractor:    ["Договоры подряда", "Акты КС-2", "Справки КС-3", "Счета"],
  subcontractor: ["Договоры", "Акты", "Сметы"],
  client:        ["Договоры строительства", "Акты приёмки этапов"],
  internal:      ["Регламенты", "Приказы", "Должностные инструкции"],
  general:       ["Лицензии", "Сертификаты компании", "Разрешения"],
};

const EMPTY_FORM = {
  contractor_type: "supplier",
  name: "", inn: "", kpp: "", legal_address: "", actual_address: "",
  phone: "", email: "", contact_person: "",
  bank_name: "", bank_account: "", bik: "", corr_account: "", notes: "",
};

interface FormState { [key: string]: string; }

export default function Contractors({ role }: Props) {
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading]         = useState(true);
  const [typeFilter, setTypeFilter]   = useState("");
  const [search, setSearch]           = useState("");
  const [selected, setSelected]       = useState<Contractor | null>(null);
  const [modalOpen, setModalOpen]     = useState(false);
  const [form, setForm]               = useState<FormState>({ ...EMPTY_FORM });
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState("");

  const canEdit = ["director", "commercial", "supply_director"].includes(role);

  const load = () => {
    setLoading(true);
    api.contractors.list(typeFilter || undefined).then(setContractors).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [typeFilter]);

  const filtered = contractors.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.inn || "").includes(search) ||
    (c.contact_person || "").toLowerCase().includes(search.toLowerCase())
  );

  const counts: Record<string, number> = {};
  contractors.forEach(c => { counts[c.contractor_type] = (counts[c.contractor_type] || 0) + 1; });

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, contractor_type: typeFilter || "supplier" });
    setSelected(null);
    setError("");
    setModalOpen(true);
  };

  const openEdit = (c: Contractor) => {
    setForm({
      contractor_type: c.contractor_type,
      name: c.name || "", inn: c.inn || "", kpp: c.kpp || "",
      legal_address: c.legal_address || "", actual_address: c.actual_address || "",
      phone: c.phone || "", email: c.email || "", contact_person: c.contact_person || "",
      bank_name: c.bank_name || "", bank_account: c.bank_account || "",
      bik: c.bik || "", corr_account: c.corr_account || "", notes: c.notes || "",
    });
    setSelected(c);
    setError("");
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) { setError("Введите название"); return; }
    setSaving(true);
    try {
      if (selected) {
        await api.contractors.update(selected.id, form);
      } else {
        await api.contractors.create(form);
      }
      setModalOpen(false);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally { setSaving(false); }
  };

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  return (
    <div className="space-y-5 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Контрагенты</h1>
          <p className="text-hint mt-0.5">Единый справочник · поставщики, подрядчики, заказчики, внутренние</p>
        </div>
        {canEdit && (
          <button onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors">
            <Icon name="Plus" size={14} />
            Добавить
          </button>
        )}
      </div>

      {/* Тип-фильтры */}
      <div className="flex gap-2 flex-wrap">
        {TYPES.map(t => {
          const cnt = t.key ? (counts[t.key] || 0) : contractors.length;
          return (
            <button key={t.key}
              onClick={() => setTypeFilter(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[13px] font-medium transition-all ${
                typeFilter === t.key
                  ? "border-primary bg-primary text-white"
                  : "border-border bg-white text-foreground hover:border-primary/40"
              }`}>
              <Icon name={t.icon as Parameters<typeof Icon>[0]["name"]} size={13} />
              {t.label}
              {cnt > 0 && (
                <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${typeFilter === t.key ? "bg-white/20" : "bg-secondary"}`}>
                  {cnt}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Поиск */}
      <div className="relative max-w-sm">
        <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Поиск по названию, ИНН, контакту..."
          className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-[13px] outline-none focus:ring-1 focus:ring-primary bg-white" />
      </div>

      {/* Таблица */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1,2,3,4].map(i => <div key={i} className="h-10 bg-secondary rounded-lg animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-hint py-16">
            <Icon name="Building2" size={36} className="mx-auto mb-3 opacity-30" />
            <div>Контрагентов не найдено</div>
            {canEdit && <button onClick={openCreate} className="mt-2 text-primary text-[13px] hover:underline">Добавить первого</button>}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-background">
                {["Тип", "Название", "ИНН", "Контактное лицо", "Телефон", "Документы", ""].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-hint text-[12px] font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-background/60 transition-colors">
                  <td className="px-4 py-3">
                    <span className={`text-[11px] px-2 py-1 rounded-lg border font-medium ${TYPE_BADGE[c.contractor_type] || "bg-gray-50 text-gray-600 border-gray-200"}`}>
                      {c.type_label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-[13px] font-semibold text-foreground">{c.name}</div>
                    {c.actual_address && <div className="text-[11px] text-hint truncate max-w-[200px]">{c.actual_address}</div>}
                  </td>
                  <td className="px-4 py-3 text-[13px] text-muted-foreground">{c.inn || "—"}</td>
                  <td className="px-4 py-3 text-[13px]">{c.contact_person || "—"}</td>
                  <td className="px-4 py-3 text-[13px]">
                    {c.phone ? (
                      <a href={`tel:${c.phone}`} className="text-primary hover:underline">{c.phone}</a>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(TYPE_DOCS[c.contractor_type] || []).slice(0, 2).map(d => (
                        <span key={d} className="text-[10px] bg-secondary text-muted-foreground px-1.5 py-0.5 rounded">{d}</span>
                      ))}
                      {(TYPE_DOCS[c.contractor_type] || []).length > 2 && (
                        <span className="text-[10px] text-hint">+{(TYPE_DOCS[c.contractor_type] || []).length - 2}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {canEdit && (
                      <button onClick={() => openEdit(c)} className="text-muted-foreground hover:text-primary transition-colors">
                        <Icon name="Edit2" size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* МОДАЛКА */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl border border-border shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto animate-fade-in">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="font-semibold text-[15px]">{selected ? "Редактировать контрагента" : "Новый контрагент"}</h2>
              <button onClick={() => setModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <Icon name="X" size={18} />
              </button>
            </div>
            <form onSubmit={handleSave} className="px-5 py-4 space-y-4">

              {/* Тип */}
              <div>
                <label className="block text-[13px] font-medium mb-2">Тип контрагента</label>
                <div className="grid grid-cols-3 gap-2">
                  {TYPES.filter(t => t.key).map(t => (
                    <button key={t.key} type="button"
                      onClick={() => setForm(p => ({ ...p, contractor_type: t.key }))}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all ${
                        form.contractor_type === t.key
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border hover:border-primary/30"
                      }`}>
                      <Icon name={t.icon as Parameters<typeof Icon>[0]["name"]} size={13} className={t.color} />
                      <span className="text-[12px] font-medium">{t.label}</span>
                    </button>
                  ))}
                </div>
                {form.contractor_type && (
                  <div className="mt-2 px-3 py-1.5 bg-secondary rounded-lg flex flex-wrap gap-1">
                    <span className="text-[11px] text-muted-foreground mr-1">Документы:</span>
                    {(TYPE_DOCS[form.contractor_type] || []).map(d => (
                      <span key={d} className="text-[11px] text-foreground">{d}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* Основные данные */}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-[12px] font-medium mb-1">Название <span className="text-red-500">*</span></label>
                  <input value={form.name} onChange={f("name")} placeholder="ООО «Название»"
                    className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium mb-1">ИНН</label>
                  <input value={form.inn} onChange={f("inn")} placeholder="1234567890"
                    className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium mb-1">КПП</label>
                  <input value={form.kpp} onChange={f("kpp")} placeholder="123456789"
                    className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium mb-1">Телефон</label>
                  <input value={form.phone} onChange={f("phone")} placeholder="+7 900 000-00-00"
                    className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium mb-1">Email</label>
                  <input type="email" value={form.email} onChange={f("email")} placeholder="info@company.ru"
                    className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[12px] font-medium mb-1">Контактное лицо</label>
                  <input value={form.contact_person} onChange={f("contact_person")} placeholder="Иванов Иван Иванович"
                    className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[12px] font-medium mb-1">Юридический адрес</label>
                  <input value={form.legal_address} onChange={f("legal_address")} placeholder="г. Москва, ул. ..."
                    className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
                </div>
              </div>

              {/* Банковские реквизиты */}
              <details className="group">
                <summary className="cursor-pointer text-[13px] font-medium text-muted-foreground hover:text-foreground flex items-center gap-1 select-none">
                  <Icon name="ChevronRight" size={14} className="group-open:rotate-90 transition-transform" />
                  Банковские реквизиты
                </summary>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-[12px] font-medium mb-1">Банк</label>
                    <input value={form.bank_name} onChange={f("bank_name")} placeholder="ПАО Сбербанк"
                      className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium mb-1">Р/счёт</label>
                    <input value={form.bank_account} onChange={f("bank_account")} placeholder="40702810..."
                      className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium mb-1">БИК</label>
                    <input value={form.bik} onChange={f("bik")} placeholder="044525225"
                      className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[12px] font-medium mb-1">К/счёт</label>
                    <input value={form.corr_account} onChange={f("corr_account")} placeholder="30101810..."
                      className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
                  </div>
                </div>
              </details>

              {/* Примечания */}
              <div>
                <label className="block text-[12px] font-medium mb-1">Примечания</label>
                <textarea value={form.notes} onChange={f("notes")} rows={2}
                  className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary resize-none" />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-600 text-[13px]">
                  <Icon name="AlertCircle" size={14} />{error}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-border rounded-lg text-[13px] hover:bg-secondary transition-colors">
                  Отмена
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
                  {saving ? "Сохранение..." : selected ? "Сохранить" : "Создать"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
