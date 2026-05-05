import { useEffect, useState, useRef } from "react";
import Icon from "@/components/ui/icon";
import { Deal, SlotItem, ContractDocItem, ContractDocsPackage, api } from "@/lib/api";

const MONTH_NAMES = ["","Январь","Февраль","Март","Апрель","Май","Июнь",
  "Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}
function addDays(d: string, n: number) {
  const dt = new Date(d); dt.setDate(dt.getDate() + n);
  return dt.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}
function daysBetween(d1: string, d2: string) {
  return Math.round((new Date(d2).getTime() - new Date(d1).getTime()) / 86400000);
}
const fmt = (n: number) => `₽ ${n.toLocaleString("ru")}`;
const MIN_BUFFER = 15;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function DocRow({ item, dealId, onUploaded }: {
  item: ContractDocItem;
  dealId: number;
  onUploaded: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [localFile, setLocalFile] = useState<string | null>(null);
  const isDone = item.status === "uploaded" || item.status === "approved";

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const b64 = await fileToBase64(file);
      await api.contract_docs.upload(dealId, item.template_id, b64, file.name);
      setLocalFile(file.name);
      onUploaded();
    } finally { setUploading(false); }
  };

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
      isDone ? "border-emerald-200 bg-emerald-50"
      : item.is_required ? "border-amber-200 bg-amber-50/50"
      : "border-border bg-white"
    }`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
        isDone ? "bg-emerald-500" : item.is_required ? "bg-amber-400" : "bg-muted"
      }`}>
        {isDone ? <Icon name="Check" size={14} className="text-white" />
          : uploading ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
          : <Icon name="Upload" size={13} className="text-white" />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[13px] font-semibold">{item.template_name}</span>
          {item.is_required && !isDone && (
            <span className="text-[10px] bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-md font-medium">обязательный</span>
          )}
        </div>
        {item.description && !isDone && (
          <div className="text-[11px] text-muted-foreground mt-0.5">{item.description}</div>
        )}
        {(isDone || localFile) && (
          <div className="text-[11px] text-emerald-700 mt-0.5 flex items-center gap-1">
            <Icon name="Paperclip" size={10} />
            {localFile || item.file_name || "Файл загружен"}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {item.template_file_url && (
          <a href={item.template_file_url} target="_blank" rel="noreferrer"
            className="flex items-center gap-1 px-2 py-1 border border-border bg-white rounded-lg text-[11px] text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors">
            <Icon name="Download" size={11} />Шаблон
          </a>
        )}
        {!isDone ? (
          <button type="button" disabled={uploading} onClick={() => inputRef.current?.click()}
            className="flex items-center gap-1 px-2.5 py-1 bg-primary text-white rounded-lg text-[11px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
            {uploading ? "..." : <><Icon name="Upload" size={11} />Загрузить</>}
          </button>
        ) : (
          <button type="button" onClick={() => inputRef.current?.click()}
            className="flex items-center gap-1 px-2 py-1 border border-emerald-300 bg-white rounded-lg text-[11px] text-emerald-700 hover:bg-emerald-50 transition-colors">
            <Icon name="RefreshCw" size={10} />Заменить
          </button>
        )}
        <input ref={inputRef} type="file" className="hidden"
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={handleFile} />
      </div>
    </div>
  );
}

interface Props {
  deal: Deal;
  saving: boolean;
  onClose: () => void;
  onSubmit: (body: object) => void;
}

export default function ContractModal({ deal, saving, onClose, onSubmit }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [step, setStep]             = useState<"docs" | "contract">("docs");
  const [docPackage, setDocPackage] = useState<ContractDocsPackage | null>(null);
  const [docsLoading, setDocsLoading] = useState(true);
  const [slots, setSlots]           = useState<SlotItem[]>([]);
  const [sloading, setSloading]     = useState(false);
  const [slotId, setSlotId]         = useState("");
  const [address, setAddress]       = useState(deal.address || "");
  const [budget, setBudget]         = useState(String(deal.budget || ""));
  const [signedDate, setSignedDate] = useState(today);
  const [error, setError]           = useState("");

  const isSerial = deal.project_type === "serial" || !deal.project_type;
  const cfgDur   = deal.configuration_duration || 115;

  useEffect(() => {
    api.contract_docs.get(deal.id).then(setDocPackage).finally(() => setDocsLoading(false));
  }, [deal.id]);

  useEffect(() => {
    if (step !== "contract" || !isSerial) return;
    setSloading(true); setSlotId("");
    api.slots.free(signedDate).then(setSlots).finally(() => setSloading(false));
  }, [step, isSerial, signedDate]);

  const reloadDocs = () => { api.contract_docs.get(deal.id).then(setDocPackage); };

  const minSlotDate = (() => {
    const d = new Date(signedDate); d.setDate(d.getDate() + MIN_BUFFER);
    return d.toISOString().slice(0, 10);
  })();

  const selectedSlot = slots.find(s => String(s.id) === slotId);
  const requiredDone  = docPackage?.all_required_done ?? false;
  const canProceed    = docsLoading || !docPackage || docPackage.items.length === 0 || requiredDone;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSerial && !slotId) { setError("Выберите производственный слот"); return; }
    if (!budget) { setError("Укажите сумму договора"); return; }
    if (selectedSlot && daysBetween(signedDate, selectedSlot.start_date) < MIN_BUFFER) {
      setError(`Слот должен быть минимум через ${MIN_BUFFER} дней после подписания`); return;
    }
    setError("");
    onSubmit({ slot_id: slotId ? Number(slotId) : null, address, budget: Number(budget), signed_date: signedDate });
  };

  const slotsByMonth: Record<string, SlotItem[]> = {};
  slots.forEach(s => { const k = `${s.year}-${s.month}`; if (!slotsByMonth[k]) slotsByMonth[k] = []; slotsByMonth[k].push(s); });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl border border-border shadow-xl w-full max-w-lg max-h-[92vh] overflow-y-auto animate-fade-in">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="font-semibold text-[15px]">Подписание договора · {deal.code}</h2>
            <p className="text-hint text-[12px]">{deal.client_name} · {deal.serial_project_name || "Инд. проект"}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><Icon name="X" size={18} /></button>
        </div>

        {/* Шаг-индикатор */}
        <div className="flex border-b border-border">
          {[
            { key: "docs",     num: 1, label: "Пакет документов" },
            { key: "contract", num: 2, label: "Данные договора" },
          ].map((s, i) => (
            <div key={s.key} className={`flex-1 flex items-center gap-2 px-4 py-3 text-[13px] font-medium transition-colors ${
              step === s.key ? "text-primary border-b-2 border-primary" : "text-muted-foreground"
            }`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                step === s.key ? "bg-primary text-white"
                : (i === 0 && step === "contract") ? "bg-emerald-500 text-white"
                : "bg-secondary text-muted-foreground"
              }`}>{i === 0 && step === "contract" ? "✓" : s.num}</span>
              {s.label}
            </div>
          ))}
        </div>

        {/* ШАГ 1: Пакет документов */}
        {step === "docs" && (
          <div className="px-5 py-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[13px] font-semibold">Загрузите пакет документов</div>
                <div className="text-hint text-[12px] mt-0.5">Обязательные — загрузить до подписания</div>
              </div>
              {!docsLoading && docPackage && (
                <div className={`text-[12px] font-medium px-2.5 py-1 rounded-full border ${
                  requiredDone ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
                }`}>
                  {docPackage.uploaded_count}/{docPackage.total} загружено
                </div>
              )}
            </div>

            {docsLoading ? (
              <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-secondary rounded-xl animate-pulse" />)}</div>
            ) : !docPackage || docPackage.items.length === 0 ? (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-2">
                <Icon name="Info" size={14} className="text-blue-500 shrink-0 mt-0.5" />
                <span className="text-[12px] text-blue-800">Пакет документов ещё не настроен директором. Можно перейти к следующему шагу.</span>
              </div>
            ) : (
              <div className="space-y-2">
                {docPackage.items.map(item => (
                  <DocRow key={item.template_id} item={item} dealId={deal.id} onUploaded={reloadDocs} />
                ))}
              </div>
            )}

            {!docsLoading && docPackage && docPackage.items.length > 0 && (
              !requiredDone ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                  <Icon name="AlertTriangle" size={14} className="text-amber-500 shrink-0 mt-0.5" />
                  <span className="text-[12px] text-amber-800">Загрузите все обязательные документы чтобы перейти к следующему шагу.</span>
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center gap-2">
                  <Icon name="CheckCircle" size={14} className="text-emerald-500 shrink-0" />
                  <span className="text-[12px] text-emerald-800 font-medium">Все обязательные документы загружены — можно подписывать</span>
                </div>
              )
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 px-4 py-2 border border-border rounded-lg text-[13px] hover:bg-secondary transition-colors">
                Отмена
              </button>
              <button type="button" onClick={() => setStep("contract")} disabled={!canProceed}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                Далее →
              </button>
            </div>
          </div>
        )}

        {/* ШАГ 2: Данные договора */}
        {step === "contract" && (
          <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">

            {deal.configuration_name && (
              <div className="bg-violet-50 border border-violet-200 rounded-xl p-3">
                <div className="text-[13px] font-semibold text-violet-900 mb-1">Комплектация из КП</div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[13px] text-violet-800">{deal.configuration_name}</div>
                    <div className="text-[11px] text-violet-600">{cfgDur} дней строительства</div>
                  </div>
                  <div className="text-[14px] font-bold text-violet-900">{fmt(deal.budget)}</div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-[13px] font-medium mb-1">Дата подписания <span className="text-red-500">*</span></label>
              <input type="date" value={signedDate} onChange={e => setSignedDate(e.target.value)} min={today}
                className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
              <div className="text-hint text-[11px] mt-1">Производственный слот — не ранее {fmtDate(minSlotDate)}</div>
            </div>

            <div>
              <label className="block text-[13px] font-medium mb-1">Адрес строительства</label>
              <input type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder="Точный адрес участка"
                className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
            </div>

            <div>
              <label className="block text-[13px] font-medium mb-1">Сумма договора (₽) <span className="text-red-500">*</span></label>
              <input type="number" value={budget} onChange={e => setBudget(e.target.value)} placeholder="6500000" min={0}
                className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
            </div>

            {isSerial && (
              <div>
                <label className="block text-[13px] font-medium mb-1">Производственный слот <span className="text-red-500">*</span></label>
                <div className="text-hint text-[11px] mb-2 flex items-center gap-1">
                  <Icon name="Info" size={11} className="shrink-0" />Показаны слоты после {fmtDate(minSlotDate)}
                </div>
                {sloading ? (
                  <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-12 bg-secondary rounded-xl animate-pulse" />)}</div>
                ) : slots.length === 0 ? (
                  <div className="border border-amber-200 bg-amber-50 rounded-xl p-3 flex items-start gap-2">
                    <Icon name="AlertTriangle" size={14} className="text-amber-500 shrink-0 mt-0.5" />
                    <span className="text-[12px] text-amber-800">Нет свободных слотов. Измените дату или обратитесь к директору.</span>
                  </div>
                ) : (
                  <div className="border border-border rounded-xl overflow-hidden">
                    {Object.entries(slotsByMonth).map(([key, monthSlots]) => {
                      const [year, month] = key.split("-").map(Number);
                      const occupied = monthSlots[0]?.occupied_count ?? 0;
                      const limit    = monthSlots[0]?.monthly_limit ?? 4;
                      const pct      = Math.round((occupied / limit) * 100);
                      return (
                        <div key={key} className="border-b border-border last:border-0">
                          <div className="flex items-center justify-between px-4 py-2 bg-background">
                            <span className="text-[13px] font-semibold">{MONTH_NAMES[month]} {year}</span>
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-border rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${pct >= 100 ? "bg-red-500" : pct >= 75 ? "bg-amber-400" : "bg-emerald-500"}`}
                                  style={{ width: `${Math.min(pct, 100)}%` }} />
                              </div>
                              <span className="text-[11px] text-hint">{occupied}/{limit}</span>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 p-3">
                            {monthSlots.map(slot => {
                              const isSel = slotId === String(slot.id);
                              const diff  = daysBetween(signedDate, slot.start_date);
                              return (
                                <button key={slot.id} type="button" onClick={() => setSlotId(String(slot.id))}
                                  className={`text-left px-3 py-2.5 rounded-lg border text-[12px] transition-all ${
                                    isSel ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border bg-white hover:border-primary/50"
                                  }`}>
                                  <div className="font-semibold">{fmtDate(slot.start_date)}</div>
                                  <div className={`text-[10px] mt-0.5 ${isSel ? "text-primary/70" : "text-hint"}`}>+{diff} дн. от подписания</div>
                                  <div className={`text-[10px] ${isSel ? "text-primary/70" : "text-hint"}`}>Сдача: ~{addDays(slot.start_date, cfgDur)}</div>
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
                  <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-center gap-2 text-[12px] text-emerald-700">
                    <Icon name="CheckCircle" size={13} className="shrink-0" />
                    {fmtDate(selectedSlot.start_date)} · через {daysBetween(signedDate, selectedSlot.start_date)} дн.
                  </div>
                )}
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
              <Icon name="Zap" size={13} className="text-blue-500 shrink-0 mt-0.5" />
              <span className="text-[12px] text-blue-800">Автоматически создастся проект <strong>ДОМ-XXXX</strong> с Гант-планом.</span>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-600 text-[13px]">
                <Icon name="AlertCircle" size={14} />{error}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setStep("docs")}
                className="px-4 py-2 border border-border rounded-lg text-[13px] hover:bg-secondary transition-colors">
                ← Назад
              </button>
              <button type="submit" disabled={saving}
                className="flex-1 px-4 py-2 bg-violet-600 text-white rounded-lg text-[13px] font-medium hover:bg-violet-700 transition-colors disabled:opacity-50">
                {saving ? "Создание проекта..." : "Подписать и создать проект"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
