import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { api, DocTemplate } from "@/lib/api";

export default function AdminDocTemplates() {
  const [templates, setTemplates] = useState<DocTemplate[]>([]);
  const [loading, setLoading]     = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem]   = useState<DocTemplate | null>(null);
  const [saving, setSaving]       = useState(false);
  const [uploading, setUploading] = useState<number | null>(null);

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
