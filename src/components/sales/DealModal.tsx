import Icon from "@/components/ui/icon";
import { Client, Staff } from "@/lib/api";

const SOURCES = ["Авито", "Сайт", "Рекомендация", "Инстаграм", "ВКонтакте", "Другое"];

export interface DealFormState {
  client_id: string;
  source: string;
  budget: string;
  start_date: string;
  manager_id: string;
  realtor_id: string;
  notes: string;
}

interface Props {
  form: DealFormState;
  clients: Client[];
  managers: Staff[];
  realtors: Staff[];
  saving: boolean;
  formError: string;
  onClose: () => void;
  onField: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function DealModal({
  form,
  clients,
  managers,
  realtors,
  saving,
  formError,
  onClose,
  onField,
  onSubmit,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl border border-border shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-[15px]">Новая сделка</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <Icon name="X" size={18} />
          </button>
        </div>
        <form onSubmit={onSubmit} className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-foreground mb-1">
              Клиент <span className="text-red-500">*</span>
            </label>
            <select
              name="client_id"
              value={form.client_id}
              onChange={onField}
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
              onChange={onField}
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
              onChange={onField}
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
              onChange={onField}
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
              onChange={onField}
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
              onChange={onField}
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
              onChange={onField}
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
              onClick={onClose}
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
  );
}
