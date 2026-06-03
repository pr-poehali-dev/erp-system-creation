import { useEffect, useState } from "react";
import { api, Invoice, Supplier, Material, MaterialCategory } from "@/lib/api";
import { Role } from "@/App";
import InvoiceModal from "./InvoiceModal";
import BulkUploadModal from "./BulkUploadModal";
import InvoicesToolbar from "./InvoicesToolbar";
import InvoicesCategoryFilter, { CatFilter } from "./InvoicesCategoryFilter";
import InvoicesTable from "./InvoicesTable";
import {
  AI_ROLES,
  prepareFileForUpload, InvoiceForm, UploadedFile, EMPTY_FORM, AiRecognizeResult, AiItem,
  recognizeViaPolza, fileToBase64,
} from "./invoices.shared";
import { usePagination } from "@/hooks/usePagination";

export default function InvoicesTab({ role }: { role?: Role }) {
  const [invoices,  setInvoices]  = useState<Invoice[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [categories, setCategories] = useState<MaterialCategory[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [filterSt,  setFilterSt]  = useState<Invoice["recognition_status"] | "">("");
  // Фильтр по категории: id категории, либо спец-фильтр 'none'/'other'
  const [catFilter, setCatFilter] = useState<CatFilter>({ kind: "all", id: null });

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

  const [bulkOpen, setBulkOpen] = useState(false);

  const canUseAI      = !role || AI_ROLES.includes(role);
  const canSeeRawData = canUseAI;

  // Параметры запроса счетов в зависимости от фильтра категории
  const invoiceListOpts = () => {
    if (catFilter.kind === "id" && catFilter.id) return { category_id: catFilter.id };
    if (catFilter.kind === "none") return { category_filter: "none" as const };
    if (catFilter.kind === "other") return { category_filter: "other" as const };
    return undefined;
  };

  // Перезагрузка только списка счетов (без сброса справочников и состояния модалок)
  const reloadInvoices = () => {
    setLoading(true);
    api.invoices.list(invoiceListOpts())
      .then(setInvoices)
      .finally(() => setLoading(false));
  };

  const load = () => {
    setLoading(true);
    Promise.all([api.invoices.list(invoiceListOpts()), api.suppliers.list(), api.materials.list(), api.material_categories.list()])
      .then(([inv, sup, mat, cats]) => { setInvoices(inv); setSuppliers(sup); setMaterials(mat); setCategories(cats); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);
  // При смене фильтра категории — перезагружаем только счета (страница не перезагружается)
  useEffect(() => { reloadInvoices();   }, [catFilter]);

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
      material:         it.material != null ? String(it.material).trim() || null : null,
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

        // JPG/PNG/PDF → загружаем на S3, затем распознаём на фронте (без бэкенд Gemini)
        const rawB64 = await fileToBase64(localFile); // читаем до setLocalFile(null)
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
          // PDF → pdfjs→текст→DeepSeek, JPG/PNG → Gemini (всё через фронт, без бэкенд)
          await runPolzaRecognize(rawB64, origName);
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
      // Гарантируем что material не пустой — бэкенд использует его для матчинга и material_name_raw
      const safeItems = selectedItems.map(it => ({
        ...it,
        material: it.material?.trim() || "Не указан",
      }));
      await api.invoices.applyItems({
        invoice_id:    editItem.id,
        items:         safeItems,
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
      <InvoicesToolbar
        filterSt={filterSt}
        setFilterSt={setFilterSt}
        totalSum={totalSum}
        canUseAI={canUseAI}
        onBulkOpen={() => setBulkOpen(true)}
        onCreate={openCreate}
      />

      {/* Фильтр по категории материала (иерархический) + быстрые фильтры */}
      <InvoicesCategoryFilter
        categories={categories}
        catFilter={catFilter}
        setCatFilter={setCatFilter}
      />

      {/* Таблица */}
      <InvoicesTable
        loading={loading}
        visible={visible}
        categories={categories}
        Pager={Pager}
        onEdit={openEdit}
      />

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

      {/* Массовая загрузка */}
      {bulkOpen && (
        <BulkUploadModal
          onClose={() => setBulkOpen(false)}
          onDone={load}
        />
      )}
    </div>
  );
}
