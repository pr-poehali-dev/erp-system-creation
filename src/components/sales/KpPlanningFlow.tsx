/**
 * KpPlanningFlow — модальный флоу для этапа КП:
 * Шаг 1: Выбор производственного слота
 * Шаг 2: Менеджер скачивает и загружает документы
 * Шаг 3: Директор проверяет, подписывает, подтверждает оплату
 * Шаг 4: Менеджер нажимает «Перевести в планирование» (после оплаты)
 *   → слот booked, проект создаётся, сделка = planning
 */
import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { Deal, SlotItem, ContractDocsPackage, api } from "@/lib/api";
import { Role } from "@/App";
import ContractDocRow from "./ContractDocRow";
import ContractDirectorDocRow from "./ContractDirectorDocRow";

const MONTH_NAMES = ["","Январь","Февраль","Март","Апрель","Май","Июнь",
  "Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}
function addDays(d: string, n: number) {
  const dt = new Date(d); dt.setDate(dt.getDate() + n);
  return dt.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

interface Props {
  deal: Deal;
  role: Role;
  cfgDur: number;
  onDone: () => void;
  onClose: () => void;
}

type Step = "slot" | "download" | "upload" | "review" | "payment" | "planning";

function resolveStep(deal: Deal, cs: string, role: Role): Step {
  if (!deal.kp_slot_id) return "slot";
  if (cs === "payment_confirmed") return role === "director" ? "payment" : "planning";
  if (cs === "payment_pending")   return "payment";
  if (cs === "docs_approved")     return role === "director" ? "review" : "upload";
  if (cs === "docs_review")       return role === "director" ? "review" : "upload";
  if (cs === "docs_uploaded")     return "upload";
  return "download";
}

const STEP_LABELS: Record<Step, string> = {
  slot: "Слот", download: "Скачать", upload: "Загрузить",
  review: "Проверка", payment: "Оплата", planning: "Запуск",
};
const ALL_STEPS: Step[] = ["slot","download","upload","review","payment","planning"];

export default function KpPlanningFlow({ deal, role, cfgDur, onDone, onClose }: Props) {
  const isDirector = role === "director";
  const isManager  = !isDirector;

  const [slots, setSlots]           = useState<SlotItem[]>([]);
  const [sloading, setSloading]     = useState(false);
  const [slotId, setSlotId]         = useState(deal.kp_slot_id ? String(deal.kp_slot_id) : "");
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState("");

  const [docPackage, setDocPackage] = useState<ContractDocsPackage | null>(null);
  const [docsLoading, setDocsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [rejReason, setRejReason]   = useState("");

  const cs = docPackage?.contract_status ?? deal.contract_status ?? "none";
  const [step, setStep] = useState<Step>(() => resolveStep(deal, deal.contract_status ?? "none", role));

  const slotsByMonth: Record<string, SlotItem[]> = {};
  slots.forEach(s => {
    const k = `${s.year}-${s.month}`;
    if (!slotsByMonth[k]) slotsByMonth[k] = [];
    slotsByMonth[k].push(s);
  });

  const selectedSlot = slots.find(s => String(s.id) === slotId);
  const kpSlotDate   = deal.kp_slot_start_date;

  const reloadDocs = () => {
    api.contract_docs.get(deal.id).then(pkg => {
      setDocPackage(pkg);
      setStep(resolveStep(deal, pkg.contract_status, role));
    });
  };

  useEffect(() => {
    api.contract_docs.get(deal.id).then(pkg => {
      setDocPackage(pkg);
      setStep(resolveStep(deal, pkg.contract_status, role));
    }).finally(() => setDocsLoading(false));
  }, [deal.id]);

  useEffect(() => {
    if (deal.kp_slot_id) return;
    setSloading(true);
    api.slots.free().then(setSlots).finally(() => setSloading(false));
  }, [deal.kp_slot_id]);

  const handleSaveSlot = async () => {
    if (!slotId) { setError("Выберите слот"); return; }
    setSaving(true); setError("");
    try {
      await api.deals.saveKpSlot(deal.id, Number(slotId));
      onDone();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally { setSaving(false); }
  };

  const handleSubmitReview = async () => {
    setSubmitting(true);
    try { await api.contract_docs.submitReview(deal.id); reloadDocs(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Ошибка"); }
    finally { setSubmitting(false); }
  };

  const handleApprove = async () => {
    setSubmitting(true);
    try { await api.contract_docs.approve(deal.id); reloadDocs(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Ошибка"); }
    finally { setSubmitting(false); }
  };

  const handleReject = async () => {
    if (!rejReason.trim()) return;
    setSubmitting(true);
    try { await api.contract_docs.reject(deal.id, rejReason); setShowReject(false); reloadDocs(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Ошибка"); }
    finally { setSubmitting(false); }
  };

  const handleConfirmPayment = async () => {
    setSubmitting(true);
    try { await api.contract_docs.confirmPayment(deal.id); reloadDocs(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Ошибка"); }
    finally { setSubmitting(false); }
  };

  const handleToPlanning = async () => {
    setSaving(true); setError("");
    try { await api.deals.toPlanning(deal.id); onDone(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Ошибка"); }
    finally { setSaving(false); }
  };

  const stepDone = (s: Step): boolean => {
    if (s === "slot")     return !!deal.kp_slot_id;
    if (s === "download") return !!deal.kp_slot_id && cs !== "none";
    if (s === "upload")   return ["docs_review","docs_approved","payment_pending","payment_confirmed"].includes(cs);
    if (s === "review")   return ["docs_approved","payment_pending","payment_confirmed"].includes(cs);
    if (s === "payment")  return cs === "payment_confirmed";
    if (s === "planning") return deal.stage === "planning";
    return false;
  };

  const items        = docPackage?.items || [];
  const requiredDone = items.filter(it => it.is_required).every(it => ["uploaded","approved","review"].includes(it.status));
  const allSigned    = items.length > 0 && items.every(it => it.signed_file_url);
  const isApproved   = ["docs_approved","payment_pending","payment_confirmed"].includes(cs);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl border border-border shadow-xl w-full max-w-xl max-h-[94vh] overflow-y-auto animate-fade-in">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="font-semibold text-[15px]">Подготовка к производству · {deal.code}</h2>
            <p className="text-hint text-[12px]">{deal.client_name} · {deal.serial_project_name || "Инд. проект"}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <Icon name="X" size={18} />
          </button>
        </div>

        {/* Шаг-индикатор */}
        <div className="flex border-b border-border overflow-x-auto">
          {ALL_STEPS.map((s, i) => {
            const isDone   = stepDone(s);
            const isActive = step === s;
            return (
              <div key={s} className={`flex-1 min-w-[72px] flex flex-col items-center gap-1 px-1 py-2.5 text-center border-b-2 transition-colors ${
                isActive ? "border-primary text-primary" : isDone ? "border-emerald-400 text-emerald-600" : "border-transparent text-muted-foreground"
              }`}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  isDone ? "bg-emerald-500 text-white" : isActive ? "bg-primary text-white" : "bg-secondary text-muted-foreground"
                }`}>{isDone ? "✓" : i + 1}</span>
                <span className="text-[10px] font-medium leading-tight">{STEP_LABELS[s]}</span>
              </div>
            );
          })}
        </div>

        {/* ── ШАГ 1: Выбор слота ── */}
        {step === "slot" && (
          <div className="px-5 py-5 space-y-4">
            <div className="text-[13px] font-semibold">Выберите производственный слот</div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 flex items-start gap-2">
              <Icon name="Info" size={13} className="text-blue-500 shrink-0 mt-0.5" />
              <span className="text-[12px] text-blue-800">
                Слот бронируется только при финальном переводе в производство. Сейчас — выбор даты для договора.
                Доступны слоты не ранее чем через 10 дней от сегодня.
              </span>
            </div>

            {sloading ? (
              <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-12 bg-secondary rounded-xl animate-pulse" />)}</div>
            ) : slots.length === 0 ? (
              <div className="border border-amber-200 bg-amber-50 rounded-xl p-3 flex items-start gap-2">
                <Icon name="AlertTriangle" size={14} className="text-amber-600 shrink-0" />
                <div className="text-[12px] text-amber-800">Нет свободных слотов с нужным плечом (10+ дней). Обратитесь к директору.</div>
              </div>
            ) : (
              <div className="border border-border rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                {Object.entries(slotsByMonth).map(([key, monthSlots]) => {
                  const [year, month] = key.split("-").map(Number);
                  const occupied = monthSlots[0]?.occupied_count ?? 0;
                  const limit    = monthSlots[0]?.monthly_limit ?? 4;
                  const pct      = Math.min(Math.round((occupied / limit) * 100), 100);
                  const isFull   = pct >= 100;
                  return (
                    <div key={key} className="border-b border-border last:border-0">
                      <div className={`flex items-center justify-between px-4 py-2.5 ${isFull ? "bg-red-50" : "bg-background"}`}>
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold">{MONTH_NAMES[month]} {year}</span>
                          {isFull && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">Заполнен</span>}
                        </div>
                        <span className="text-[11px] text-hint">{occupied}/{limit}</span>
                      </div>
                      {!isFull && (
                        <div className="grid grid-cols-2 gap-2 p-3">
                          {monthSlots.filter(s => s.available).map(slot => {
                            const isSel = slotId === String(slot.id);
                            return (
                              <button key={slot.id} type="button" onClick={() => setSlotId(String(slot.id))}
                                className={`text-left px-3 py-2 rounded-xl border text-[12px] transition-all ${
                                  isSel ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/50"
                                }`}>
                                <div className="font-semibold text-[13px]">{fmtDate(slot.start_date)}</div>
                                <div className={`text-[10px] mt-0.5 ${isSel ? "text-primary/70" : "text-hint"}`}>
                                  Сдача: ~{addDays(slot.start_date, cfgDur)}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {selectedSlot && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-center gap-2">
                <Icon name="CheckCircle" size={13} className="text-emerald-600 shrink-0" />
                <span className="text-[12px] text-emerald-700 font-medium">
                  Выбран: {fmtDate(selectedSlot.start_date)} — сдача ~{addDays(selectedSlot.start_date, cfgDur)}
                </span>
              </div>
            )}

            {error && <div className="text-red-600 text-[13px] flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2"><Icon name="AlertCircle" size={14} />{error}</div>}

            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="px-4 py-2 border border-border rounded-lg text-[13px] hover:bg-secondary">Отмена</button>
              <button type="button" onClick={handleSaveSlot} disabled={!slotId || saving}
                className="flex-1 px-4 py-2.5 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Сохранение...</> : "Сохранить слот → к документам"}
              </button>
            </div>
          </div>
        )}

        {/* ── ШАГ 2: Менеджер — скачать ── */}
        {step === "download" && isManager && (
          <div className="px-5 py-5 space-y-4">
            <div className="text-[13px] font-semibold">Скачайте документы и подпишите с клиентом</div>
            {kpSlotDate && (
              <div className="bg-violet-50 border border-violet-200 rounded-lg px-3 py-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-violet-500 shrink-0" />
                <span className="text-[12px] text-violet-800">Слот: <strong>{fmtDate(kpSlotDate)}</strong> — дата прописана в договоре</span>
              </div>
            )}
            {docsLoading ? (
              <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 bg-secondary rounded-xl animate-pulse" />)}</div>
            ) : !docPackage?.items.length ? (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2">
                <Icon name="Info" size={14} className="text-blue-500 shrink-0 mt-0.5" />
                <span className="text-[12px] text-blue-800">Шаблоны документов ещё не добавлены директором.</span>
              </div>
            ) : (
              <div className="space-y-2">
                {docPackage.items.map(item => (
                  <div key={item.template_id} className="flex items-center gap-3 p-3 border border-border rounded-xl">
                    <Icon name="FileText" size={16} className="text-primary shrink-0" />
                    <div className="flex-1">
                      <div className="text-[13px] font-medium">{item.template_name}</div>
                      {item.description && <div className="text-hint text-[11px]">{item.description}</div>}
                    </div>
                    {item.template_file_url ? (
                      <a href={item.template_file_url} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white rounded-lg text-[12px] font-medium hover:bg-primary/90">
                        <Icon name="Download" size={12} />Скачать
                      </a>
                    ) : (
                      <span className="text-[11px] text-hint italic">Файл не загружен</span>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
              <Icon name="Info" size={13} className="text-amber-600 shrink-0 mt-0.5" />
              <span className="text-[12px] text-amber-800">Скачайте, распечатайте, подпишите с клиентом, затем загрузите сканы.</span>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="px-4 py-2 border border-border rounded-lg text-[13px] hover:bg-secondary">Закрыть</button>
              <button type="button" onClick={() => setStep("upload")}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90">
                Далее — Загрузить сканы →
              </button>
            </div>
          </div>
        )}

        {/* ── ШАГ 3: Менеджер — загрузить сканы ── */}
        {step === "upload" && isManager && (
          <div className="px-5 py-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-[13px] font-semibold">
                {isApproved ? "Документы одобрены директором" : "Загрузите подписанные сканы"}
              </div>
              {docPackage && !isApproved && (
                <div className={`text-[12px] font-medium px-2.5 py-1 rounded-full border ${
                  requiredDone ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
                }`}>{docPackage.uploaded_count}/{docPackage.total} загружено</div>
              )}
            </div>

            {cs === "docs_review" && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
                  <span className="text-[13px] font-semibold text-blue-900">Ожидание директора — 2 рабочих дня</span>
                </div>
                <span className="text-[12px] text-blue-800">Документы отправлены. Как только директор подпишет — здесь появятся подписанные файлы.</span>
              </div>
            )}

            {!isApproved && cs !== "docs_review" && (
              docsLoading ? (
                <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-secondary rounded-xl animate-pulse" />)}</div>
              ) : (
                <div className="space-y-2">
                  {items.map(item => <ContractDocRow key={item.template_id} item={item} dealId={deal.id} onUploaded={reloadDocs} />)}
                </div>
              )
            )}

            {isApproved && (
              <div className="space-y-2">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2">
                  <Icon name="CheckCircle" size={15} className="text-emerald-600 shrink-0" />
                  <span className="text-[12px] text-emerald-800 font-medium">Директор подписал документы. Скачайте их:</span>
                </div>
                {items.filter(it => it.signed_file_url).map(item => (
                  <div key={item.template_id} className="flex items-center gap-3 p-3 border border-emerald-200 bg-emerald-50 rounded-xl">
                    <Icon name="FileCheck" size={15} className="text-emerald-600 shrink-0" />
                    <span className="text-[13px] flex-1 font-medium">{item.template_name}</span>
                    <a href={item.signed_file_url!} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[12px] font-medium hover:bg-emerald-700">
                      <Icon name="Download" size={12} />Скачать подписанный
                    </a>
                  </div>
                ))}
              </div>
            )}

            {/* Оплата подтверждена — кнопка запуска */}
            {cs === "payment_confirmed" && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Icon name="BadgeCheck" size={18} className="text-emerald-600" />
                  <span className="text-[14px] font-bold text-emerald-900">Оплата подтверждена директором!</span>
                </div>
                <div className="text-[12px] text-emerald-800">
                  <ul className="space-y-1 list-disc list-inside">
                    <li>Слот → <strong>«Зарезервирован»</strong> (жёлтый)</li>
                    <li>Появится карточка проекта в «Строительстве»</li>
                    <li>Сделка → «Планирование»</li>
                  </ul>
                </div>
                <button type="button" onClick={handleToPlanning} disabled={saving}
                  className="w-full px-4 py-3 bg-emerald-600 text-white rounded-lg text-[14px] font-bold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Icon name="PlayCircle" size={18} />}
                  {saving ? "Создание проекта..." : "Перевести в планирование →"}
                </button>
              </div>
            )}

            {!requiredDone && !["docs_review","docs_approved","payment_pending","payment_confirmed"].includes(cs) && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                <Icon name="AlertTriangle" size={13} className="text-amber-500 shrink-0 mt-0.5" />
                <span className="text-[12px] text-amber-800">Загрузите все обязательные документы.</span>
              </div>
            )}
            {requiredDone && !["docs_review","docs_approved","payment_pending","payment_confirmed"].includes(cs) && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center gap-2">
                <Icon name="CheckCircle" size={13} className="text-emerald-500 shrink-0" />
                <span className="text-[12px] text-emerald-800 font-medium">Все загружены — отправьте на проверку директору</span>
              </div>
            )}

            {error && <div className="text-red-600 text-[13px] flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2"><Icon name="AlertCircle" size={14} />{error}</div>}

            <div className="flex gap-3">
              {!isApproved && (
                <button type="button" onClick={() => setStep("download")}
                  className="px-4 py-2 border border-border rounded-lg text-[13px] hover:bg-secondary">← Назад</button>
              )}
              {!isApproved && cs !== "docs_review" && (
                <button type="button" onClick={handleSubmitReview} disabled={!requiredDone || submitting}
                  className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-lg text-[13px] font-medium hover:bg-amber-600 disabled:opacity-40">
                  {submitting ? "Отправка..." : "Отправить на проверку директору →"}
                </button>
              )}
              {cs === "payment_pending" && (
                <button type="button" onClick={onClose}
                  className="flex-1 px-4 py-2 border border-border rounded-lg text-[13px] hover:bg-secondary">Закрыть (ожидание оплаты)</button>
              )}
            </div>
          </div>
        )}

        {/* ── ДИРЕКТОР — проверка + оплата ── */}
        {isDirector && ["download","upload","review","payment"].includes(step) && (
          <div className="px-5 py-5 space-y-4">
            <div className="text-[13px] font-semibold">
              {cs === "payment_pending" ? "Подтверждение оплаты" :
               cs === "payment_confirmed" ? "Оплата подтверждена" :
               "Проверка и подписание документов"}
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-2">
              <Icon name="Clock" size={13} className="text-amber-600 shrink-0" />
              <span className="text-[12px] text-amber-800"><strong>Регламент:</strong> проверка — 2 рабочих дня.</span>
            </div>

            {!isApproved && (
              <div className="space-y-3">
                <div className="border border-blue-200 bg-blue-50 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon name="FileSearch" size={16} className="text-blue-600 shrink-0" />
                    <span className="text-[13px] font-semibold text-blue-900">Скачайте документ, подпишите, загрузите</span>
                  </div>
                  <div className="text-[12px] text-blue-800">Нажмите «От менеджера» → скачайте → подпишите → загрузите кнопкой «Загрузить».</div>
                </div>

                {cs === "none" && (
                  <div className="text-center text-hint text-[13px] py-4">Менеджер ещё не загрузил документы</div>
                )}

                {cs !== "none" && (
                  docsLoading ? (
                    <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-14 bg-secondary rounded-xl animate-pulse" />)}</div>
                  ) : (
                    <div className="space-y-2">
                      {items.map(item => <ContractDirectorDocRow key={item.template_id} item={item} dealId={deal.id} onUploaded={reloadDocs} />)}
                    </div>
                  )
                )}

                {cs === "docs_review" && items.length > 0 && (
                  <div className="pt-2 border-t border-border space-y-2">
                    <div className="text-[11px] font-medium">
                      {allSigned ? "✓ Все подписаны — подтвердите:" : "Загрузите подписанные варианты всех документов:"}
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={handleApprove} disabled={submitting || !allSigned}
                        className="flex-1 px-3 py-2 bg-emerald-500 text-white rounded-lg text-[12px] font-medium hover:bg-emerald-600 disabled:opacity-50">
                        {submitting ? "..." : "✓ Подтвердить и отправить менеджеру"}
                      </button>
                      <button type="button" onClick={() => setShowReject(v => !v)}
                        className="px-3 py-2 border border-red-200 text-red-600 rounded-lg text-[12px] hover:bg-red-50">Отклонить</button>
                    </div>
                    {!allSigned && (
                      <div className="text-[11px] text-amber-600 flex items-center gap-1">
                        <Icon name="AlertTriangle" size={11} />
                        Загрузите подписанные варианты всех документов
                      </div>
                    )}
                    {showReject && (
                      <div className="space-y-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                        <div className="text-[12px] font-medium text-red-700">Причина отклонения:</div>
                        <textarea value={rejReason} onChange={e => setRejReason(e.target.value)} rows={2}
                          placeholder="Опишите что нужно исправить..."
                          className="w-full border border-red-200 rounded-lg px-3 py-2 text-[12px] outline-none focus:ring-1 focus:ring-red-400 resize-none bg-white" />
                        <div className="flex gap-2">
                          <button onClick={() => setShowReject(false)}
                            className="px-3 py-1.5 border border-border rounded-lg text-[12px] text-muted-foreground hover:bg-secondary">Отмена</button>
                          <button onClick={handleReject} disabled={!rejReason.trim() || submitting}
                            className="flex-1 px-3 py-1.5 bg-red-500 text-white rounded-lg text-[12px] font-medium disabled:opacity-40">
                            {submitting ? "..." : "Отклонить и вернуть менеджеру"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {cs === "payment_pending" && (
              <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 space-y-3">
                <div className="text-[13px] font-semibold text-amber-900">Ожидание аванса от заказчика</div>
                <div className="text-[12px] text-amber-800">После получения аванса нажмите кнопку — менеджер сможет создать проект.</div>
                <button type="button" onClick={handleConfirmPayment} disabled={submitting}
                  className="w-full px-4 py-2.5 bg-emerald-500 text-white rounded-lg text-[13px] font-semibold hover:bg-emerald-600 disabled:opacity-50 flex items-center justify-center gap-2">
                  <Icon name="BadgeCheck" size={16} />
                  {submitting ? "..." : "Оплата прошла — подтвердить"}
                </button>
              </div>
            )}

            {cs === "payment_confirmed" && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Icon name="CheckCircle" size={18} className="text-emerald-600" />
                  <span className="text-[14px] font-bold text-emerald-900">Оплата подтверждена!</span>
                </div>
                <div className="text-[12px] text-emerald-700">Менеджер переведёт сделку в производство.</div>
              </div>
            )}

            {error && <div className="text-red-600 text-[13px] flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2"><Icon name="AlertCircle" size={14} />{error}</div>}
            <button type="button" onClick={onClose} className="w-full px-4 py-2 border border-border rounded-lg text-[13px] hover:bg-secondary">Закрыть</button>
          </div>
        )}

      </div>
    </div>
  );
}
