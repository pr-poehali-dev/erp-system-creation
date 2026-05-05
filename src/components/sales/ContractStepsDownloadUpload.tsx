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
  onSubmitReview: () => void;
}

export function StepUpload({
  docsLoading, docPackage, contractStatus, requiredDone,
  submitting, dealId, onReload, onBack, onSubmitReview,
}: UploadProps) {
  return (
    <div className="px-5 py-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-[13px] font-semibold">Загрузите подписанные сканы</div>
        {docPackage && (
          <div className={`text-[12px] font-medium px-2.5 py-1 rounded-full border ${
            requiredDone ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
          }`}>
            {docPackage.uploaded_count}/{docPackage.total} загружено
          </div>
        )}
      </div>

      {docsLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-secondary rounded-xl animate-pulse" />)}</div>
      ) : (
        <div className="space-y-2">
          {(docPackage?.items || []).map(item => (
            <ContractDocRow key={item.template_id} item={item} dealId={dealId} onUploaded={onReload} />
          ))}
        </div>
      )}

      {contractStatus === "docs_review" && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
          <span className="text-[12px] text-blue-800 font-medium">Документы отправлены на проверку директору. Ожидайте подтверждения.</span>
        </div>
      )}

      {!requiredDone && contractStatus !== "docs_review" && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
          <Icon name="AlertTriangle" size={13} className="text-amber-500 shrink-0 mt-0.5" />
          <span className="text-[12px] text-amber-800">Загрузите все обязательные документы.</span>
        </div>
      )}

      {requiredDone && contractStatus !== "docs_review" && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center gap-2">
          <Icon name="CheckCircle" size={13} className="text-emerald-500 shrink-0" />
          <span className="text-[12px] text-emerald-800 font-medium">Все обязательные загружены — отправьте на проверку директору</span>
        </div>
      )}

      <div className="flex gap-3">
        <button type="button" onClick={onBack}
          className="px-4 py-2 border border-border rounded-lg text-[13px] hover:bg-secondary transition-colors">← Назад</button>
        <button type="button"
          disabled={!requiredDone || contractStatus === "docs_review" || submitting}
          onClick={onSubmitReview}
          className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-lg text-[13px] font-medium hover:bg-amber-600 transition-colors disabled:opacity-40">
          {submitting ? "Отправка..." : contractStatus === "docs_review" ? "Отправлено на проверку" : "Отправить на проверку директору →"}
        </button>
      </div>
    </div>
  );
}
