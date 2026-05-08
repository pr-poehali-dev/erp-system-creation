import { useState, useMemo } from "react";
import Icon from "@/components/ui/icon";
import { api, SerialProject, SlotItem } from "@/lib/api";

const MONTHS = ["Янв","Фев","Мар","Апр","Май","Июн","Июл","Авг","Сен","Окт","Ноя","Дек"];

function fmtSlot(s: SlotItem): string {
  if (s.start_date) {
    const d = new Date(s.start_date);
    return `${d.getDate().toString().padStart(2,"0")}.${(d.getMonth()+1).toString().padStart(2,"0")}.${d.getFullYear()}`;
  }
  return `${MONTHS[s.month - 1]} ${s.year}`;
}

interface Props {
  project: SerialProject;
  slots: SlotItem[];
  onClose: () => void;
  onCreated: () => void;
}

export default function RealtorNewDealModal({ project, slots, onClose, onCreated }: Props) {
  const [step, setStep]                 = useState<1 | 2 | 3>(1);
  const [clientName, setClientName]     = useState("");
  const [clientPhone, setClientPhone]   = useState("");
  const [clientEmail, setClientEmail]   = useState("");
  const [address, setAddress]           = useState("");
  const [notes, setNotes]               = useState("");
  const [slotId, setSlotId]             = useState<number | null>(null);
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState("");

  const freeSlots = useMemo(() =>
    slots.filter(s => s.available).slice(0, 30),
  [slots]);

  const validStep1 = clientName.trim() && clientPhone.trim();
  const validStep2 = !!slotId;

  const commission = project.base_price * 0.03;

  const handleCreate = async () => {
    if (!validStep1 || !slotId) return;
    setSaving(true);
    setError("");
    try {
      // 1. Создать клиента
      const client = await api.clientCreate({
        name: clientName.trim(),
        phone: clientPhone.trim(),
        email: clientEmail.trim() || undefined,
        source: "Риэлтор",
      });

      // 2. Создать сделку — без manager_id, риэлтор сам инициатор
      // realtor_id = 1 (демо). В реальной системе подставится текущий staff
      await api.deals.create({
        client_id: client.id,
        realtor_id: 1,
        source: "Риэлтор",
        notes: notes.trim(),
        project_type: "serial",
        serial_project_id: project.id,
        address: address.trim(),
        slot_id: slotId,
      });

      onCreated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ошибка создания сделки");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl border border-border shadow-xl w-full max-w-lg max-h-[94vh] overflow-y-auto animate-fade-in">

        {/* Шапка */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="font-semibold text-[15px]">Новая сделка</h2>
            <p className="text-hint text-[12px] mt-0.5">{project.name} · {project.area_sqm} м²</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <Icon name="X" size={18} />
          </button>
        </div>

        {/* Шаги */}
        <div className="flex border-b border-border">
          {[
            { n: 1, label: "Клиент" },
            { n: 2, label: "Слот" },
            { n: 3, label: "Подтверждение" },
          ].map(s => (
            <div key={s.n} className={`flex-1 flex flex-col items-center gap-1 px-2 py-3 border-b-2 ${
              step === s.n ? "border-primary text-primary"
                : step > s.n ? "border-emerald-400 text-emerald-600"
                : "border-transparent text-muted-foreground"
            }`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                step > s.n ? "bg-emerald-500 text-white"
                  : step === s.n ? "bg-primary text-white"
                  : "bg-secondary text-muted-foreground"
              }`}>
                {step > s.n ? "✓" : s.n}
              </span>
              <span className="text-[11px] font-medium">{s.label}</span>
            </div>
          ))}
        </div>

        {/* ШАГ 1: Клиент */}
        {step === 1 && (
          <div className="px-5 py-5 space-y-3">
            <div>
              <label className="block text-[12px] font-medium mb-1">ФИО клиента *</label>
              <input value={clientName} onChange={e => setClientName(e.target.value)}
                placeholder="Иванов Иван Иванович"
                className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-[12px] font-medium mb-1">Телефон *</label>
              <input value={clientPhone} onChange={e => setClientPhone(e.target.value)}
                placeholder="+7 ___ ___-__-__"
                className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-[12px] font-medium mb-1">Email</label>
              <input value={clientEmail} onChange={e => setClientEmail(e.target.value)}
                placeholder="example@mail.ru"
                className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-[12px] font-medium mb-1">Адрес участка</label>
              <input value={address} onChange={e => setAddress(e.target.value)}
                placeholder="г. Москва, ул. ..."
                className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-[12px] font-medium mb-1">Комментарий</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                placeholder="Дополнительная информация..."
                className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary resize-none" />
            </div>

            <div className="flex gap-2 pt-2">
              <button type="button" onClick={onClose}
                className="px-4 py-2 border border-border rounded-lg text-[13px] hover:bg-secondary">Отмена</button>
              <button type="button" onClick={() => setStep(2)} disabled={!validStep1}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 disabled:opacity-40">
                Далее — Выбор слота →
              </button>
            </div>
          </div>
        )}

        {/* ШАГ 2: Слот */}
        {step === 2 && (
          <div className="px-5 py-5 space-y-3">
            <div className="text-[13px] font-semibold">Выберите свободный слот для строительства</div>
            <div className="text-[12px] text-muted-foreground">
              Слот — месяц старта проекта. Всего свободных: {freeSlots.length}
            </div>

            {freeSlots.length === 0 ? (
              <div className="text-center py-8 text-hint">
                <Icon name="CalendarX" size={28} className="mx-auto mb-2" />
                Нет свободных слотов
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 max-h-[280px] overflow-y-auto">
                {freeSlots.map(s => (
                  <button key={s.id} type="button" onClick={() => setSlotId(s.id)}
                    className={`px-3 py-2.5 rounded-lg border text-[13px] font-medium transition-all ${
                      slotId === s.id
                        ? "border-primary bg-primary text-white"
                        : "border-border hover:border-primary/50 hover:bg-secondary"
                    }`}>
                    {fmtSlot(s)}
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setStep(1)}
                className="px-4 py-2 border border-border rounded-lg text-[13px] hover:bg-secondary">← Назад</button>
              <button type="button" onClick={() => setStep(3)} disabled={!validStep2}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 disabled:opacity-40">
                Далее — Подтвердить →
              </button>
            </div>
          </div>
        )}

        {/* ШАГ 3: Подтверждение */}
        {step === 3 && (
          <div className="px-5 py-5 space-y-3">
            <div className="text-[13px] font-semibold">Проверьте данные перед созданием</div>

            <div className="bg-secondary/50 rounded-xl p-3 space-y-2 text-[13px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Проект:</span>
                <span className="font-semibold">{project.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Клиент:</span>
                <span className="font-semibold">{clientName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Телефон:</span>
                <span>{clientPhone}</span>
              </div>
              {address && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Адрес:</span>
                  <span className="text-right">{address}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Слот:</span>
                <span className="font-semibold">
                  {freeSlots.find(s => s.id === slotId) ? fmtSlot(freeSlots.find(s => s.id === slotId)!) : "—"}
                </span>
              </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between">
              <div>
                <div className="text-[12px] text-emerald-700">Сумма сделки</div>
                <div className="text-[15px] font-bold text-foreground">
                  ₽ {project.base_price.toLocaleString("ru")}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[12px] text-emerald-700">Ваша комиссия 3%</div>
                <div className="text-[15px] font-bold text-emerald-700">
                  ₽ {Math.round(commission).toLocaleString("ru")}
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-[12px] text-red-700 flex items-center gap-2">
                <Icon name="AlertCircle" size={14} />
                {error}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setStep(2)} disabled={saving}
                className="px-4 py-2 border border-border rounded-lg text-[13px] hover:bg-secondary disabled:opacity-50">← Назад</button>
              <button type="button" onClick={handleCreate} disabled={saving}
                className="flex-1 px-4 py-2 bg-emerald-500 text-white rounded-lg text-[13px] font-semibold hover:bg-emerald-600 disabled:opacity-50 flex items-center justify-center gap-2">
                {saving
                  ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Создание...</>
                  : <><Icon name="Check" size={14} /> Создать сделку</>
                }
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
