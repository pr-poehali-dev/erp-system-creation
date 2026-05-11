import { useEffect, useRef, useState } from "react";
import { api, Invoice, Supplier, Material } from "@/lib/api";
import { Role } from "@/App";
import Icon from "@/components/ui/icon";

// Роли с доступом к AI-функциям
const AI_ROLES: Role[] = ["director", "supply_director", "supplier"];

const ACCEPT_TYPES = ".pdf,.jpg,.jpeg,.png,.xls,.xlsx,.docx";
const ACCEPT_HINT  = "PDF, JPG/PNG, Excel, Word";

const EXT_ICON: Record<string, string> = {
  pdf: "FileText", jpg: "Image", jpeg: "Image", png: "Image",
  xls: "Sheet", xlsx: "Sheet", docx: "FileType",
};

const STATUS_CFG = {
  новый:              { label: "Новый",            cls: "bg-amber-100 text-amber-700",   icon: "Clock" },
  обработан:          { label: "Обработан",        cls: "bg-emerald-100 text-emerald-700", icon: "CheckCircle" },
  требуется_проверка: { label: "Требует проверки", cls: "bg-red-100 text-red-700",       icon: "AlertCircle" },
};

const fmtMoney = (n: number | null) =>
  n == null ? "—" : new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(n) + " ₽";
const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("ru-RU") : "—";

// Конвертируем File в base64
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const EMPTY_FORM = {
  supplier_id: "", material_id: "", invoice_date: "", invoice_number: "",
  unit_price: "", quantity: "",
  recognition_status: "новый" as Invoice["recognition_status"],
  recognized_data: "",
};

// ── Панель AI-результата ─────────────────────────────────────────────────────
interface AiResultPanelProps {
  result: Record<string, unknown>;
  suppliers: Supplier[];
  materials: Material[];
  onApply: (data: ApplyData) => void;
  onDismiss: () => void;
}

interface ApplyData {
  supplier_id: string;
  material_id: string;
  unit_price: string;
  quantity: string;
  invoice_date: string;
  invoice_number: string;
  recognized_data: string;
  recognition_status: Invoice["recognition_status"];
}

function AiResultPanel({ result, suppliers, materials, onApply, onDismiss }: AiResultPanelProps) {
  const fields = [
    { key: "supplier_name", label: "Поставщик" },
    { key: "material",      label: "Материал" },
    { key: "unit",          label: "Единица" },
    { key: "unit_price",    label: "Цена за ед." },
    { key: "quantity",      label: "Количество" },
    { key: "invoice_date",  label: "Дата счёта" },
    { key: "invoice_number",label: "Номер счёта" },
  ];

  const handleApply = () => {
    const supplierName = String(result.supplier_name || "").trim().toLowerCase();
    const matchedSupplier = suppliers.find(s => s.name.toLowerCase() === supplierName);
    const materialName = String(result.material || "").trim().toLowerCase();
    const matchedMaterial = materials.find(m => m.name.toLowerCase() === materialName);

    onApply({
      supplier_id: matchedSupplier ? String(matchedSupplier.id) : "",
      material_id: matchedMaterial ? String(matchedMaterial.id) : "",
      unit_price: result.unit_price != null ? String(result.unit_price) : "",
      quantity: result.quantity != null ? String(result.quantity) : "",
      invoice_date: result.invoice_date ? String(result.invoice_date) : "",
      invoice_number: result.invoice_number ? String(result.invoice_number) : "",
      recognized_data: JSON.stringify(result, null, 2),
      recognition_status: Object.values(result).filter(v => v !== null && v !== "").length >= 4
        ? "обработан" : "требуется_проверка",
    });
  };

  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-emerald-800 font-semibold text-[13px]">
          <Icon name="Sparkles" size={15} />
          ИИ распознал следующие данные:
        </div>
        <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground">
          <Icon name="X" size={15} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
        {fields.map(f => (
          <div key={f.key} className="flex items-start gap-2 text-[12px]">
            <span className="text-hint w-24 shrink-0">{f.label}:</span>
            <span className={`font-medium ${result[f.key] == null ? "text-muted-foreground italic" : "text-foreground"}`}>
              {result[f.key] != null ? String(result[f.key]) : "не найдено"}
            </span>
          </div>
        ))}
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={handleApply}
          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-[13px] font-medium hover:bg-emerald-700 transition-colors">
          <Icon name="Check" size={13} />
          Применить данные
        </button>
        <button onClick={onDismiss}
          className="px-4 py-2 border border-border rounded-lg text-[13px] text-muted-foreground hover:bg-secondary transition-colors">
          Игнорировать
        </button>
      </div>
    </div>
  );
}

// ── Основной компонент ────────────────────────────────────────────────────────
interface Props { role?: Role; }

export default function InvoicesTab({ role }: Props) {
  const [invoices,  setInvoices]  = useState<Invoice[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem,  setEditItem]  = useState<Invoice | null>(null);
  const [form,      setForm]      = useState({ ...EMPTY_FORM });
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState("");
  const [filterSt,  setFilterSt]  = useState<Invoice["recognition_status"] | "">("");

  // Загрузка файла
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading,   setUploading]   = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ url: string; name: string } | null>(null);
  const [pendingInvoiceId, setPendingInvoiceId] = useState<number | null>(null);

  // AI
  const [recognizing, setRecognizing] = useState(false);
  const [aiResult,    setAiResult]    = useState<Record<string, unknown> | null>(null);
  const [aiError,     setAiError]     = useState("");

  const canUseAI = !role || AI_ROLES.includes(role);
  const canSeeRawData = canUseAI;

  const load = () => {
    setLoading(true);
    Promise.all([api.invoices.list(), api.suppliers.list(), api.materials.list()])
      .then(([inv, sup, mat]) => { setInvoices(inv); setSuppliers(sup); setMaterials(mat); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditItem(null);
    setForm({ ...EMPTY_FORM });
    setUploadedFile(null);
    setPendingInvoiceId(null);
    setAiResult(null);
    setAiError("");
    setError("");
    setModalOpen(true);
  };

  const openEdit = (inv: Invoice) => {
    setEditItem(inv);
    setForm({
      supplier_id: String(inv.supplier_id), material_id: String(inv.material_id),
      invoice_date: inv.invoice_date || "", invoice_number: inv.invoice_number || "",
      unit_price: inv.unit_price != null ? String(inv.unit_price) : "",
      quantity: inv.quantity != null ? String(inv.quantity) : "",
      recognition_status: inv.recognition_status,
      recognized_data: inv.recognized_data || "",
    });
    setUploadedFile(inv.pdf_file_url ? { url: inv.pdf_file_url, name: inv.pdf_file_name || "файл" } : null);
    setPendingInvoiceId(inv.id);
    setAiResult(null);
    setAiError("");
    setError("");
    setModalOpen(true);
  };

  // Создаём/обновляем счёт
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.supplier_id || !form.material_id) { setError("Поставщик и материал обязательны"); return; }
    setSaving(true); setError("");
    try {
      const body = {
        supplier_id: Number(form.supplier_id), material_id: Number(form.material_id),
        invoice_date: form.invoice_date || null, invoice_number: form.invoice_number || null,
        unit_price: form.unit_price ? Number(form.unit_price) : null,
        quantity: form.quantity ? Number(form.quantity) : null,
        recognition_status: form.recognition_status,
        recognized_data: form.recognized_data || null,
      };
      let invoiceId: number;
      if (editItem) {
        await api.invoices.update(editItem.id, body);
        invoiceId = editItem.id;
      } else {
        const created = await api.invoices.create(body);
        invoiceId = created.id;
        setPendingInvoiceId(invoiceId);
      }
      // Загружаем файл если выбран но ещё не загружен
      if (fileRef.current?.files?.[0] && invoiceId) {
        const file = fileRef.current.files[0];
        const b64 = await fileToBase64(file);
        const res = await api.invoices.uploadFile(invoiceId, b64, file.name);
        setUploadedFile({ url: res.cdn_url, name: res.file_name });
      }
      setModalOpen(false);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally { setSaving(false); }
  };

  // Загрузка файла к уже существующему счёту
  const handleFileUploadToExisting = async (invoiceId: number, file: File) => {
    setUploading(true);
    try {
      const b64 = await fileToBase64(file);
      const res = await api.invoices.uploadFile(invoiceId, b64, file.name);
      setUploadedFile({ url: res.cdn_url, name: res.file_name });
      load();
    } finally { setUploading(false); }
  };

  // AI-распознавание
  const handleRecognize = async () => {
    const invoiceId = pendingInvoiceId || editItem?.id;
    if (!invoiceId) { setAiError("Сначала сохраните счёт и загрузите файл"); return; }
    setRecognizing(true); setAiError(""); setAiResult(null);
    try {
      const res = await api.invoices.recognize(invoiceId);
      setAiResult(res.parsed);
      // Обновляем список — статус мог измениться
      load();
    } catch (e: unknown) {
      setAiError(e instanceof Error ? e.message : "Ошибка AI-распознавания");
    } finally { setRecognizing(false); }
  };

  // Применить распознанные данные в форму
  const handleApplyAI = (data: ApplyData) => {
    setForm(prev => ({
      ...prev,
      supplier_id:        data.supplier_id    || prev.supplier_id,
      material_id:        data.material_id    || prev.material_id,
      unit_price:         data.unit_price     || prev.unit_price,
      quantity:           data.quantity       || prev.quantity,
      invoice_date:       data.invoice_date   || prev.invoice_date,
      invoice_number:     data.invoice_number || prev.invoice_number,
      recognized_data:    data.recognized_data,
      recognition_status: data.recognition_status,
    }));
    setAiResult(null);
  };

  const totalSum = invoices.reduce((s, i) => s + (i.total_amount || 0), 0);
  const visible  = filterSt ? invoices.filter(i => i.recognition_status === filterSt) : invoices;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <select value={filterSt} onChange={e => setFilterSt(e.target.value as Invoice["recognition_status"] | "")}
            className="border border-border rounded-lg px-3 py-1.5 text-[13px] bg-white outline-none focus:ring-1 focus:ring-primary">
            <option value="">Все статусы</option>
            {Object.entries(STATUS_CFG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
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
            {[1,2,3].map(i => <div key={i} className="h-12 animate-pulse bg-secondary/30" />)}
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
                  const st = STATUS_CFG[inv.recognition_status];
                  const fileExt = (inv.pdf_file_name || "").split(".").pop()?.toLowerCase() || "";
                  const fileIcon = EXT_ICON[fileExt] || "File";
                  return (
                    <tr key={inv.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="px-4 py-3 text-[13px] font-medium">{inv.invoice_number || "—"}</td>
                      <td className="px-4 py-3 text-[13px]">{inv.supplier_name}</td>
                      <td className="px-4 py-3 text-[13px]">{inv.material_name} <span className="text-hint">({inv.unit})</span></td>
                      <td className="px-4 py-3 text-[12px] text-muted-foreground whitespace-nowrap">{fmtDate(inv.invoice_date)}</td>
                      <td className="px-4 py-3 text-[13px] text-right">{fmtMoney(inv.unit_price)}</td>
                      <td className="px-4 py-3 text-[13px] text-right">{inv.quantity ?? "—"}</td>
                      <td className="px-4 py-3 text-[13px] font-semibold text-right whitespace-nowrap">{fmtMoney(inv.total_amount)}</td>
                      <td className="px-4 py-3">
                        {inv.pdf_file_url
                          ? <a href={inv.pdf_file_url} target="_blank" rel="noreferrer"
                              className="flex items-center gap-1 text-[11px] text-primary hover:underline">
                              <Icon name={fileIcon} size={12} />
                              {inv.pdf_file_name?.split("/").pop()?.slice(0, 16) || "файл"}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl border border-border shadow-xl w-full max-w-lg max-h-[92vh] overflow-y-auto animate-fade-in">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="font-semibold text-[15px]">{editItem ? "Редактировать счёт" : "Новый счёт"}</h2>
              <button onClick={() => setModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <Icon name="X" size={18} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">

              {/* ── Загрузка файла ── */}
              <div>
                <label className="block text-[13px] font-medium mb-1">
                  Файл документа
                  <span className="ml-1.5 text-[11px] text-hint font-normal">({ACCEPT_HINT})</span>
                </label>

                {uploadedFile ? (
                  <div className="flex items-center gap-2 px-3 py-2.5 border border-emerald-200 bg-emerald-50 rounded-lg">
                    <Icon name="FileCheck" size={16} className="text-emerald-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-emerald-800 truncate">{uploadedFile.name}</div>
                      <a href={uploadedFile.url} target="_blank" rel="noreferrer"
                        className="text-[11px] text-emerald-600 hover:underline">открыть файл</a>
                    </div>
                    <button onClick={() => { setUploadedFile(null); if (fileRef.current) fileRef.current.value = ""; }}
                      className="text-muted-foreground hover:text-red-500 transition-colors shrink-0">
                      <Icon name="X" size={14} />
                    </button>
                  </div>
                ) : (
                  <label className={`flex items-center gap-2 px-3 py-2.5 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                    uploading ? "border-primary/40 bg-primary/5" : "border-border hover:border-primary/40 hover:bg-secondary/50"
                  }`}>
                    <input ref={fileRef} type="file" accept={ACCEPT_TYPES} className="hidden"
                      onChange={async e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        // Если счёт уже создан — загружаем сразу
                        if (pendingInvoiceId) {
                          await handleFileUploadToExisting(pendingInvoiceId, file);
                        }
                        // Иначе файл сохранится при handleSave
                      }} />
                    {uploading
                      ? <><Icon name="Loader" size={16} className="animate-spin text-primary" /><span className="text-[13px] text-primary">Загружаем...</span></>
                      : <><Icon name="Upload" size={16} className="text-muted-foreground" /><span className="text-[13px] text-muted-foreground">Выбрать файл ({ACCEPT_HINT})</span></>
                    }
                  </label>
                )}
              </div>

              {/* ── AI-блок ── */}
              {canUseAI && (uploadedFile || (pendingInvoiceId && editItem?.pdf_file_url)) && (
                <div className="space-y-2">
                  {aiResult ? (
                    <AiResultPanel
                      result={aiResult}
                      suppliers={suppliers}
                      materials={materials}
                      onApply={handleApplyAI}
                      onDismiss={() => setAiResult(null)}
                    />
                  ) : (
                    <button onClick={handleRecognize} disabled={recognizing}
                      className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-primary/30 rounded-xl text-[13px] font-medium text-primary hover:bg-primary/5 transition-colors disabled:opacity-60">
                      {recognizing
                        ? <><Icon name="Loader" size={14} className="animate-spin" />Распознаём через ИИ...</>
                        : <><Icon name="Sparkles" size={14} />Распознать через ИИ</>
                      }
                    </button>
                  )}
                  {aiError && (
                    <div className="text-red-600 text-[12px] flex items-center gap-1.5 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
                      <Icon name="AlertCircle" size={13} className="shrink-0" />
                      {aiError}
                    </div>
                  )}
                </div>
              )}

              {/* ── Форма полей ── */}
              <form onSubmit={handleSave} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[13px] font-medium mb-1">Поставщик <span className="text-red-500">*</span></label>
                    <select value={form.supplier_id} onChange={e => setForm(p => ({ ...p, supplier_id: e.target.value }))}
                      className="w-full border border-border rounded-lg px-3 py-2 text-[13px] bg-white outline-none focus:ring-1 focus:ring-primary">
                      <option value="">—</option>
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[13px] font-medium mb-1">Материал <span className="text-red-500">*</span></label>
                    <select value={form.material_id} onChange={e => setForm(p => ({ ...p, material_id: e.target.value }))}
                      className="w-full border border-border rounded-lg px-3 py-2 text-[13px] bg-white outline-none focus:ring-1 focus:ring-primary">
                      <option value="">—</option>
                      {materials.map(m => <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[13px] font-medium mb-1">Дата счёта</label>
                    <input type="date" value={form.invoice_date} onChange={e => setForm(p => ({ ...p, invoice_date: e.target.value }))}
                      className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-[13px] font-medium mb-1">Номер счёта</label>
                    <input value={form.invoice_number} onChange={e => setForm(p => ({ ...p, invoice_number: e.target.value }))} placeholder="СФ-0001"
                      className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[13px] font-medium mb-1">Цена за единицу</label>
                    <input type="number" step="0.01" min="0" value={form.unit_price} onChange={e => setForm(p => ({ ...p, unit_price: e.target.value }))} placeholder="0.00"
                      className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-[13px] font-medium mb-1">Количество</label>
                    <input type="number" step="0.001" min="0" value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} placeholder="0"
                      className="w-full border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
                  </div>
                </div>

                {form.unit_price && form.quantity && (
                  <div className="text-[13px] font-semibold text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
                    Сумма: {fmtMoney(Number(form.unit_price) * Number(form.quantity))}
                  </div>
                )}

                <div>
                  <label className="block text-[13px] font-medium mb-1">Статус распознавания</label>
                  <select value={form.recognition_status} onChange={e => setForm(p => ({ ...p, recognition_status: e.target.value as Invoice["recognition_status"] }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-[13px] bg-white outline-none focus:ring-1 focus:ring-primary">
                    {Object.entries(STATUS_CFG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>

                {canSeeRawData && (
                  <div>
                    <label className="block text-[13px] font-medium mb-1">Распознанные данные (JSON)</label>
                    <textarea value={form.recognized_data} onChange={e => setForm(p => ({ ...p, recognized_data: e.target.value }))} rows={3}
                      className="w-full border border-border rounded-lg px-3 py-2 text-[12px] font-mono outline-none focus:ring-1 focus:ring-primary resize-none" />
                  </div>
                )}

                {error && (
                  <div className="text-red-500 text-[12px] flex items-center gap-1">
                    <Icon name="AlertCircle" size={13} />
                    {error}
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button type="submit" disabled={saving}
                    className="flex-1 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1.5">
                    {saving && <Icon name="Loader" size={13} className="animate-spin" />}
                    {editItem ? "Сохранить" : "Создать счёт"}
                  </button>
                  <button type="button" onClick={() => setModalOpen(false)}
                    className="px-4 py-2 border border-border rounded-lg text-[13px] text-muted-foreground hover:bg-secondary transition-colors">
                    Отмена
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
