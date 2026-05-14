import { useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import { api } from "@/lib/api";
import {
  recognizeViaPolza, fileToBase64, prepareFileForUpload,
  ACCEPT_TYPES, EXT_ICON, AiItem,
} from "./invoices.shared";

const MAX_FILES      = 20;
const MAX_TOTAL_MB   = 50;
const WARN_FILE_MB   = 5;

type FileStatus = "pending" | "uploading" | "recognizing" | "applying" | "done" | "error";

interface FileEntry {
  id:       string;
  file:     File;
  status:   FileStatus;
  progress: string;
  error:    string;
  count:    number;
}

interface Props {
  onClose:  () => void;
  onDone:   () => void;
}

function fmt(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

function makeId() { return Math.random().toString(36).slice(2); }

export default function BulkUploadModal({ onClose, onDone }: Props) {
  const inputRef           = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [running,  setRunning]  = useState(false);
  const [done,     setDone]     = useState(false);
  const [sizeWarn, setSizeWarn] = useState("");

  const upd = (id: string, patch: Partial<FileEntry>) =>
    setEntries(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e));

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    setSizeWarn("");

    const arr = Array.from(files).slice(0, MAX_FILES);

    const totalMB = arr.reduce((s, f) => s + f.size, 0) / 1024 / 1024;
    if (totalMB > MAX_TOTAL_MB) {
      setSizeWarn(`Суммарный размер ${totalMB.toFixed(1)} МБ превышает лимит ${MAX_TOTAL_MB} МБ.`);
      return;
    }

    const warned = arr.filter(f => f.size > WARN_FILE_MB * 1024 * 1024).map(f => f.name);

    const newEntries: FileEntry[] = arr.map(file => ({
      id:       makeId(),
      file,
      status:   "pending",
      progress: "",
      error:    "",
      count:    0,
    }));

    setEntries(newEntries);
    setDone(false);

    if (warned.length) {
      setSizeWarn(`Файлы больше ${WARN_FILE_MB} МБ: ${warned.join(", ")}. Обработка может занять больше времени.`);
    }
  };

  const processOne = async (entry: FileEntry): Promise<{ ok: boolean; count: number; error: string }> => {
    const { id, file } = entry;
    const origName = file.name;

    try {
      // 1. Создать счёт-черновик
      upd(id, { status: "uploading", progress: "Создаём счёт..." });
      const created = await api.invoices.create({ recognition_status: "новый" });
      const invoiceId: number = created.id;

      // 2. Загрузить файл на S3
      upd(id, { progress: "Загружаем файл..." });
      const rawB64 = await fileToBase64(file);
      const { b64: uploadB64, name: uploadName } = await prepareFileForUpload(file);
      const uploaded = await api.invoices.uploadFile(invoiceId, uploadB64, uploadName);

      // 3. Распознать
      upd(id, { status: "recognizing", progress: "Распознаём..." });
      const result = await recognizeViaPolza(rawB64, origName, (msg) => {
        upd(id, { progress: msg });
      });

      if (!result.success || !result.items.length) {
        return { ok: false, count: 0, error: result.error ?? "Не удалось распознать" };
      }

      // 4. Применить позиции
      upd(id, { status: "applying", progress: "Сохраняем позиции..." });
      const obj = result.ai_obj;
      const items = (result.items as Record<string, unknown>[]).map(it => ({
        supplier_id:      null,
        supplier_name:    (obj.supplier_name as string) ?? null,
        supplier_created: false,
        material:         it.material != null ? String(it.material).trim() || "Не указан" : "Не указан",
        material_id:      null,
        material_created: false,
        unit:             (it.unit as string) ?? "шт",
        unit_price:       (it.unit_price as number) ?? null,
        quantity:         (it.quantity as number) ?? null,
        invoice_date:     (obj.invoice_date as string) ?? null,
        invoice_number:   (obj.invoice_number as string) ?? null,
        complete:         !!(it.unit_price && it.quantity),
        quality:          (it.unit_price && it.quantity) ? "ok" : "bad",
      })) as AiItem[];

      await api.invoices.applyItems({
        invoice_id:     invoiceId,
        items,
        invoice_date:   (obj.invoice_date as string) ?? null,
        invoice_number: (obj.invoice_number as string) ?? null,
        file_url:       uploaded.cdn_url,
        file_name:      uploaded.file_name,
      });

      return { ok: true, count: items.length, error: "" };

    } catch (e: unknown) {
      return { ok: false, count: 0, error: e instanceof Error ? e.message : "Неизвестная ошибка" };
    }
  };

  const startProcessing = async () => {
    if (!entries.length || running) return;
    setRunning(true);
    setDone(false);

    for (const entry of entries) {
      if (entry.status === "done") continue;
      const { ok, count, error } = await processOne(entry);
      if (ok) {
        upd(entry.id, { status: "done", progress: "", count, error: "" });
      } else {
        upd(entry.id, { status: "error", progress: "", error });
      }
    }

    setRunning(false);
    setDone(true);
    onDone();
  };

  const retryOne = async (entry: FileEntry) => {
    upd(entry.id, { status: "pending", progress: "", error: "" });
    const { ok, count, error } = await processOne(entry);
    if (ok) {
      upd(entry.id, { status: "done", progress: "", count, error: "" });
    } else {
      upd(entry.id, { status: "error", progress: "", error });
    }
    onDone();
  };

  const successCount = entries.filter(e => e.status === "done").length;
  const errorCount   = entries.filter(e => e.status === "error").length;
  const totalItems   = entries.filter(e => e.status === "done").reduce((s, e) => s + e.count, 0);
  const processed    = entries.filter(e => e.status === "done" || e.status === "error").length;

  const statusIcon: Record<FileStatus, { icon: string; cls: string }> = {
    pending:    { icon: "Clock",       cls: "text-muted-foreground" },
    uploading:  { icon: "Upload",      cls: "text-blue-500 animate-pulse" },
    recognizing:{ icon: "Sparkles",    cls: "text-purple-500 animate-pulse" },
    applying:   { icon: "Save",        cls: "text-amber-500 animate-pulse" },
    done:       { icon: "CheckCircle", cls: "text-emerald-500" },
    error:      { icon: "XCircle",     cls: "text-red-500" },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">

        {/* Шапка */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Icon name="Files" size={18} className="text-primary" />
            <span className="font-semibold text-[15px]">Массовая загрузка счетов</span>
          </div>
          <button onClick={onClose} className="text-hint hover:text-foreground transition-colors">
            <Icon name="X" size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

          {/* Зона выбора файлов */}
          {!running && !done && (
            <div
              className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
              onClick={() => inputRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
            >
              <Icon name="UploadCloud" size={32} className="mx-auto mb-2 text-muted-foreground" />
              <div className="text-[13px] font-medium mb-1">Перетащите файлы или нажмите для выбора</div>
              <div className="text-[12px] text-hint">JPG, PNG, PDF, Excel · до {MAX_FILES} файлов · не более {MAX_TOTAL_MB} МБ суммарно</div>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept={ACCEPT_TYPES}
                className="hidden"
                onChange={e => handleFiles(e.target.files)}
              />
            </div>
          )}

          {/* Предупреждение по размеру */}
          {sizeWarn && (
            <div className="flex items-start gap-2 text-[12px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <Icon name="AlertTriangle" size={14} className="mt-0.5 shrink-0" />
              {sizeWarn}
            </div>
          )}

          {/* Список файлов */}
          {entries.length > 0 && (
            <div className="space-y-1.5">
              {running && (
                <div className="text-[12px] text-muted-foreground mb-2">
                  Обработано {processed} из {entries.length}
                  {running && processed < entries.length && " — идёт обработка..."}
                </div>
              )}
              {entries.map(entry => {
                const ext = entry.file.name.split(".").pop()?.toLowerCase() ?? "";
                const ico = EXT_ICON[ext] ?? "File";
                const st  = statusIcon[entry.status];
                const isLarge = entry.file.size > WARN_FILE_MB * 1024 * 1024;
                return (
                  <div key={entry.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
                    <Icon name={ico} size={16} className="text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[13px] font-medium truncate">{entry.file.name}</span>
                        {isLarge && (
                          <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded shrink-0">
                            {fmt(entry.file.size)}
                          </span>
                        )}
                        {!isLarge && (
                          <span className="text-[11px] text-hint shrink-0">{fmt(entry.file.size)}</span>
                        )}
                      </div>
                      {entry.progress && (
                        <div className="text-[11px] text-primary mt-0.5">{entry.progress}</div>
                      )}
                      {entry.status === "done" && (
                        <div className="text-[11px] text-emerald-600 mt-0.5">
                          {entry.count} {entry.count === 1 ? "позиция" : entry.count < 5 ? "позиции" : "позиций"} добавлено
                        </div>
                      )}
                      {entry.status === "error" && (
                        <div className="text-[11px] text-red-600 mt-0.5 truncate" title={entry.error}>{entry.error}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Icon name={st.icon} size={16} className={st.cls} />
                      {entry.status === "error" && !running && (
                        <button
                          onClick={() => retryOne(entry)}
                          className="text-[11px] px-2 py-0.5 border border-border rounded hover:bg-secondary transition-colors"
                          title="Повторить"
                        >
                          <Icon name="RotateCcw" size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Итог */}
          {done && (
            <div className={`rounded-xl px-4 py-3 text-[13px] font-medium ${errorCount === 0 ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-800 border border-amber-200"}`}>
              <div className="flex items-center gap-2 mb-1">
                <Icon name={errorCount === 0 ? "CheckCircle" : "AlertTriangle"} size={16} />
                Обработка завершена
              </div>
              <div className="text-[12px] font-normal">
                Успешно: <strong>{successCount}</strong> файлов, добавлено <strong>{totalItems}</strong> позиций.
                {errorCount > 0 && <> Ошибок: <strong className="text-red-600">{errorCount}</strong>.</>}
              </div>
            </div>
          )}
        </div>

        {/* Подвал */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between gap-3 shrink-0">
          <div className="text-[12px] text-hint">
            {entries.length > 0 && !running && !done && `Выбрано: ${entries.length} файлов`}
            {entries.length === MAX_FILES && <> · <span className="text-amber-600">достигнут лимит {MAX_FILES}</span></>}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-[13px] border border-border rounded-lg hover:bg-secondary transition-colors"
            >
              {done ? "Закрыть" : "Отмена"}
            </button>
            {!done && (
              <button
                onClick={startProcessing}
                disabled={running || entries.length === 0}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {running ? (
                  <>
                    <Icon name="Loader" size={14} className="animate-spin" />
                    Обрабатывается...
                  </>
                ) : (
                  <>
                    <Icon name="Zap" size={14} />
                    Распознать {entries.length > 0 ? `(${entries.length})` : ""}
                  </>
                )}
              </button>
            )}
            {done && entries.some(e => e.status === "error") && (
              <button
                onClick={() => {
                  entries.filter(e => e.status === "error").forEach(e =>
                    upd(e.id, { status: "pending", progress: "", error: "" })
                  );
                  startProcessing();
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white rounded-lg text-[13px] font-medium hover:bg-amber-600 transition-colors"
              >
                <Icon name="RotateCcw" size={14} />
                Повторить ошибки
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
