import { useState, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { AiRecognizeResult, AiItem, EMPTY_AI_ITEM } from "./invoices.shared";
import { api } from "@/lib/api";
import AiItemsTab from "./AiItemsTab";
import AiManualTab, { ManualRow, EMPTY_MANUAL } from "./AiManualTab";
import AiDebugTab from "./AiDebugTab";
import TemplateWizard from "./TemplateWizard";

// ─── Типы ────────────────────────────────────────────────────────────────────
type Tab = "items" | "template_wizard" | "manual" | "raw";

interface Props {
  result: AiRecognizeResult;
  showDebug: boolean;
  applying: boolean;
  onApply: (selectedItems: AiItem[], invoiceDate: string, invoiceNumber: string) => void;
  onDismiss: () => void;
}

// ─── Утилиты ─────────────────────────────────────────────────────────────────
function manualToAiItem(row: ManualRow): AiItem {
  return {
    ...EMPTY_AI_ITEM,
    supplier_name: row.supplier_name.trim() || null,
    material:      row.material.trim()      || null,
    unit:          row.unit,
    unit_price:    row.unit_price  ? parseFloat(row.unit_price.replace(",", "."))  : null,
    quantity:      row.quantity    ? parseFloat(row.quantity.replace(",", "."))    : null,
    complete:      !!(row.material.trim() && row.unit_price && row.quantity),
  };
}

const pluralInvoice = (n: number) => n === 1 ? "счёт" : n < 5 ? "счёта" : "счетов";

// ─── Компонент ───────────────────────────────────────────────────────────────
export default function InvoiceAiPanel({ result, showDebug, applying, onApply, onDismiss }: Props) {
  const hasItems      = result.items.length > 0;
  const hasParseError = !!result.parse_error;
  const needWizard    = !!result.need_template_setup && (result.table_headers?.length ?? 0) > 0;
  const templateUsed  = !!result.template_used;
  const templateInfo  = result.template;

  const defaultTab: Tab = needWizard && !hasItems
    ? "template_wizard"
    : hasItems
    ? "items"
    : showDebug ? "raw" : "manual";

  const [tab,           setTab]           = useState<Tab>(defaultTab);
  const [selected,      setSelected]      = useState<boolean[]>(() => result.items.map(() => true));
  const [invoiceDate,   setInvoiceDate]   = useState(result.meta.invoice_date   || "");
  const [invoiceNumber, setInvoiceNumber] = useState(result.meta.invoice_number || "");
  const [savingTpl,     setSavingTpl]     = useState(false);
  const [tplSaved,      setTplSaved]      = useState<{ id: number; name: string } | null>(null);
  const [manualRows,    setManualRows]    = useState<ManualRow[]>([{ ...EMPTY_MANUAL }]);

  const checkedCount = selected.filter(Boolean).length;
  const allComplete  = result.items.every(i => i.complete);

  const toggleAll = () => {
    const allOn = selected.every(Boolean);
    setSelected(selected.map(() => !allOn));
  };
  const toggleOne = (idx: number) =>
    setSelected(s => s.map((v, i) => i === idx ? !v : v));

  const handleApplyFromAI = () => {
    const items = result.items.filter((_, i) => selected[i]);
    onApply(items, invoiceDate, invoiceNumber);
  };
  const handleApplyManual = () => {
    const items = manualRows.map(manualToAiItem).filter(it => it.material);
    if (!items.length) return;
    onApply(items, invoiceDate, invoiceNumber);
  };

  const addManualRow    = () => setManualRows(r => [...r, { ...EMPTY_MANUAL }]);
  const removeManualRow = (i: number) => setManualRows(r => r.filter((_, idx) => idx !== i));
  const updateManualRow = (i: number, field: keyof ManualRow, value: string) =>
    setManualRows(r => r.map((row, idx) => idx === i ? { ...row, [field]: value } : row));

  const handleSaveTemplate = useCallback(async (colMap: Record<string, number | null>, name: string) => {
    setSavingTpl(true);
    try {
      const res = await api.post("table_templates", {
        action: "save",
        name,
        headers: result.table_headers ?? [],
        column_map: colMap,
      });
      setTplSaved({ id: res.id, name: res.name });
      setTab(hasItems ? "items" : "manual");
    } catch {
      // ошибка — остаёмся в Мастере
    } finally {
      setSavingTpl(false);
    }
  }, [result.table_headers, hasItems]);

  // ── Цвет шапки ──
  const headerCls = hasParseError && !hasItems
    ? "bg-red-50 border-red-200"
    : hasParseError ? "bg-amber-50 border-amber-200"
    : "bg-emerald-50 border-emerald-200";
  const titleCls = hasParseError && !hasItems ? "text-red-800"
    : hasParseError ? "text-amber-800" : "text-emerald-800";
  const titleIcon = hasParseError && !hasItems ? "AlertOctagon"
    : hasParseError ? "AlertTriangle" : "Sparkles";

  // ── Список вкладок ──
  const tabs: { key: Tab; label: string }[] = [
    { key: "items",           label: `Позиции AI (${result.items.length})` },
    ...(needWizard ? [{ key: "template_wizard" as Tab, label: "Мастер шаблона" }] : []),
    { key: "manual",          label: "Ручной ввод" },
    ...(showDebug ? [{ key: "raw" as Tab, label: "Ответ AI" }] : []),
  ];

  return (
    <div className="space-y-3">
      <div className={`border rounded-xl overflow-hidden ${headerCls}`}>

        {/* ── Шапка ── */}
        <div className="px-4 pt-4 pb-3 space-y-3">

          {/* Заголовок */}
          <div className="flex items-center justify-between">
            <span className={`flex items-center gap-1.5 text-[13px] font-semibold ${titleCls}`}>
              <Icon name={titleIcon} size={14} />
              {!hasItems && hasParseError
                ? "AI не смог разобрать — проверьте вручную"
                : !hasItems && needWizard
                ? "Новый формат счёта — настройте шаблон"
                : hasItems
                ? `ИИ распознал ${result.items.length} ${result.items.length === 1 ? "позицию" : result.items.length < 5 ? "позиции" : "позиций"}`
                : "Позиции не найдены"
              }
            </span>
            <button type="button" onClick={onDismiss} className="text-muted-foreground hover:text-foreground p-0.5">
              <Icon name="X" size={14} />
            </button>
          </div>

          {/* Плашка шаблона */}
          {templateUsed && templateInfo?.name && (
            <div className="flex items-center justify-between gap-2 bg-white/70 border border-emerald-200 rounded-lg px-3 py-1.5">
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-700">
                <Icon name="BookOpen" size={11} />
                <span className="font-medium">{templateInfo.name}</span>
                <span className="text-hint">· совпадение {Math.round((templateInfo.score ?? 0) * 100)}%</span>
              </div>
              <button type="button" onClick={() => setTab("template_wizard")}
                className="text-[10px] text-muted-foreground hover:text-foreground border border-border rounded px-2 py-0.5 bg-white">
                Сменить
              </button>
            </div>
          )}

          {/* Плашка: шаблон сохранён */}
          {tplSaved && (
            <div className="flex items-center gap-1.5 text-[11px] text-primary bg-primary/5 border border-primary/20 rounded-lg px-3 py-1.5">
              <Icon name="CheckCircle" size={11} />
              Шаблон «{tplSaved.name}» сохранён — следующие счета с таким форматом распознаются автоматически
            </div>
          )}

          {/* Общие поля */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-hint mb-1">Дата счёта</label>
              <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)}
                className="w-full border border-border rounded-lg px-2 py-1.5 text-[12px] outline-none focus:ring-1 focus:ring-primary bg-white" />
            </div>
            <div>
              <label className="block text-[11px] text-hint mb-1">Номер счёта</label>
              <input value={invoiceNumber} placeholder="СФ-0001" onChange={e => setInvoiceNumber(e.target.value)}
                className="w-full border border-border rounded-lg px-2 py-1.5 text-[12px] outline-none focus:ring-1 focus:ring-primary bg-white" />
            </div>
          </div>

          {/* Переключатель вкладок */}
          <div className="flex gap-1 bg-white/60 rounded-lg p-0.5 border border-black/10">
            {tabs.map(t => (
              <button key={t.key} type="button" onClick={() => setTab(t.key)}
                className={`flex-1 px-2 py-1.5 rounded-md text-[11px] font-medium transition-colors ${
                  tab === t.key ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}>
                {t.key === "template_wizard" && <Icon name="Wand2" size={10} className="inline mr-0.5" />}
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Вкладка: позиции AI ── */}
        {tab === "items" && (
          <div className="px-4 pb-4 space-y-3">
            <AiItemsTab
              items={result.items}
              selected={selected}
              applying={applying}
              checkedCount={checkedCount}
              allComplete={allComplete}
              hasParseError={hasParseError}
              parseError={result.parse_error}
              needWizard={needWizard}
              pluralInvoice={pluralInvoice}
              onToggleAll={toggleAll}
              onToggle={toggleOne}
              onApply={handleApplyFromAI}
              onGoWizard={() => setTab("template_wizard")}
              onGoManual={() => setTab("manual")}
            />
          </div>
        )}

        {/* ── Вкладка: Мастер шаблона ── */}
        {tab === "template_wizard" && (
          <div className="px-4 pb-4">
            <TemplateWizard
              headers={result.table_headers ?? []}
              aiSuggestion={result.ai_col_suggestion ?? {}}
              onSave={handleSaveTemplate}
              saving={savingTpl}
            />
          </div>
        )}

        {/* ── Вкладка: ручной ввод ── */}
        {tab === "manual" && (
          <div className="px-4 pb-4 space-y-3">
            <AiManualTab
              rows={manualRows}
              applying={applying}
              hasItems={hasItems}
              pluralInvoice={pluralInvoice}
              onUpdate={updateManualRow}
              onAdd={addManualRow}
              onRemove={removeManualRow}
              onApply={handleApplyManual}
              onGoItems={() => setTab("items")}
            />
          </div>
        )}

        {/* ── Вкладка: Ответ AI (debug) ── */}
        {tab === "raw" && showDebug && (
          <div className="px-4 pb-4">
            <AiDebugTab result={result} />
          </div>
        )}

      </div>
    </div>
  );
}
