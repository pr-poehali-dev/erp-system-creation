import Icon from "@/components/ui/icon";
import { ContractDocItem, ContractDocsPackage } from "@/lib/api";
import { fmtDate } from "./KpFlowSlotStep";
import ContractDocRow from "./ContractDocRow";

type Step = "slot" | "download" | "upload" | "review" | "payment" | "planning";

interface Props {
  step: Step;
  cs: string;
  kpSlotDate: string | null;
  docPackage: ContractDocsPackage | null;
  docsLoading: boolean;
  items: ContractDocItem[];
  requiredDone: boolean;
  isApproved: boolean;
  submitting: boolean;
  saving: boolean;
  error: string;
  dealId: number;
  onSetStep: (s: Step) => void;
  onReloadDocs: () => void;
  onSubmitReview: () => void;
  onToPlanning: () => void;
  onClose: () => void;
}

export default function KpFlowManagerDocs({
  step, cs, kpSlotDate, docPackage, docsLoading, items,
  requiredDone, isApproved, submitting, saving, error,
  dealId, onSetStep, onReloadDocs, onSubmitReview, onToPlanning, onClose,
}: Props) {
  return (
    <>
      {/* ── ШАГ 2: Менеджер — скачать ── */}
      {step === "download" && (
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
            <button type="button" onClick={() => onSetStep("upload")}
              className="flex-1 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90">
              Далее — Загрузить сканы →
            </button>
          </div>
        </div>
      )}

      {/* ── ШАГ 3: Менеджер — загрузить сканы ── */}
      {step === "upload" && (
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
                {items.map(item => <ContractDocRow key={item.template_id} item={item} dealId={dealId} onUploaded={onReloadDocs} />)}
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
              <button type="button" onClick={onToPlanning} disabled={saving}
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
              <button type="button" onClick={() => onSetStep("download")}
                className="px-4 py-2 border border-border rounded-lg text-[13px] hover:bg-secondary">← Назад</button>
            )}
            {!isApproved && cs !== "docs_review" && (
              <button type="button" onClick={onSubmitReview} disabled={!requiredDone || submitting}
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
    </>
  );
}
