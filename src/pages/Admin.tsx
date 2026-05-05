import { useEffect, useState } from "react";
import { Role } from "@/App";
import Icon from "@/components/ui/icon";
import { api, SlotMonth, StageDuration, DocTemplate } from "@/lib/api";

interface Props { role: Role; }

const MONTH_NAMES = ["","Январь","Февраль","Март","Апрель","Май","Июнь",
  "Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];

const integrations = [
  { name: "МойСклад", desc: "Синхронизация остатков, цен, поступлений", status: "active", lastSync: "сегодня 08:03" },
  { name: "Telegram-бот (ОТК)", desc: "Приёмка этапов, фото дефектов, уведомления прорабу", status: "active", lastSync: "сегодня 07:51" },
  { name: "SMS-шлюз", desc: "Отправка ID-ключа клиентам при регистрации в ЛК", status: "active", lastSync: "вчера 14:22" },
  { name: "Почтовый сервер (SMTP)", desc: "Договоры, счета, уведомления клиентам", status: "active", lastSync: "сегодня 06:00" },
  { name: "1С (интеграция)", desc: "Импорт/экспорт платежей и проводок", status: "pending", lastSync: "Не настроено (Этап 2)" },
];

const automations = [
  { trigger: "Подписание договора", action: "Создать проект ДОМ-XXXX + занять слот + развернуть 11 этапов (по комплектации)", status: "active" },
  { trigger: "Индивидуальный проект", action: "Создать карточку проектирования, слот не занимать", status: "active" },
  { trigger: "Отклонение чек-листа в Telegram", action: "Создать задачу прорабу с фото дефекта", status: "active" },
  { trigger: "Заявка на материал (срочно)", action: "Отправить push-уведомление снабженцу", status: "active" },
  { trigger: "Завершение этапа строительства", action: "Уведомление клиенту в ЛК", status: "active" },
  { trigger: "Ежедневно в 08:00", action: "Пересчёт K_company (с учётом норматива комплектации)", status: "active" },
  { trigger: "За 30 дней до конца гарантии", action: "Email клиенту с предложением продления", status: "active" },
];

const norms = [
  { param: "Нормативный срок (Под ключ)", value: "62 дня" },
  { param: "Нормативный срок (Предчистовая)", value: "50 дней" },
  { param: "Нормативный срок (Тёплый контур)", value: "40 дней" },
  { param: "Целевой K_company", value: "0.90" },
  { param: "Целевая маржа строительства", value: "35%" },
  { param: "Минимальный аванс по договору", value: "30%" },
  { param: "Гарантийный срок (лет)", value: "5 лет" },
  { param: "Период рассылки «продление гарантии»", value: "30 дней до окончания" },
];

// Пакет документов для подписания договора — управляет директор
function DocTemplatesManager() {
  const [templates, setTemplates] = useState<DocTemplate[]>([]);
  const [loading, setLoading]     = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem]   = useState<DocTemplate | null>(null);
  const [saving, setSaving]       = useState(false);
  const [uploading, setUploading] = useState<number | null>(null); // template_id в процессе загрузки

  const [form, setForm] = useState({ name: "", description: "", is_required: true, sort_order: "99" });

  const load = () => {
    setLoading(true);
    api.doc_templates.list(true).then(setTemplates).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setForm({ name: "", description: "", is_required: true, sort_order: String(templates.length + 1) });
    setEditItem(null);
    setModalOpen(true);
  };
  const openEdit = (t: DocTemplate) => {
    setForm({ name: t.name, description: t.description || "", is_required: t.is_required, sort_order: String(t.sort_order) });
    setEditItem(t);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editItem) {
        await api.doc_templates.update(editItem.id, { ...form, is_required: form.is_required, sort_order: Number(form.sort_order) });
      } else {
        await api.doc_templates.create({ ...form, is_required: form.is_required, sort_order: Number(form.sort_order) });
      }
      setModalOpen(false);
      load();
    } finally { setSaving(false); }
  };

  const handleFileUpload = async (tplId: number, file: File) => {
    setUploading(tplId);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const b64 = (reader.result as string).split(",")[1];
        await api.doc_templates.update(tplId, { file_b64: b64, file_name: file.name });
        load();
      };
      reader.readAsDataURL(file);
    } finally {
      setTimeout(() => setUploading(null), 1500);
    }
  };

  const handleToggleActive = async (t: DocTemplate) => {
    await api.doc_templates.update(t.id, { is_active: !t.is_active });
    load();
  };

  return (
    <div className="bg-white rounded-xl border border-border">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="FolderOpen" size={16} className="text-primary" />
          <h2 className="font-semibold text-[15px]">Пакет документов при подписании договора</h2>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors">
          <Icon name="Plus" size={13} />Добавить
        </button>
      </div>

      <div className="px-5 py-3 bg-blue-50 border-b border-blue-100">
        <div className="text-[12px] text-blue-800 flex items-start gap-2">
          <Icon name="Info" size={13} className="shrink-0 mt-0.5" />
          Менеджер видит этот список при подписании договора. Загрузите актуальные шаблоны — менеджер скачает, подпишет с клиентом и загрузит скан.
          Обязательные документы блокируют переход к следующему шагу.
        </div>
      </div>

      {loading ? (
        <div className="p-5 space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 bg-secondary rounded-lg animate-pulse" />)}</div>
      ) : templates.length === 0 ? (
        <div className="text-center text-hint py-10">
          <Icon name="FileX" size={30} className="mx-auto mb-2 opacity-30" />
          <div className="text-[13px]">Нет шаблонов документов</div>
          <button onClick={openCreate} className="mt-2 text-primary text-[13px] hover:underline">Добавить первый</button>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {templates.map(t => (
            <div key={t.id} className={`px-5 py-3 flex items-center gap-4 ${!t.is_active ? "opacity-50" : ""}`}>
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-[11px] font-bold text-primary">{t.sort_order}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold">{t.name}</span>
                  {t.is_required && (
                    <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-md font-medium">обязательный</span>
                  )}
                </div>
                {t.description && <div className="text-hint text-[11px] mt-0.5">{t.description}</div>}
              </div>

              {/* Шаблон файл */}
              <div className="shrink-0">
                {t.file_url ? (
                  <div className="flex items-center gap-1.5">
                    <a href={t.file_url} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1 text-[11px] text-emerald-700 border border-emerald-200 bg-emerald-50 px-2 py-1 rounded-lg hover:bg-emerald-100 transition-colors">
                      <Icon name="FileCheck" size={11} />{t.file_name ? t.file_name.slice(0, 20) + (t.file_name.length > 20 ? "…" : "") : "Файл"}
                    </a>
                    <label className="cursor-pointer flex items-center gap-1 text-[11px] border border-border bg-white px-2 py-1 rounded-lg hover:bg-secondary transition-colors">
                      <Icon name="RefreshCw" size={11} />
                      {uploading === t.id ? "..." : "Заменить"}
                      <input type="file" className="hidden" accept=".pdf,.docx,.doc"
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(t.id, f); }} />
                    </label>
                  </div>
                ) : (
                  <label className="cursor-pointer flex items-center gap-1 text-[11px] bg-amber-50 border border-amber-200 text-amber-700 px-2.5 py-1 rounded-lg hover:bg-amber-100 transition-colors">
                    <Icon name="Upload" size={11} />
                    {uploading === t.id ? "Загрузка..." : "Загрузить шаблон"}
                    <input type="file" className="hidden" accept=".pdf,.docx,.doc"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(t.id, f); }} />
                  </label>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => openEdit(t)} className="text-muted-foreground hover:text-primary transition-colors">
                  <Icon name="Edit2" size={14} />
                </button>
                <button onClick={() => handleToggleActive(t)}
                  className={`text-[11px] px-2 py-1 rounded-lg border transition-colors ${
                    t.is_active ? "border-border text-muted-foreground hover:bg-secondary" : "border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                  }`}>
                  {t.is_active ? "Скрыть" : "Показать"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Модалка */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl border border-border shadow-xl w-full max-w-md animate-fade-in">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="font-semibold text-[14px]">{editItem ? "Редактировать" : "Новый"} документ пакета</h3>
              <button onClick={() => setModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <Icon name="X" size={16} />
              </button>
            </div>
            <form onSubmit={handleSave} className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-[12px] font-medium mb-1">Название <span className="text-red-500">*</span></label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Договор подряда"
                  className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-[12px] font-medium mb-1">Пояснение для менеджера</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2}
                  placeholder="Что это и как подписывается"
                  className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium mb-1">Порядок</label>
                  <input type="number" value={form.sort_order} onChange={e => setForm(p => ({ ...p, sort_order: e.target.value }))}
                    min={1} className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={form.is_required}
                      onChange={e => setForm(p => ({ ...p, is_required: e.target.checked }))}
                      className="w-4 h-4 accent-primary rounded" />
                    <span className="text-[13px] font-medium">Обязательный</span>
                  </label>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-border rounded-lg text-[13px] hover:bg-secondary transition-colors">Отмена</button>
                <button type="submit" disabled={saving}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium disabled:opacity-50">
                  {saving ? "..." : "Сохранить"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Нормативы этапов — редактирует только директор
function StageDurationsTable() {
  const [stages, setStages] = useState<StageDuration[]>([]);
  const [editing, setEditing] = useState<{ num: number; val: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.stage_durations.list().then(setStages); }, []);

  const total = stages.reduce((acc, s) => {
    if (s.parallel_group === null) return acc + s.duration;
    const maxInGroup = stages
      .filter(x => x.parallel_group === s.parallel_group)
      .reduce((m, x) => Math.max(m, x.duration), 0);
    return acc + (s.stage_num === Math.min(...stages.filter(x => x.parallel_group === s.parallel_group).map(x => x.stage_num)) ? maxInGroup : 0);
  }, 0);

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await api.stage_durations.update(editing.num, Number(editing.val));
      const updated = await api.stage_durations.list();
      setStages(updated);
      setEditing(null);
    } finally { setSaving(false); }
  };

  return (
    <div className="bg-white rounded-xl border border-border">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="Hammer" size={16} className="text-primary" />
          <h2 className="font-semibold text-[15px]">Нормативы этапов строительства</h2>
        </div>
        <div className="text-[13px] text-hint">
          Итого: <span className="font-bold text-foreground">{total} дней</span> (без буфера)
        </div>
      </div>
      <div className="divide-y divide-border">
        {stages.map(s => {
          const isEditing = editing?.num === s.stage_num;
          return (
            <div key={s.stage_num} className="px-5 py-3 flex items-center gap-4">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-[11px] font-bold text-primary">{s.stage_num}</span>
              </div>
              <div className="flex-1">
                <div className="text-[13px] font-medium">{s.name}</div>
                <div className="text-hint text-[11px]">
                  {s.parallel_group !== null ? `Параллельно (группа ${s.parallel_group})` : "Последовательный"}
                  {s.depends_on?.length > 0 ? ` · после этапов ${s.depends_on.join(", ")}` : ""}
                </div>
              </div>
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <input type="number" min={1} max={90} value={editing.val}
                    onChange={e => setEditing(prev => prev ? { ...prev, val: e.target.value } : null)}
                    className="w-16 border border-border rounded-lg px-2 py-1.5 text-[13px] outline-none focus:ring-1 focus:ring-primary text-center" />
                  <span className="text-hint text-[12px]">дн.</span>
                  <button onClick={handleSave} disabled={saving}
                    className="px-3 py-1.5 bg-primary text-white rounded-lg text-[12px] font-medium disabled:opacity-50">
                    {saving ? "..." : "OK"}
                  </button>
                  <button onClick={() => setEditing(null)} className="text-muted-foreground hover:text-foreground">
                    <Icon name="X" size={14} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-[14px] font-bold text-foreground w-12 text-right">{s.duration} дн.</span>
                  <button onClick={() => setEditing({ num: s.stage_num, val: String(s.duration) })}
                    className="text-muted-foreground hover:text-primary transition-colors">
                    <Icon name="Edit2" size={14} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="px-5 py-3 bg-blue-50 border-t border-blue-100">
        <div className="text-[12px] text-blue-700 flex items-center gap-2">
          <Icon name="Info" size={13} className="shrink-0" />
          Изменения применяются ко всем новым проектам. Существующие Гант-планы не затрагиваются.
        </div>
      </div>
    </div>
  );
}

// Слот-план — отдельный блок
function SlotPlan({ readonly }: { readonly?: boolean }) {
  const [plan, setPlan] = useState<SlotMonth[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ year: number; month: number; val: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api.slots.plan().then(setPlan).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSaveLimit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await api.slots.updateLimit(editing.year, editing.month, Number(editing.val));
      setEditing(null);
      load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-border">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Icon name="CalendarDays" size={16} className="text-primary" />
          <h2 className="font-semibold text-[15px]">Слот-план производства</h2>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-[12px] hover:bg-secondary transition-colors">
          <Icon name="RefreshCw" size={12} className={loading ? "animate-spin" : ""} />
          Обновить
        </button>
      </div>

      {loading ? (
        <div className="p-5 space-y-3">
          {[1,2,3,4].map(i => <div key={i} className="h-14 bg-secondary rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="p-5 space-y-3">
          {plan.map(m => {
            const pct = Math.min(m.load_pct, 100);
            const isEditing = editing?.year === m.year && editing?.month === m.month;
            return (
              <div key={`${m.year}-${m.month}`} className={`border rounded-xl p-4 ${m.overloaded ? "border-red-200 bg-red-50" : "border-border"}`}>
                <div className="flex items-center gap-4">
                  {/* Month label */}
                  <div className="w-28 shrink-0">
                    <div className="text-[14px] font-semibold text-foreground">{MONTH_NAMES[m.month]} {m.year}</div>
                    <div className="text-hint text-[11px]">{m.total_occupied} / {m.monthly_limit} занято</div>
                  </div>

                  {/* Progress */}
                  <div className="flex-1">
                    <div className="h-3 bg-secondary rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-red-500" : pct >= 75 ? "bg-amber-400" : "bg-emerald-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <div className="flex gap-3 text-[11px] text-hint">
                        <span className="text-emerald-600">●&nbsp;Свободно: {m.free_count}</span>
                        <span className="text-amber-600">●&nbsp;Бронь: {m.booked_count}</span>
                        <span className="text-blue-600">●&nbsp;В работе: {m.busy_count}</span>
                      </div>
                      <span className={`text-[11px] font-bold ${pct >= 100 ? "text-red-500" : pct >= 75 ? "text-amber-600" : "text-emerald-600"}`}>
                        {pct}%
                      </span>
                    </div>
                  </div>

                  {/* Limit editor */}
                  {!readonly && (
                    <div className="shrink-0 flex items-center gap-2">
                      {isEditing ? (
                        <>
                          <input
                            type="number" min={1} max={20}
                            value={editing.val}
                            onChange={e => setEditing(prev => prev ? { ...prev, val: e.target.value } : null)}
                            className="w-16 border border-border rounded-lg px-2 py-1.5 text-[13px] outline-none focus:ring-1 focus:ring-primary text-center"
                          />
                          <button onClick={handleSaveLimit} disabled={saving}
                            className="px-3 py-1.5 bg-primary text-white rounded-lg text-[12px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
                            {saving ? "..." : "OK"}
                          </button>
                          <button onClick={() => setEditing(null)}
                            className="text-muted-foreground hover:text-foreground">
                            <Icon name="X" size={14} />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setEditing({ year: m.year, month: m.month, val: String(m.monthly_limit) })}
                          className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-[12px] hover:bg-secondary transition-colors"
                        >
                          <Icon name="Edit2" size={12} />
                          Лимит: {m.monthly_limit}
                        </button>
                      )}
                    </div>
                  )}

                  {m.overloaded && (
                    <span className="badge-error text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0">Перегруз</span>
                  )}
                </div>
              </div>
            );
          })}

          {plan.length === 0 && (
            <div className="text-center text-hint py-8">Нет данных по слотам</div>
          )}
        </div>
      )}

      {!readonly && (
        <div className="px-5 pb-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
            <Icon name="Info" size={14} className="text-blue-500 shrink-0 mt-0.5" />
            <span className="text-[12px] text-blue-800">
              Изменение лимита применяется только к будущим сделкам. Уже забронированные слоты не затрагиваются.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Admin({ role }: Props) {
  const canView = role === "director" || role === "construction_director";

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <Icon name="Lock" size={40} className="text-muted-foreground mb-4" />
        <div className="text-[18px] font-semibold text-foreground">Доступ закрыт</div>
        <div className="text-hint mt-2">Этот раздел доступен только Генеральному директору и Директору по строительству</div>
      </div>
    );
  }

  const isDirector = role === "director";

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div>
        <h1 className="text-xl font-semibold">Администрирование</h1>
        <p className="text-hint mt-0.5">
          {isDirector ? "Интеграции, нормативы, автоматизация, слот-план" : "Слот-план производства (только просмотр)"}
        </p>
      </div>

      {/* Слот-план — доступен и директору и директору по строительству */}
      <SlotPlan readonly={!isDirector} />

      {/* Только директор */}
      {isDirector && (
        <>
          {/* Пакет документов при подписании */}
          <DocTemplatesManager />

          {/* Нормативы этапов */}
          <StageDurationsTable />

          {/* Integrations */}
          <div className="bg-white rounded-xl border border-border">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h2 className="font-semibold text-[15px]">Интеграции</h2>
              <button className="flex items-center gap-2 px-3 py-1.5 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors">
                <Icon name="Plus" size={13} />
                Добавить
              </button>
            </div>
            <div className="divide-y divide-border">
              {integrations.map(int => (
                <div key={int.name} className="px-5 py-4 flex items-center gap-4">
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${int.status === "active" ? "bg-emerald-500" : "bg-amber-400"}`} />
                  <div className="flex-1">
                    <div className="text-[13px] font-semibold">{int.name}</div>
                    <div className="text-hint">{int.desc}</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${int.status === "active" ? "badge-success" : "badge-warning"}`}>
                      {int.status === "active" ? "Активна" : "Не настроено"}
                    </div>
                    <div className="text-hint mt-1">Синхронизация: {int.lastSync}</div>
                  </div>
                  <button className="text-muted-foreground hover:text-primary transition-colors ml-2">
                    <Icon name="Settings" size={15} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Automations */}
          <div className="bg-white rounded-xl border border-border">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="font-semibold text-[15px]">Автоматизации</h2>
            </div>
            <div className="divide-y divide-border">
              {automations.map((a, i) => (
                <div key={i} className="px-5 py-3.5 flex items-center gap-4">
                  <Icon name="Zap" size={14} className="text-amber-500 shrink-0" />
                  <div className="flex-1">
                    <span className="text-[13px] font-medium text-foreground">{a.trigger}</span>
                    <span className="text-hint mx-2">→</span>
                    <span className="text-[13px] text-muted-foreground">{a.action}</span>
                  </div>
                  <div className={`w-8 h-4 rounded-full ${a.status === "active" ? "bg-emerald-500" : "bg-gray-300"} flex items-center ${a.status === "active" ? "justify-end pr-0.5" : "justify-start pl-0.5"}`}>
                    <div className="w-3 h-3 rounded-full bg-white" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Norms */}
          <div className="bg-white rounded-xl border border-border">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="font-semibold text-[15px]">Нормативы и параметры системы</h2>
            </div>
            <div className="divide-y divide-border">
              {norms.map((n, i) => (
                <div key={i} className="px-5 py-3.5 flex items-center gap-4">
                  <div className="flex-1 text-[13px] text-muted-foreground">{n.param}</div>
                  <div className="text-[13px] font-semibold text-foreground">{n.value}</div>
                  <button className="text-muted-foreground hover:text-primary transition-colors">
                    <Icon name="Edit2" size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}