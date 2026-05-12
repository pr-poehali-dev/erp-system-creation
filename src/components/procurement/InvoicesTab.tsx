import { useEffect, useState } from "react";
import { api, Invoice, Supplier, Material } from "@/lib/api";
import { Role } from "@/App";
import Icon from "@/components/ui/icon";
import InvoiceModal from "./InvoiceModal";
import {
  AI_ROLES, EXT_ICON, STATUS_CFG, fmtMoney, fmtDate,
  prepareFileForUpload, InvoiceForm, UploadedFile, EMPTY_FORM, AiRecognizeResult, AiItem,
} from "./invoices.shared";

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
  const [converting,  setConverting]  = useState(false);  // индикатор конвертации PDF/Excel
  const [error,       setError]       = useState("");
  const [recognizing, setRecognizing] = useState(false);
  const [applying,    setApplying]    = useState(false);
  const [aiResult,    setAiResult]    = useState<AiRecognizeResult | null>(null);
  const [aiError,     setAiError]     = useState("");

  const canUseAI      = !role || AI_ROLES.includes(role);
  const canSeeRawData = canUseAI;

  const load = () => {
    setLoading(true);
    Promise.all([api.invoices.list(), api.suppliers.list(), api.materials.list()])
      .then(([inv, sup, mat]) => { setInvoices(inv); setSuppliers(sup); setMaterials(mat); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

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

  // Сохранение: 1) создать/обновить счёт → 2) загрузить файл → 3) авто-распознать PDF/XLS
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
        if (autoRecognize) setConverting(true);
        const { b64, name } = await prepareFileForUpload(localFile);
        const uploaded = await api.invoices.uploadFile(invoiceId, b64, name);
        setUploadedFile({ url: uploaded.cdn_url, name: uploaded.file_name });
        setLocalFile(null);

        // Авто-запуск распознавания для PDF/Excel
        if (autoRecognize) {
          setConverting(false);
          setSaving(false);
          // Обновляем editItem чтобы handleRecognize знал ID
          setEditItem((prev) => ({ ...prev, id: invoiceId, recognition_status: "новый" } as Invoice));
          setRecognizing(true);
          setAiError("");
          try {
            const res = await api.invoices.recognize(invoiceId);
            setAiResult(res);
            load();
          } catch (err: unknown) {
            setAiError(err instanceof Error ? err.message : "Ошибка распознавания");
          } finally {
            setRecognizing(false);
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
      setConverting(false);
    }
  };

  // AI: только для редактируемого счёта с уже загруженным файлом на S3
  const handleRecognize = async () => {
    if (!editItem?.id) { setAiError("Сначала сохраните счёт"); return; }
    setRecognizing(true); setAiError(""); setAiResult(null);
    try {
      const res = await api.invoices.recognize(editItem.id);
      // Сохраняем весь ответ — supplier_id/material_id берём напрямую из него
      setAiResult(res);
      load(); // обновляем список — счёт уже обновлён в БД
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : "Ошибка AI-распознавания");
    } finally { setRecognizing(false); }
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
  const visible     = filterSt ? invoices.filter(i => i.recognition_status === filterSt) : invoices;
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
          converting={converting}
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
        />
      )}
    </div>
  );
}