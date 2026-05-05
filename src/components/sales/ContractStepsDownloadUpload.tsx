import Icon from "@/components/ui/icon";
import { ContractDocsPackage } from "@/lib/api";
import ContractDocRow from "./ContractDocRow";

// ─── ШАГ 1: Скачать пакет ─────────────────────────────────────────────────────

interface DownloadProps {
  docsLoading: boolean;
  docPackage: ContractDocsPackage | null;
  onClose: () => void;
  onNext: () => void;
}

export function StepDownload({ docsLoading, docPackage, onClose, onNext }: DownloadProps) {
  return (
    <div className="px-5 py-5 space-y-4">
      <div className="text-[13px] font-semibold">Скачайте и подпишите документы с клиентом</div>
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
                  className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white rounded-lg text-[12px] font-medium hover:bg-primary/90 transition-colors">
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
        <span className="text-[12px] text-amber-800">Скачайте каждый документ, распечатайте, подпишите с клиентом, затем загрузите сканы на следующем шаге.</span>
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={onClose}
          className="flex-1 px-4 py-2 border border-border rounded-lg text-[13px] hover:bg-secondary transition-colors">Отмена</button>
        <button type="button" onClick={onNext}
          className="flex-1 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors">
          Далее — Загрузить сканы →
        </button>
      </div>
    </div>
  );
}

// ─── ШАГ 2: Загрузить сканы ───────────────────────────────────────────────────

interface UploadProps {
  docsLoading: boolean;
  docPackage: ContractDocsPackage | null;
  contractStatus: string;
  requiredDone: boolean;
  submitting: boolean;
  dealId: number;
  onReload: () => void;
  onBack: () => void;
  onNext: () => void;
  onSubmitReview: () => void;
}

export function StepUpload({
  docsLoading, docPackage, contractStatus, requiredDone,
  submitting, dealId, onReload, onBack, onNext, onSubmitReview,
}: UploadProps) {
  const isWaiting  = contractStatus === "docs_review";
  const isApproved = ["docs_approved","payment_pending","payment_confirmed"].includes(contractStatus);
  const signedDocs = (docPackage?.items || []).filter(it => it.signed_file_url);

  return (
    <div className="px-5 py-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-[13px] font-semibold">
          {isApproved ? "Документы подписаны компанией" : "Загрузите подписанные сканы"}
        </div>
        {docPackage && !isApproved && (
          <div className={`text-[12px] font-medium px-2.5 py-1 rounded-full border ${
            requiredDone ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
          }`}>
            {docPackage.uploaded_count}/{docPackage.total} загружено
          </div>
        )}
      </div>

      {/* Загрузка документов менеджером */}
      {!isApproved && (
        docsLoading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-secondary rounded-xl animate-pulse" />)}</div>
        ) : (
          <div className="space-y-2">
            {(docPackage?.items || []).map(item => (
              <ContractDocRow key={item.template_id} item={item} dealId={dealId} onUploaded={onReload} />
            ))}
          </div>
        )
      )}

      {/* Статус: отправлено на проверку */}
      {isWaiting && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
            <span className="text-[13px] font-semibold text-blue-900">Ожидание директора — 2 рабочих дня</span>
          </div>
          <span className="text-[12px] text-blue-800">
            Документы отправлены. Как только директор подпишет — вы получите уведомление.
          </span>
        </div>
      )}

      {/* Подписанные директором документы (появляются после одобрения) */}
      {isApproved && signedDocs.length > 0 && (
        <div className="space-y-2">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2">
            <Icon name="CheckCircle" size={15} className="text-emerald-600 shrink-0" />
            <span className="text-[12px] text-emerald-800 font-medium">
              Директор подписал документы со стороны компании. Скачайте их:
            </span>
          </div>
          {signedDocs.map(item => (
            <div key={item.template_id} className="flex items-center gap-3 p-3 border border-emerald-200 bg-emerald-50 rounded-xl">
              <Icon name="FileCheck" size={15} className="text-emerald-600 shrink-0" />
              <span className="text-[13px] flex-1 font-medium">{item.template_name}</span>
              <a href={item.signed_file_url!} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[12px] font-medium hover:bg-emerald-700 transition-colors">
                <Icon name="Download" size={12} />Скачать подписанный
              </a>
            </div>
          ))}
        </div>
      )}

      {!requiredDone && !isWaiting && !isApproved && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
          <Icon name="AlertTriangle" size={13} className="text-amber-500 shrink-0 mt-0.5" />
          <span className="text-[12px] text-amber-800">Загрузите все обязательные документы.</span>
        </div>
      )}

      {requiredDone && !isWaiting && !isApproved && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center gap-2">
          <Icon name="CheckCircle" size={13} className="text-emerald-500 shrink-0" />
          <span className="text-[12px] text-emerald-800 font-medium">Все загружены — отправьте на проверку директору</span>
        </div>
      )}

      <div className="flex gap-3">
        {!isApproved && (
          <button type="button" onClick={onBack}
            className="px-4 py-2 border border-border rounded-lg text-[13px] hover:bg-secondary transition-colors">← Назад</button>
        )}

        {!isApproved && !isWaiting && (
          <button type="button"
            disabled={!requiredDone || submitting}
            onClick={onSubmitReview}
            className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-lg text-[13px] font-medium hover:bg-amber-600 transition-colors disabled:opacity-40">
            {submitting ? "Отправка..." : "Отправить на проверку директору →"}
          </button>
        )}

        {isApproved && (
          <button type="button" onClick={onNext}
            className="flex-1 px-4 py-2 bg-violet-600 text-white rounded-lg text-[13px] font-medium hover:bg-violet-700 transition-colors">
            Далее — Ожидание оплаты →
          </button>
        )}
      </div>
    </div>
  );
}