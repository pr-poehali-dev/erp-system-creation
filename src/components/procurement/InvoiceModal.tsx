import { useRef } from "react";
import { Invoice, Supplier, Material } from "@/lib/api"; // Supplier, Material нужны для props
import Icon from "@/components/ui/icon";
import InvoiceAiPanel from "./InvoiceAiPanel";
import {
  InvoiceForm, UploadedFile, AiRecognizeResult, AiItem,
  STATUS_CFG, EXT_ICON, ACCEPT_TYPES, ACCEPT_HINT, fmtMoney,
} from "./invoices.shared";

interface Props {
  editItem: Invoice | null;
  form: InvoiceForm;
  setForm: React.Dispatch<React.SetStateAction<InvoiceForm>>;
  localFile: File | null;
  uploadedFile: UploadedFile | null;
  saving: boolean;
  error: string;
  recognizing: boolean;
  applying: boolean;
  aiResult: AiRecognizeResult | null;
  aiError: string;
  canRecognize: boolean;
  canSeeRawData: boolean;
  suppliers: Supplier[];
  materials: Material[];
  onClose: () => void;
  onSave: (e: React.FormEvent) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: () => void;
  onRecognize: () => void;
  onApplyAI: (items: AiItem[], invoiceDate: string, invoiceNumber: string) => void;
  onDismissAI: () => void;
}

export default function InvoiceModal({
  editItem, form, setForm,
  localFile, uploadedFile,
  saving, error,
  recognizing, applying, aiResult, aiError, canRecognize, canSeeRawData,
  suppliers, materials,
  onClose, onSave, onFileSelect, onRemoveFile,
  onRecognize, onApplyAI, onDismissAI,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  const hasFile     = !!(localFile || uploadedFile);
  const displayName = localFile?.name || uploadedFile?.name || "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white rounded-xl border border-border shadow-xl w-full max-w-lg max-h-[92vh] overflow-y-auto animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-[15px]">{editItem ? "Редактировать счёт" : "Новый счёт"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <Icon name="X" size={18} />
          </button>
        </div>

        <form onSubmit={onSave} className="px-5 py-4 space-y-4">

          {/* ── Файл ── */}
          <div>
            <label className="block text-[13px] font-medium mb-1.5">
              Файл документа
              <span className="ml-1.5 text-[11px] font-normal text-hint">({ACCEPT_HINT})</span>
            </label>

            {hasFile ? (
              <div className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border ${
                localFile ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"
              }`}>
                <Icon
                  name={EXT_ICON[displayName.split(".").pop()?.toLowerCase() || ""] || "File"}
                  size={18}
                  className={localFile ? "text-amber-600 shrink-0" : "text-emerald-600 shrink-0"}
                />
                <div className="flex-1 min-w-0">
                  <div className={`text-[13px] font-medium truncate ${localFile ? "text-amber-800" : "text-emerald-800"}`}>
                    {displayName}
                  </div>
                  {localFile && (
                    <div className="text-[11px] text-amber-600">
                      {(localFile.size / 1024).toFixed(0)} КБ · загрузится при сохранении
                    </div>
                  )}
                  {!localFile && uploadedFile?.url && (
                    <a href={uploadedFile.url} target="_blank" rel="noreferrer"
                      className="text-[11px] text-emerald-600 hover:underline">
                      открыть файл
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <label className="cursor-pointer text-muted-foreground hover:text-primary transition-colors" title="Сменить файл">
                    <input type="file" accept={ACCEPT_TYPES} className="hidden" onChange={onFileSelect} />
                    <Icon name="RefreshCw" size={13} />
                  </label>
                  <button type="button" onClick={onRemoveFile}
                    className="text-muted-foreground hover:text-red-500 transition-colors ml-1" title="Убрать файл">
                    <Icon name="X" size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <label className="flex items-center gap-2.5 px-3 py-3 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 hover:bg-secondary/40 transition-colors">
                <input ref={fileRef} type="file" accept={ACCEPT_TYPES} className="hidden" onChange={onFileSelect} />
                <Icon name="Upload" size={16} className="text-muted-foreground shrink-0" />
                <div>
                  <div className="text-[13px] text-muted-foreground font-medium">Нажмите для выбора файла</div>
                  <div className="text-[11px] text-hint">{ACCEPT_HINT}</div>
                </div>
              </label>
            )}
          </div>

          {/* ── AI кнопка ── */}
          {canRecognize && (
            <div className="space-y-2">
              {aiResult ? (
                <InvoiceAiPanel
                  result={aiResult}
                  showDebug={canSeeRawData}
                  applying={applying}
                  invoiceId={editItem?.id}
                  onApply={onApplyAI}
                  onDismiss={onDismissAI}
                />
              ) : (
                <button type="button" onClick={onRecognize} disabled={recognizing}
                  className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-primary/30 rounded-xl text-[13px] font-medium text-primary hover:bg-primary/5 transition-colors disabled:opacity-60">
                  {recognizing
                    ? <><Icon name="Loader" size={14} className="animate-spin" />Распознаём через ИИ...</>
                    : <><Icon name="Sparkles" size={14} />Распознать через ИИ</>
                  }
                </button>
              )}
              {aiError && (
                <div className="flex items-center gap-1.5 text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <Icon name="AlertCircle" size={13} className="shrink-0" />
                  {aiError}
                </div>
              )}
            </div>
          )}

          {/* ── Поля формы ── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[13px] font-medium mb-1">Поставщик</label>
              <select value={form.supplier_id} onChange={e => setForm(p => ({ ...p, supplier_id: e.target.value }))}
                className="w-full border border-border rounded-lg px-3 py-2 text-[13px] bg-white outline-none focus:ring-1 focus:ring-primary">
                <option value="">— не указан —</option>
                {suppliers.filter(s => s.name !== "(не указан)").map(s =>
                  <option key={s.id} value={s.id}>{s.name}</option>
                )}
              </select>
            </div>
            <div>
              <label className="block text-[13px] font-medium mb-1">Материал</label>
              <select value={form.material_id} onChange={e => setForm(p => ({ ...p, material_id: e.target.value }))}
                className="w-full border border-border rounded-lg px-3 py-2 text-[13px] bg-white outline-none focus:ring-1 focus:ring-primary">
                <option value="">— не указан —</option>
                {materials.filter(m => m.name !== "(не указан)").map(m =>
                  <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>
                )}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[13px] font-medium mb-1">Дата счёта</label>
              <input type="date" value={form.invoice_date}
                onChange={e => setForm(p => ({ ...p, invoice_date: e.target.value }))}
                className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-[13px] font-medium mb-1">Номер счёта</label>
              <input value={form.invoice_number}
                onChange={e => setForm(p => ({ ...p, invoice_number: e.target.value }))}
                placeholder="СФ-0001"
                className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[13px] font-medium mb-1">Цена за единицу</label>
              <input type="number" step="0.01" min="0" value={form.unit_price}
                onChange={e => setForm(p => ({ ...p, unit_price: e.target.value }))}
                placeholder="0.00"
                className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-[13px] font-medium mb-1">Количество</label>
              <input type="number" step="0.001" min="0" value={form.quantity}
                onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))}
                placeholder="0"
                className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>

          {form.unit_price && form.quantity && Number(form.unit_price) > 0 && Number(form.quantity) > 0 && (
            <div className="text-[13px] font-semibold text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2 flex items-center gap-1.5">
              <Icon name="Calculator" size={13} />
              Сумма: {fmtMoney(Number(form.unit_price) * Number(form.quantity))}
            </div>
          )}

          <div>
            <label className="block text-[13px] font-medium mb-1">Статус распознавания</label>
            <select value={form.recognition_status}
              onChange={e => setForm(p => ({ ...p, recognition_status: e.target.value as Invoice["recognition_status"] }))}
              className="w-full border border-border rounded-lg px-3 py-2 text-[13px] bg-white outline-none focus:ring-1 focus:ring-primary">
              {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>

          {canSeeRawData && (
            <div>
              <label className="block text-[13px] font-medium mb-1">Распознанные данные (JSON)</label>
              <textarea value={form.recognized_data}
                onChange={e => setForm(p => ({ ...p, recognized_data: e.target.value }))}
                rows={3}
                className="w-full border border-border rounded-lg px-3 py-2 text-[12px] font-mono outline-none focus:ring-1 focus:ring-primary resize-none" />
            </div>
          )}

          {error && (
            <div className="flex items-center gap-1.5 text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <Icon name="AlertCircle" size={13} className="shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors">
              {saving
                ? <><Icon name="Loader" size={13} className="animate-spin" />Сохраняем...</>
                : <><Icon name="Save" size={13} />{editItem ? "Сохранить" : "Создать счёт"}</>
              }
            </button>
            <button type="button" onClick={onClose}
              className="px-4 py-2 border border-border rounded-lg text-[13px] text-muted-foreground hover:bg-secondary transition-colors">
              Отмена
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}