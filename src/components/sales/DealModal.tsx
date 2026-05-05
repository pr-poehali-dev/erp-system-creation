import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { Client, Staff, SlotItem, SerialProject, Configuration, api } from "@/lib/api";

const SOURCES = ["Авито", "Сайт", "Рекомендация", "Инстаграм", "ВКонтакте", "Другое"];
const MONTH_NAMES = ["","Январь","Февраль","Март","Апрель","Май","Июнь",
  "Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];

function formatSlotDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

const fmt = (n: number) => `₽ ${n.toLocaleString("ru")}`;

export interface DealFormState {
  client_id: string;
  source: string;
  budget: string;
  slot_id: string;
  manager_id: string;
  realtor_id: string;
  notes: string;
  project_type: string;
  serial_project_id: string;
  configuration_id: string;
  planned_start_date: string;
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
  onSlotSelect: (slotId: string) => void;
  onFormPatch: (patch: Partial<DealFormState>) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function DealModal({
  form, clients, managers, realtors,
  saving, formError,
  onClose, onField, onSlotSelect, onFormPatch, onSubmit,
}: Props) {
  const [slots, setSlots] = useState<SlotItem[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [serialProjects, setSerialProjects] = useState<SerialProject[]>([]);
  const [configs, setConfigs] = useState<Configuration[]>([]);

  useEffect(() => {
    setSlotsLoading(true);
    api.slots.free().then(setSlots).finally(() => setSlotsLoading(false));
    api.serial_projects.list().then(setSerialProjects);
  }, []);

  // При смене серийного проекта — загрузить комплектации
  useEffect(() => {
    if (form.serial_project_id) {
      const sp = serialProjects.find(p => String(p.id) === form.serial_project_id);
      if (sp?.configurations) {
        setConfigs(sp.configurations);
      } else {
        api.configurations.list(Number(form.serial_project_id)).then(setConfigs);
      }
      // Сброс комплектации и бюджета
      onFormPatch({ configuration_id: "", budget: "" });
    } else {
      setConfigs([]);
    }
  }, [form.serial_project_id]);

  // При выборе комплектации — подставить бюджет автоматически
  useEffect(() => {
    if (form.configuration_id && form.serial_project_id) {
      const sp = serialProjects.find(p => String(p.id) === form.serial_project_id);
      const cfg = configs.find(c => String(c.id) === form.configuration_id);
      if (sp && cfg) {
        const calculated = Math.round(sp.base_price * cfg.price_coefficient);
        onFormPatch({ budget: String(calculated) });
      }
    }
  }, [form.configuration_id]);

  const selectedSlot = slots.find(s => String(s.id) === form.slot_id);
  const selectedCfg = configs.find(c => String(c.id) === form.configuration_id);

  const slotsByMonth: Record<string, SlotItem[]> = {};
  slots.forEach(s => {
    const key = `${s.year}-${s.month}`;
    if (!slotsByMonth[key]) slotsByMonth[key] = [];
    slotsByMonth[key].push(s);
  });

  const isSerial = form.project_type === "serial" || !form.project_type;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl border border-border shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-[15px]">Новая сделка</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <Icon name="X" size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="px-5 py-4 space-y-4">

          {/* Тип проекта */}
          <div>
            <label className="block text-[13px] font-medium mb-2">Тип проекта <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { val: "serial", label: "Серийный проект", icon: "Home", hint: "Стандартная серия, быстрый старт" },
                { val: "individual", label: "Индивидуальный", icon: "Pencil", hint: "Под заказ, нужно проектирование" },
              ].map(opt => (
                <button
                  key={opt.val} type="button"
                  onClick={() => onFormPatch({ project_type: opt.val, serial_project_id: "", configuration_id: "", slot_id: "", budget: "" })}
                  className={`text-left p-3 rounded-lg border transition-all ${
                    form.project_type === opt.val || (!form.project_type && opt.val === "serial")
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon name={opt.icon} size={14} className="text-primary" />
                    <span className="text-[13px] font-semibold">{opt.label}</span>
                  </div>
                  <div className="text-hint text-[11px]">{opt.hint}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Серийный проект + комплектация */}
          {isSerial && (
            <>
              <div>
                <label className="block text-[13px] font-medium mb-1">
                  Серийный проект <span className="text-red-500">*</span>
                </label>
                <select name="serial_project_id" value={form.serial_project_id} onChange={onField}
                  className="w-full border border-border rounded-lg px-3 py-2 text-[13px] bg-white outline-none focus:ring-1 focus:ring-primary">
                  <option value="">— Выберите проект —</option>
                  {serialProjects.map(sp => (
                    <option key={sp.id} value={sp.id}>
                      {sp.name} · {sp.area_sqm} м² · {fmt(sp.base_price)}
                    </option>
                  ))}
                </select>
              </div>

              {configs.length > 0 && (
                <div>
                  <label className="block text-[13px] font-medium mb-2">
                    Комплектация <span className="text-red-500">*</span>
                  </label>
                  <div className="space-y-2">
                    {configs.map(cfg => {
                      const sp = serialProjects.find(p => String(p.id) === form.serial_project_id);
                      const price = sp ? Math.round(sp.base_price * cfg.price_coefficient) : 0;
                      const isSelected = form.configuration_id === String(cfg.id);
                      return (
                        <button
                          key={cfg.id} type="button"
                          onClick={() => onFormPatch({ configuration_id: String(cfg.id) })}
                          className={`w-full text-left p-3 rounded-lg border transition-all ${
                            isSelected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/40"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[13px] font-semibold">{cfg.name}</span>
                            <div className="text-right">
                              <div className="text-[13px] font-bold text-primary">{fmt(price)}</div>
                              <div className="text-hint text-[11px]">{cfg.duration_days} дней</div>
                            </div>
                          </div>
                          {cfg.description && (
                            <div className="text-hint text-[11px] mt-1">{cfg.description}</div>
                          )}
                          <div className="text-hint text-[11px] mt-1">
                            {cfg.included_stages.length} этапов строительства
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Индивидуальный: площадь и пожелания */}
          {!isSerial && (
            <>
              <div>
                <label className="block text-[13px] font-medium mb-1">Желаемая площадь (м²)</label>
                <input type="number" name="desired_area"
                  placeholder="150"
                  className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-[13px] font-medium mb-1">Пожелания клиента</label>
                <textarea name="special_requests" rows={2}
                  placeholder="Особые требования к проекту..."
                  className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary resize-none" />
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                <Icon name="Info" size={14} className="text-amber-600 shrink-0 mt-0.5" />
                <span className="text-[12px] text-amber-800">
                  Для индивидуального проекта слот не бронируется — он будет назначен после завершения проектирования.
                </span>
              </div>
            </>
          )}

          {/* Клиент */}
          <div>
            <label className="block text-[13px] font-medium mb-1">
              Клиент <span className="text-red-500">*</span>
            </label>
            <select name="client_id" value={form.client_id} onChange={onField}
              className="w-full border border-border rounded-lg px-3 py-2 text-[13px] bg-white outline-none focus:ring-1 focus:ring-primary">
              <option value="">— Выберите клиента —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
            </select>
          </div>

          {/* Источник */}
          <div>
            <label className="block text-[13px] font-medium mb-1">Источник</label>
            <select name="source" value={form.source} onChange={onField}
              className="w-full border border-border rounded-lg px-3 py-2 text-[13px] bg-white outline-none focus:ring-1 focus:ring-primary">
              <option value="">— Источник —</option>
              {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Бюджет */}
          <div>
            <label className="block text-[13px] font-medium mb-1">
              Сумма сделки (₽) <span className="text-red-500">*</span>
            </label>
            <input type="number" name="budget" value={form.budget} onChange={onField}
              placeholder="6500000" min={0}
              className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
            {selectedCfg && form.budget && (
              <div className="text-hint text-[11px] mt-1">
                Автоподстановка по комплектации «{selectedCfg.name}» · можно изменить вручную
              </div>
            )}
          </div>

          {/* Выбор слота — только для серийного */}
          {isSerial && (
            <div>
              <label className="block text-[13px] font-medium mb-2">
                Дата начала строительства (слот) <span className="text-red-500">*</span>
              </label>

              {slotsLoading ? (
                <div className="border border-border rounded-xl p-4 animate-pulse">
                  <div className="h-4 bg-secondary rounded w-1/2 mb-3" />
                  <div className="grid grid-cols-2 gap-2">
                    {[1,2,3,4].map(i => <div key={i} className="h-10 bg-secondary rounded-lg" />)}
                  </div>
                </div>
              ) : slots.length === 0 ? (
                <div className="border border-red-200 bg-red-50 rounded-xl p-4 flex items-center gap-2">
                  <Icon name="AlertTriangle" size={15} className="text-red-500 shrink-0" />
                  <span className="text-[13px] text-red-700">Нет свободных слотов. Обратитесь к директору.</span>
                </div>
              ) : (
                <div className="border border-border rounded-xl overflow-hidden">
                  {Object.entries(slotsByMonth).map(([key, monthSlots]) => {
                    const [year, month] = key.split("-").map(Number);
                    const occupied = monthSlots[0]?.occupied_count ?? 0;
                    const limit = monthSlots[0]?.monthly_limit ?? 4;
                    const loadPct = Math.round((occupied / limit) * 100);
                    return (
                      <div key={key} className="border-b border-border last:border-0">
                        <div className="flex items-center justify-between px-4 py-2.5 bg-background">
                          <span className="text-[13px] font-semibold">{MONTH_NAMES[month]} {year}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 bg-border rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${loadPct >= 100 ? "bg-red-500" : loadPct >= 75 ? "bg-amber-400" : "bg-emerald-500"}`}
                                style={{ width: `${Math.min(loadPct, 100)}%` }} />
                            </div>
                            <span className={`text-[11px] font-medium ${loadPct >= 100 ? "text-red-500" : "text-muted-foreground"}`}>
                              {occupied}/{limit}
                            </span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 p-3">
                          {monthSlots.map(slot => {
                            const isSelected = form.slot_id === String(slot.id);
                            const dur = selectedCfg?.duration_days ?? 62;
                            return (
                              <button key={slot.id} type="button"
                                onClick={() => onSlotSelect(String(slot.id))}
                                className={`text-left px-3 py-2.5 rounded-lg border text-[13px] transition-all ${
                                  isSelected
                                    ? "border-primary bg-primary/5 text-primary font-semibold ring-1 ring-primary"
                                    : "border-border bg-white hover:border-primary/50 text-foreground"
                                }`}>
                                <div className="font-medium">{formatSlotDate(slot.start_date)}</div>
                                <div className={`text-[11px] mt-0.5 ${isSelected ? "text-primary/70" : "text-muted-foreground"}`}>
                                  Сдача ~{addDays(slot.start_date, dur)}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {selectedSlot && (
                <div className="mt-2 flex items-center gap-2 text-[12px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  <Icon name="CheckCircle" size={13} className="shrink-0" />
                  Выбран: <strong>{formatSlotDate(selectedSlot.start_date)}</strong> · сдача ~{addDays(selectedSlot.start_date, selectedCfg?.duration_days ?? 62)}
                </div>
              )}
            </div>
          )}

          {/* Менеджер */}
          <div>
            <label className="block text-[13px] font-medium mb-1">
              Менеджер <span className="text-red-500">*</span>
            </label>
            <select name="manager_id" value={form.manager_id} onChange={onField}
              className="w-full border border-border rounded-lg px-3 py-2 text-[13px] bg-white outline-none focus:ring-1 focus:ring-primary">
              <option value="">— Выберите менеджера —</option>
              {managers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* Риэлтор */}
          <div>
            <label className="block text-[13px] font-medium mb-1">Риэлтор (опционально)</label>
            <select name="realtor_id" value={form.realtor_id} onChange={onField}
              className="w-full border border-border rounded-lg px-3 py-2 text-[13px] bg-white outline-none focus:ring-1 focus:ring-primary">
              <option value="">— Без риэлтора —</option>
              {realtors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* Примечания */}
          <div>
            <label className="block text-[13px] font-medium mb-1">Примечания</label>
            <textarea name="notes" value={form.notes} onChange={onField}
              rows={2} placeholder="Комментарии к сделке..."
              className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary resize-none" />
          </div>

          {formError && (
            <div className="flex items-center gap-2 text-red-600 text-[13px]">
              <Icon name="AlertCircle" size={14} />
              {formError}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 border border-border rounded-lg text-[13px] hover:bg-secondary transition-colors">
              Отмена
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
              {saving ? "Сохранение..." : "Сохранить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
