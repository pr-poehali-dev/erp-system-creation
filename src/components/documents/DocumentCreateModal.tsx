import Icon from "@/components/ui/icon";
import { Contractor } from "@/lib/api";
import { CATEGORIES, DOC_TYPES_BY_CATEGORY, STATUS_MAP } from "./DocumentsConst";

interface FormState {
  doc_type: string;
  category: string;
  title: string;
  status: string;
  amount: string;
  doc_date: string;
  contractor_id: string;
  deal_id: string;
  notes: string;
}

interface Props {
  form: FormState;
  contractors: Contractor[];
  saving: boolean;
  error: string;
  activeCategory: string;
  onFormChange: (patch: Partial<FormState>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

export default function DocumentCreateModal({
  form, contractors, saving, error, activeCategory,
  onFormChange, onSubmit, onClose,
}: Props) {
  const availableDocTypes = activeCategory
    ? (DOC_TYPES_BY_CATEGORY[activeCategory] || [])
    : Object.values(DOC_TYPES_BY_CATEGORY).flat();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl border border-border shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-[15px]">Новый документ</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <Icon name="X" size={18} />
          </button>
        </div>
        <form onSubmit={onSubmit} className="px-5 py-4 space-y-4">

          {/* Категория → тип */}
          <div>
            <label className="block text-[13px] font-medium mb-2">Категория</label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.filter(c => c.key).map(cat => (
                <button key={cat.key} type="button"
                  onClick={() => onFormChange({ category: cat.key, doc_type: "" })}
                  className={`flex items-center gap-1.5 p-2 rounded-lg border text-[12px] transition-all ${
                    form.category === cat.key
                      ? "border-primary bg-primary/5 ring-1 ring-primary font-semibold"
                      : "border-border hover:border-primary/30"
                  }`}>
                  <Icon name={cat.icon as Parameters<typeof Icon>[0]["name"]} size={12} />
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-medium mb-1">Тип документа <span className="text-red-500">*</span></label>
            <select value={form.doc_type} onChange={e => onFormChange({ doc_type: e.target.value })}
              className="w-full border border-border rounded-lg px-3 py-2 text-[13px] bg-white outline-none focus:ring-1 focus:ring-primary">
              <option value="">— Выберите тип —</option>
              {availableDocTypes.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[13px] font-medium mb-1">Название <span className="text-red-500">*</span></label>
            <input value={form.title} onChange={e => onFormChange({ title: e.target.value })}
              placeholder="Договор поставки № 123 — ООО Поставщик"
              className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[13px] font-medium mb-1">Дата документа</label>
              <input type="date" value={form.doc_date} onChange={e => onFormChange({ doc_date: e.target.value })}
                className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-[13px] font-medium mb-1">Сумма (₽)</label>
              <input type="number" value={form.amount} onChange={e => onFormChange({ amount: e.target.value })}
                placeholder="0" min={0}
                className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-medium mb-1">Контрагент</label>
            <select value={form.contractor_id} onChange={e => onFormChange({ contractor_id: e.target.value })}
              className="w-full border border-border rounded-lg px-3 py-2 text-[13px] bg-white outline-none focus:ring-1 focus:ring-primary">
              <option value="">— Без контрагента —</option>
              {contractors.map(c => (
                <option key={c.id} value={c.id}>{c.type_label} · {c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[13px] font-medium mb-1">Статус</label>
            <select value={form.status} onChange={e => onFormChange({ status: e.target.value })}
              className="w-full border border-border rounded-lg px-3 py-2 text-[13px] bg-white outline-none focus:ring-1 focus:ring-primary">
              {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[13px] font-medium mb-1">Примечания</label>
            <textarea value={form.notes} onChange={e => onFormChange({ notes: e.target.value })} rows={2}
              className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary resize-none" />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-[13px]">
              <Icon name="AlertCircle" size={14} />{error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 border border-border rounded-lg text-[13px] hover:bg-secondary transition-colors">
              Отмена
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
              {saving ? "Сохранение..." : "Создать"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
