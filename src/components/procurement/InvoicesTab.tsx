import { useEffect, useState } from "react";
import { api, Invoice, Supplier, Material } from "@/lib/api";
import { Role } from "@/App";
import Icon from "@/components/ui/icon";
import InvoiceModal from "./InvoiceModal";
import {
  AI_ROLES, EXT_ICON, STATUS_CFG, fmtMoney, fmtDate,
  prepareFileForUpload, InvoiceForm, UploadedFile, EMPTY_FORM, AiRecognizeResult, AiItem,
  recognizeViaPolza, fileToBase64,
} from "./invoices.shared";
import { usePagination } from "@/hooks/usePagination";

export default function InvoicesTab({ role }: { role?: Role }) {
  const [invoices,  setInvoices]  = useState<Invoice[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [filterSt,  setFilterSt]  = useState<Invoice["recognition_status"] | "">("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem,  setEditItem]  = useState<Invoice | null>(null);
  const [form,      setForm]      = useState<InvoiceForm>({ ...EMPTY_FORM });

  // Файл: localFile — выбран но не загружен; uploadedFile — уже на S3
  const [localFile,    setLocalFile]    = useState<File | null>(null);
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);

  const [saving,      setSaving]      = useState(false);
  // "idle" | "converting" | "recognizing" | "excel_chunking" | "polza_direct"
  const [procStage,   setProcStage]   = useState<"idle" | "converting" | "recognizing" | "excel_chunking" | "polza_direct">("idle");
  const [polzaStatus, setPolzaStatus] = useState("");   // текущий статус прямого вызова
  const [error,       setError]       = useState("");
  const [recognizing, setRecognizing] = useState(false);
  const [applying,    setApplying]    = useState(false);
  const [aiResult,    setAiResult]    = useState<AiRecognizeResult | null>(null);
  const [aiError,     setAiError]     = useState("");
  // Файл для повторного запроса через Polza (сохраняем b64 + имя)
  const [polzaFile,   setPolzaFile]   = useState<{ b64: string; name: string } | null>(null);

  const canUseAI      = !role || AI_ROLES.includes(role);
  const canSeeRawData = canUseAI;

  const load = () => {
    setLoading(true);
    Promise.all([api.invoices.list(), api.suppliers.list(), api.materials.list()])
      .then(([inv, sup, mat]) => { setInvoices(inv); setSuppliers(sup); setMaterials(mat); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  // ── Распознавание: Excel → DeepSeek, JPG/PDF → Gemini ────────────────────
  const runPolzaRecognize = async (b64: string, fileName: string) => {
    setPolzaFile({ b64, name: fileName });
    setRecognizing(true);
    setProcStage("polza_direct");
    setAiError("");
    setAiResult(null);

    const result = await recognizeViaPolza(b64, fileName, setPolzaStatus);

    if (!result.success || !result.items.length) {
      setAiError(result.error ?? "Пустой ответ от модели. Попробуйте снова.");
      setRecognizing(false);
      setProcStage("idle");
      return;
    }

    // Превращаем в AiRecognizeResult (упрощённый — без матчинга справочников)
    const obj = result.ai_obj;
    const items = (result.items as Record<string, unknown>[]).map((it) => ({
      supplier_id:      null,
      supplier_name:    (obj.supplier_name as string) ?? null,
      supplier_created: false,
      material:         (it.material as string) ?? null,
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

    const fakeResult: AiRecognizeResult = {
      status: items.some(i => !i.complete) ? "требуется_проверка" : "обработан",
      meta: {
        invoice_date:   (obj.invoice_date as string) ?? null,
        invoice_number: (obj.invoice_number as string) ?? null,
      },
      items,
      parse_error: null,
      footer_total: (obj.footer_total as number) ?? null,
      debug: { raw_response: result.raw, parse_error: null, items_debug: [] },
    };

    setAiResult(fakeResult);
    setRecognizing(false);
    setProcStage("idle");
    load();
  };

  const resetModal = () => {
    setForm({ ...EMPTY_FORM });
    setLocalFile(null);
    setUploadedFile(null);
    setError("");
    setAiResult(null);
    setAiError("");
  };

  const openCreate = () => { setEditItem(null); resetModal(); setModalOpen(true); };

  const openEdit = (inv: Invoice) => {
    setEditItem(inv);
    setForm({
      supplier_id:        inv.supplier_id ? String(inv.supplier_id) : "",
      material_id:        inv.material_id ? String(inv.material_id) : "",
      invoice_date:       inv.invoice_date    || "",
      invoice_number:     inv.invoice_number  || "",
      unit_price:         inv.unit_price  != null ? String(inv.unit_price)  : "",
      quantity:           inv.quantity    != null ? String(inv.quantity)    : "",
      recognition_status: inv.recognition_status,
      recognized_data:    inv.recognized_data || "",
    });
    setLocalFile(null);
    setUploadedFile(inv.pdf_file_url ? { url: inv.pdf_file_url, name: inv.pdf_file_name || "файл" } : null);
    setError(""); setAiResult(null); setAiError("");
    setModalOpen(true);
  };

  const closeModal = () => { setModalOpen(false); resetModal(); setEditItem(null); };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLocalFile(file);
    setUploadedFile(null);
    setAiResult(null);
    setAiError("");
  };

  // Определяем, нужна ли конвертация (PDF/XLS)
  const needsConversion = (f: File | null) => {
    if (!f) return false;
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
    return ["pdf", "xls", "xlsx"].includes(ext);
  };

  const removeFile = () => {
    setLocalFile(null);
    setUploadedFile(editItem?.pdf_file_url ? { url: editItem.pdf_file_url, name: editItem.pdf_file_name || "файл" } : null);
  };

  // Сохранение: 1) создать/обновить счёт → 2) конвертировать+загрузить файл → 3) авто-распознать
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const autoRecognize = localFile && needsConversion(localFile) && canUseAI;
    try {
      const body = {
        supplier_id:        form.supplier_id ? Number(form.supplier_id) : 0,
        material_id:        form.material_id ? Number(form.material_id) : 0,
        invoice_date:       form.invoice_date    || null,
        invoice_number:     form.invoice_number  || null,
        unit_price:         form.unit_price  ? Number(form.unit_price)  : null,
        quantity:           form.quantity    ? Number(form.quantity)    : null,
        recognition_status: form.recognition_status || "новый",
        recognized_data:    form.recognized_data || null,
      };

      let invoiceId: number;
      if (editItem) {
        await api.invoices.update(editItem.id, body);
        invoiceId = editItem.id;
      } else {
        const created = await api.invoices.create(body);
        invoiceId = created.id;
      }

      if (localFile) {
        const origName = localFile.name;
        const origExt  = origName.split(".").pop()?.toLowerCase() ?? "";
        const isExcel  = ["xls", "xlsx"].includes(origExt);

        // Excel → напрямую через Polza.ai (без Cloud Function, без таймаута)
        if (isExcel && autoRecognize) {
          setProcStage("converting");
          const rawB64 = await fileToBase64(localFile);
          const { b64: uploadB64, name: uploadName } = await prepareFileForUpload(localFile);
          const uploaded = await api.invoices.uploadFile(invoiceId, uploadB64, uploadName);
          setUploadedFile({ url: uploaded.cdn_url, name: uploaded.file_name });
          setLocalFile(null);
          setSaving(false);
          setEditItem((prev) => ({ ...prev, id: invoiceId, recognition_status: "новый" } as Invoice));
          await runPolzaRecognize(rawB64, origName);
          return;
        }

        // JPG/PNG/PDF → загружаем и распознаём через бэкенд
        const { b64, name } = await prepareFileForUpload(localFile, (stage) => {
          setProcStage(stage === "converting" ? "converting" : "idle");
        });
        setProcStage("idle");
        const uploaded = await api.invoices.uploadFile(invoiceId, b64, name);
        setUploadedFile({ url: uploaded.cdn_url, name: uploaded.file_name });
        setLocalFile(null);

        if (autoRecognize) {
          setSaving(false);
          setEditItem((prev) => ({ ...prev, id: invoiceId, recognition_status: "новый" } as Invoice));
          setRecognizing(true);
          setProcStage("recognizing");
          setAiError("");
          try {
            const res = await api.invoices.recognize(invoiceId);
            setAiResult(res);
            load();
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Ошибка распознавания";
            // QR-код → предлагаем Polza-метод
            if (msg.startsWith("qr_detected|")) {
              setAiError(msg.replace("qr_detected|", ""));
            } else {
              setAiError(msg);
            }
          } finally {
            setRecognizing(false);
            setProcStage("idle");
          }
          return;
        }
      }

      closeModal();
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
      setProcStage("idle");
    }
  };

  // AI: только для редактируемого счёта с уже загруженным файлом на S3
  const handleRecognize = async () => {
    if (!editItem?.id) { setAiError("Сначала сохраните счёт"); return; }
    const fileName = editItem.pdf_file_name || "";
    const isExcel  = /\.(xls|xlsx)$/i.test(fileName);

    // Excel — скачиваем файл из S3 и распознаём через Polza напрямую
    if (isExcel && uploadedFile?.url) {
      try {
        const resp = await fetch(uploadedFile.url);
        const blob = await resp.blob();
        const b64  = await new Promise<string>((res, rej) => {
          const fr = new FileReader();
          fr.onload  = () => res((fr.result as string).split(",")[1]);
          fr.onerror = rej;
          fr.readAsDataURL(blob);
        });
        await runPolzaRecognize(b64, fileName);
      } catch (e) {
        setAiError(e instanceof Error ? e.message : "Ошибка загрузки файла");
      }
      return;
    }

    // JPG/PDF → бэкенд
    setRecognizing(true); setAiError(""); setAiResult(null);
    setProcStage("recognizing");
    try {
      const res = await api.invoices.recognize(editItem.id);
      setAiResult(res);
      load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Ошибка AI-распознавания";
      setAiError(msg.startsWith("qr_detected|") ? msg.replace("qr_detected|", "") : msg);
    } finally { setRecognizing(false); setProcStage("idle"); }
  };

  const handleApplyAI = async (selectedItems: AiItem[], invoiceDate: string, invoiceNumber: string) => {
    if (!editItem) return;
    setApplying(true);
    setAiError("");
    try {
      await api.invoices.applyItems({
        invoice_id:    editItem.id,
        items:         selectedItems,
        invoice_date:  invoiceDate  || null,
        invoice_number: invoiceNumber || null,
        file_url:  uploadedFile?.url  || null,
        file_name: uploadedFile?.name || null,
      });
      setAiResult(null);
      closeModal();
      load();
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : "Ошибка создания счетов");
    } finally {
      setApplying(false);
    }
  };

  const totalSum    = invoices.reduce((s, i) => s + (i.total_amount || 0), 0);
  const filtered    = filterSt ? invoices.filter(i => i.recognition_status === filterSt) : invoices;
  const { pageItems: visible, Pager } = usePagination(filtered);
  const canRecognize = canUseAI && !!editItem && !!uploadedFile?.url;

  return (
    <div className="space-y-4">
      {/* Тулбар */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <select value={filterSt} onChange={e => setFilterSt(e.target.value as Invoice["recognition_status"] | "")}
            className="border border-border rounded-lg px-3 py-1.5 text-[13px] bg-white outline-none focus:ring-1 focus:ring-primary">
            <option value="">Все статусы</option>
            {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <div className="text-[13px] text-muted-foreground">
            Итого: <span className="font-semibold text-foreground">{fmtMoney(totalSum)}</span>
          </div>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors">
          <Icon name="Plus" size={14} />
          Добавить счёт
        </button>
      </div>

      {/* Таблица */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="divide-y divide-border">
            {[1, 2, 3].map(i => <div key={i} className="h-12 animate-pulse bg-secondary/30" />)}
          </div>
        ) : visible.length === 0 ? (
          <div className="py-12 text-center text-hint">
            <Icon name="FileText" size={28} className="mx-auto mb-2 opacity-40" />
            <div className="text-[13px]">Счетов пока нет</div>
          </div>
        ) : (
          <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-secondary/50 text-left text-[11px] uppercase text-hint">
                  {["№ счёта","Поставщик","Материал","Дата","Цена","Кол-во","Сумма","Файл","Статус",""].map(h => (
                    <th key={h} className="px-4 py-2.5 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visible.map(inv => {
                  const st      = STATUS_CFG[inv.recognition_status];
                  const fileExt = (inv.pdf_file_name || "").split(".").pop()?.toLowerCase() || "";
                  const fileIco = EXT_ICON[fileExt] || "File";
                  return (
                    <tr key={inv.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="px-4 py-3 text-[13px] font-medium">{inv.invoice_number || "—"}</td>
                      <td className="px-4 py-3 text-[13px]">
                        {inv.supplier_name || <span className="text-hint italic text-[12px]">не указан</span>}
                      </td>
                      <td className="px-4 py-3 text-[13px]">
                        {inv.material_name
                          ? <>{inv.material_name} <span className="text-hint">({inv.unit})</span></>
                          : <span className="text-hint italic text-[12px]">не указан</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-[12px] text-muted-foreground whitespace-nowrap">{fmtDate(inv.invoice_date)}</td>
                      <td className="px-4 py-3 text-[13px] text-right">{fmtMoney(inv.unit_price)}</td>
                      <td className="px-4 py-3 text-[13px] text-right">{inv.quantity ?? "—"}</td>
                      <td className="px-4 py-3 text-[13px] font-semibold text-right whitespace-nowrap">{fmtMoney(inv.total_amount)}</td>
                      <td className="px-4 py-3">
                        {inv.pdf_file_url
                          ? <a href={inv.pdf_file_url} target="_blank" rel="noreferrer"
                              className="flex items-center gap-1 text-[11px] text-primary hover:underline whitespace-nowrap">
                              <Icon name={fileIco} size={12} />
                              {(inv.pdf_file_name || "файл").slice(0, 14)}
                            </a>
                          : <span className="text-hint text-[11px]">—</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 w-fit ${st.cls}`}>
                          <Icon name={st.icon} size={10} />
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => openEdit(inv)}
                          className="text-[12px] px-2 py-1 border border-border rounded hover:bg-secondary transition-colors">
                          <Icon name="Pencil" size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {Pager}
          </>
        )}
      </div>

      {/* Модалка */}
      {modalOpen && (
        <InvoiceModal
          editItem={editItem}
          form={form}
          setForm={setForm}
          localFile={localFile}
          uploadedFile={uploadedFile}
          saving={saving}
          procStage={procStage}
          polzaStatus={polzaStatus}
          autoRecognize={!!(localFile && needsConversion(localFile) && canUseAI)}
          error={error}
          recognizing={recognizing}
          applying={applying}
          aiResult={aiResult}
          aiError={aiError}
          canRecognize={canRecognize}
          canSeeRawData={canSeeRawData}
          suppliers={suppliers}
          materials={materials}
          onClose={closeModal}
          onSave={handleSave}
          onFileSelect={handleFileSelect}
          onRemoveFile={removeFile}
          onRecognize={handleRecognize}
          onApplyAI={handleApplyAI}
          onDismissAI={() => setAiResult(null)}
          onRetryPolza={polzaFile ? () => runPolzaRecognize(polzaFile.b64, polzaFile.name) : undefined}
        />
      )}
    </div>
  );
}