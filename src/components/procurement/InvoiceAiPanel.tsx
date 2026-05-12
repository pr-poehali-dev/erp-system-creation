import { useState, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { AiRecognizeResult, AiItem, EMPTY_AI_ITEM, MAPPABLE_FIELDS, fmtMoney } from "./invoices.shared";
import { api } from "@/lib/api";

// ─── Константы ────────────────────────────────────────────────────────────────
const UNITS = ["шт", "м3", "т", "пог.м", "м2", "компл"];

// ─── Ручная строка ────────────────────────────────────────────────────────────
interface ManualRow {
  supplier_name: string;
  material: string;
  unit: string;
  unit_price: string;
  quantity: string;
}
const EMPTY_MANUAL: ManualRow = { supplier_name: "", material: "", unit: "шт", unit_price: "", quantity: "" };

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

// ─── Вкладки ─────────────────────────────────────────────────────────────────
type Tab = "items" | "template_wizard" | "manual" | "raw";

// ─── Пропсы ──────────────────────────────────────────────────────────────────
interface Props {
  result: AiRecognizeResult;
  showDebug: boolean;
  applying: boolean;
  onApply: (selectedItems: AiItem[], invoiceDate: string, invoiceNumber: string) => void;
  onDismiss: () => void;
}

// ─── Мастер шаблона ──────────────────────────────────────────────────────────
interface WizardProps {
  headers: string[];
  aiSuggestion: Record<string, number | null>;
  onSave: (columnMap: Record<string, number | null>, name: string) => Promise<void>;
  saving: boolean;
}

function TemplateWizard({ headers, aiSuggestion, onSave, saving }: WizardProps) {
  const [colMap, setColMap] = useState<Record<string, number | null>>(() => {
    const init: Record<string, number | null> = {};
    for (const f of MAPPABLE_FIELDS) {
      const v = aiSuggestion[f.key];
      init[f.key] = (v !== undefined && v !== null) ? Number(v) : null;
    }
    return init;
  });
  const [tplName, setTplName] = useState(
    "Шаблон: " + headers.slice(0, 4).join(" / ")
  );

  const setField = (field: string, colIdx: number | null) =>
    setColMap(m => ({ ...m, [field]: colIdx }));

  return (
    <div className="space-y-3">
      <div className="text-[11px] text-muted-foreground">
        AI предварительно заполнил соответствие колонок. Проверь и исправь если нужно.
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="bg-secondary/60 text-hint">
              <th className="px-3 py-1.5 text-left font-medium w-1/2">Заголовок из счёта</th>
              <th className="px-3 py-1.5 text-left font-medium">Это поле:</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-white">
            {headers.map((h, colIdx) => {
              // Какое поле сейчас назначено на эту колонку?
              const assignedField = Object.entries(colMap).find(([, v]) => v === colIdx)?.[0] ?? "skip";
              return (
                <tr key={colIdx}>
                  <td className="px-3 py-1.5 font-mono text-[10px] text-foreground">
                    <span className="text-hint mr-1.5">[{colIdx}]</span>{h}
                  </td>
                  <td className="px-3 py-1.5">
                    <select
                      value={assignedField}
                      onChange={e => {
                        const newField = e.target.value;
                        // Убираем предыдущее назначение этого colIdx
                        const cleared: Record<string, number | null> = { ...colMap };
                        for (const [k, v] of Object.entries(cleared)) {
                          if (v === colIdx) cleared[k] = null;
                        }
                        if (newField !== "skip") cleared[newField] = colIdx;
                        setColMap(cleared);
                      }}
                      className="w-full border border-border rounded px-2 py-1 text-[11px] bg-white outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="skip">— Пропустить —</option>
                      {MAPPABLE_FIELDS.filter(f => f.key !== "skip").map(f => (
                        <option key={f.key} value={f.key}>{f.label}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div>
        <label className="block text-[11px] text-hint mb-1">Название шаблона</label>
        <input value={tplName} onChange={e => setTplName(e.target.value)}
          className="w-full border border-border rounded-lg px-2 py-1.5 text-[12px] outline-none focus:ring-1 focus:ring-primary" />
      </div>

      <button type="button" disabled={saving}
        onClick={() => onSave(colMap, tplName)}
        className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
        {saving
          ? <><Icon name="Loader" size={13} className="animate-spin" />Сохраняем...</>
          : <><Icon name="BookmarkPlus" size={13} />Сохранить шаблон</>
        }
      </button>
    </div>
  );
}

// ─── Основной компонент ───────────────────────────────────────────────────────
export default function InvoiceAiPanel({ result, showDebug, applying, onApply, onDismiss }: Props) {
  const hasItems       = result.items.length > 0;
  const hasParseError  = !!result.parse_error;
  const needWizard     = !!result.need_template_setup && (result.table_headers?.length ?? 0) > 0;
  const templateUsed   = !!result.template_used;
  const templateInfo   = result.template;

  // Определяем дефолтную вкладку
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
  const [tplSaved,      setTplSaved]      = useState<{id: number; name: string} | null>(null);

  // Ручной ввод
  const [manualRows, setManualRows] = useState<ManualRow[]>([{ ...EMPTY_MANUAL }]);

  const checkedCount = selected.filter(Boolean).length;
  const allComplete  = result.items.every(i => i.complete);
  const pluralInvoice = (n: number) => n === 1 ? "счёт" : n < 5 ? "счёта" : "счетов";
  const toggleAll = () => { const allOn = selected.every(Boolean); setSelected(selected.map(() => !allOn)); };

  const handleApplyFromAI = () => {
    const items = result.items.filter((_, i) => selected[i]);
    onApply(items, invoiceDate, invoiceNumber);
  };
  const handleApplyManual = () => {
    const items = manualRows.map(manualToAiItem).filter(it => it.material);
    if (!items.length) return;
    onApply(items, invoiceDate, invoiceNumber);
  };

  const addManualRow = () => setManualRows(r => [...r, { ...EMPTY_MANUAL }]);
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
      // После сохранения переключаемся на результаты (если есть) или ручной ввод
      setTab(hasItems ? "items" : "manual");
    } catch {
      // ошибка — остаёмся в Мастере
    } finally {
      setSavingTpl(false);
    }
  }, [result.table_headers, hasItems]);

  // Цвет шапки
  const headerCls = hasParseError && !hasItems
    ? "bg-red-50 border-red-200"
    : hasParseError ? "bg-amber-50 border-amber-200"
    : "bg-emerald-50 border-emerald-200";
  const titleCls = hasParseError && !hasItems ? "text-red-800"
    : hasParseError ? "text-amber-800" : "text-emerald-800";
  const titleIcon = hasParseError && !hasItems ? "AlertOctagon"
    : hasParseError ? "AlertTriangle" : "Sparkles";

  // Список вкладок
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

          {/* Вкладки */}
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
            {hasItems ? (
              <>
                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="bg-secondary/60 text-hint">
                          <th className="px-2 py-1.5 w-7 text-center">
                            <input type="checkbox" checked={selected.every(Boolean)} onChange={toggleAll} className="cursor-pointer" />
                          </th>
                          <th className="px-1 py-1.5 w-4" title="🟢 ок / 🟡 цена скорректирована / 🔴 нет данных"></th>
                          <th className="px-2 py-1.5 text-left font-medium">Поставщик</th>
                          <th className="px-2 py-1.5 text-left font-medium">Материал</th>
                          <th className="px-2 py-1.5 text-left font-medium">Ед.</th>
                          <th className="px-2 py-1.5 text-right font-medium">Цена</th>
                          <th className="px-2 py-1.5 text-right font-medium">Кол-во</th>
                          <th className="px-2 py-1.5 text-right font-medium">Сумма</th>
                          <th className="px-2 py-1.5 w-5"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border bg-white">
                        {result.items.map((item, idx) => {
                          const total = item.unit_price != null && item.quantity != null
                            ? item.unit_price * item.quantity : null;
                          const q = item.quality ?? (item.complete ? "ok" : "bad");
                          const qDot = q === "ok" ? "bg-emerald-500" : q === "suspicious" ? "bg-amber-400" : "bg-red-400";
                          return (
                            <tr key={idx} className={`transition-opacity ${selected[idx] ? "" : "opacity-40"}`}>
                              <td className="px-2 py-2 text-center">
                                <input type="checkbox" checked={selected[idx]}
                                  onChange={() => setSelected(s => s.map((v, i) => i === idx ? !v : v))}
                                  className="cursor-pointer" />
                              </td>
                              <td className="px-1 py-2 text-center">
                                <span className={`inline-block w-2 h-2 rounded-full ${qDot}`} />
                              </td>
                              <td className="px-2 py-2 max-w-[90px]">
                                <div className="truncate" title={item.supplier_name || ""}>{item.supplier_name || <span className="text-hint italic">—</span>}</div>
                                {item.supplier_created && <div className="text-[9px] text-emerald-600">✚ создан</div>}
                              </td>
                              <td className="px-2 py-2 max-w-[110px]">
                                <div className="truncate" title={item.material || ""}>{item.material || <span className="text-hint italic">—</span>}</div>
                                {item.material_created && <div className="text-[9px] text-emerald-600">✚ создан</div>}
                              </td>
                              <td className="px-2 py-2 whitespace-nowrap">{item.unit}</td>
                              <td className={`px-2 py-2 text-right whitespace-nowrap ${item.price_fixed ? "text-amber-600 font-medium" : ""}`}>
                                {fmtMoney(item.unit_price)}
                                {item.price_fixed && <div className="text-[8px] text-amber-500 leading-tight">авто ×1000</div>}
                              </td>
                              <td className="px-2 py-2 text-right">{item.quantity ?? "—"}</td>
                              <td className="px-2 py-2 text-right whitespace-nowrap font-medium">{fmtMoney(total)}</td>
                              <td className="px-2 py-2 text-center">
                                {item.complete
                                  ? <Icon name="CheckCircle" size={11} className="text-emerald-500" />
                                  : <Icon name="AlertCircle" size={11} className="text-amber-500" />
                                }
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Легенда */}
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-emerald-500"/> В порядке</span>
                  <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-amber-400"/> Цена скорректирована</span>
                  <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-red-400"/> Нет данных</span>
                </div>

                {!allComplete && (
                  <div className="flex items-center gap-1.5 text-[11px] text-amber-700 bg-white border border-amber-200 rounded-lg px-3 py-2">
                    <Icon name="AlertTriangle" size={12} className="shrink-0" />
                    Позиции с <Icon name="AlertCircle" size={10} className="inline mx-0.5 text-amber-500" /> получат статус «Требует проверки»
                  </div>
                )}

                {hasParseError && (
                  <div className="flex items-start gap-1.5 text-[11px] text-amber-700 bg-white border border-amber-200 rounded-lg px-3 py-2">
                    <Icon name="Info" size={12} className="shrink-0 mt-0.5" />
                    <span>Частичное распознавание: <span className="font-mono">{result.parse_error?.slice(0, 120)}</span></span>
                  </div>
                )}

                <div className="flex gap-2 flex-wrap items-center">
                  <button type="button" onClick={handleApplyFromAI}
                    disabled={applying || checkedCount === 0}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-[13px] font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50">
                    {applying
                      ? <><Icon name="Loader" size={13} className="animate-spin" />Создаём...</>
                      : <><Icon name="Check" size={13} />Создать {checkedCount} {pluralInvoice(checkedCount)}</>
                    }
                  </button>
                  {needWizard && (
                    <button type="button" onClick={() => setTab("template_wizard")} disabled={applying}
                      className="flex items-center gap-1 px-3 py-2 border border-border rounded-lg text-[12px] text-muted-foreground hover:bg-white transition-colors">
                      <Icon name="Wand2" size={12} />
                      Настроить шаблон
                    </button>
                  )}
                  <button type="button" onClick={() => setTab("manual")} disabled={applying}
                    className="px-3 py-2 border border-border rounded-lg text-[12px] text-muted-foreground hover:bg-white transition-colors">
                    Ввести вручную
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-6 space-y-2">
                <Icon name="SearchX" size={28} className="mx-auto text-muted-foreground opacity-50" />
                <div className="text-[13px] text-muted-foreground">AI не нашёл позиций в документе</div>
                <div className="flex justify-center gap-2">
                  {needWizard && (
                    <button type="button" onClick={() => setTab("template_wizard")}
                      className="text-[12px] text-primary hover:underline flex items-center gap-1">
                      <Icon name="Wand2" size={11} />Настроить шаблон
                    </button>
                  )}
                  <button type="button" onClick={() => setTab("manual")}
                    className="text-[12px] text-muted-foreground hover:underline">
                    Ввести вручную →
                  </button>
                </div>
              </div>
            )}
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
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="bg-secondary/60 text-hint">
                      <th className="px-2 py-1.5 text-left font-medium w-[22%]">Поставщик</th>
                      <th className="px-2 py-1.5 text-left font-medium w-[28%]">Материал *</th>
                      <th className="px-2 py-1.5 text-left font-medium w-[10%]">Ед.</th>
                      <th className="px-2 py-1.5 text-right font-medium w-[16%]">Цена</th>
                      <th className="px-2 py-1.5 text-right font-medium w-[16%]">Кол-во</th>
                      <th className="px-2 py-1.5 w-7"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-white">
                    {manualRows.map((row, idx) => (
                      <tr key={idx}>
                        <td className="px-1 py-1">
                          <input value={row.supplier_name} onChange={e => updateManualRow(idx, "supplier_name", e.target.value)}
                            placeholder="Поставщик"
                            className="w-full border border-border rounded px-1.5 py-1 text-[11px] outline-none focus:ring-1 focus:ring-primary" />
                        </td>
                        <td className="px-1 py-1">
                          <input value={row.material} onChange={e => updateManualRow(idx, "material", e.target.value)}
                            placeholder="Наименование *"
                            className="w-full border border-border rounded px-1.5 py-1 text-[11px] outline-none focus:ring-1 focus:ring-primary" />
                        </td>
                        <td className="px-1 py-1">
                          <select value={row.unit} onChange={e => updateManualRow(idx, "unit", e.target.value)}
                            className="w-full border border-border rounded px-1 py-1 text-[11px] outline-none bg-white">
                            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </td>
                        <td className="px-1 py-1">
                          <input value={row.unit_price} onChange={e => updateManualRow(idx, "unit_price", e.target.value)}
                            placeholder="0" inputMode="decimal"
                            className="w-full border border-border rounded px-1.5 py-1 text-[11px] outline-none focus:ring-1 focus:ring-primary text-right" />
                        </td>
                        <td className="px-1 py-1">
                          <input value={row.quantity} onChange={e => updateManualRow(idx, "quantity", e.target.value)}
                            placeholder="0" inputMode="decimal"
                            className="w-full border border-border rounded px-1.5 py-1 text-[11px] outline-none focus:ring-1 focus:ring-primary text-right" />
                        </td>
                        <td className="px-1 py-1 text-center">
                          {manualRows.length > 1 && (
                            <button type="button" onClick={() => removeManualRow(idx)}
                              className="text-muted-foreground hover:text-red-500 transition-colors">
                              <Icon name="Trash2" size={12} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex gap-2 flex-wrap items-center">
              <button type="button" onClick={handleApplyManual}
                disabled={applying || !manualRows.some(r => r.material.trim())}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-[13px] font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50">
                {applying
                  ? <><Icon name="Loader" size={13} className="animate-spin" />Создаём...</>
                  : <><Icon name="Check" size={13} />Создать {pluralInvoice(manualRows.filter(r=>r.material.trim()).length)}</>
                }
              </button>
              <button type="button" onClick={addManualRow} disabled={applying}
                className="flex items-center gap-1 px-3 py-2 border border-border rounded-lg text-[12px] text-muted-foreground hover:bg-white transition-colors">
                <Icon name="Plus" size={12} />Добавить строку
              </button>
              {hasItems && (
                <button type="button" onClick={() => setTab("items")} disabled={applying}
                  className="px-3 py-2 text-[12px] text-primary hover:underline">
                  ← К результатам AI
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Вкладка: Ответ AI (debug) ── */}
        {tab === "raw" && showDebug && (
          <div className="px-4 pb-4 space-y-3">
            {result.parse_error && (
              <div className="rounded-lg border border-red-200 bg-white overflow-hidden">
                <div className="px-3 py-2 bg-red-50 text-[11px] font-semibold text-red-700 flex items-center gap-1.5">
                  <Icon name="Bug" size={11} />Ошибка парсера
                </div>
                <pre className="px-3 py-2 text-[10px] font-mono text-red-600 whitespace-pre-wrap break-all max-h-24 overflow-y-auto">
                  {result.parse_error}
                </pre>
              </div>
            )}
            <div className="rounded-lg border border-border bg-white overflow-hidden">
              <div className="px-3 py-2 bg-secondary/50 text-[11px] font-semibold flex items-center gap-1.5">
                <Icon name="MessageSquare" size={11} />Сырой текст / ответ AI
              </div>
              <pre className="px-3 py-2 text-[10px] font-mono whitespace-pre-wrap break-all max-h-48 overflow-y-auto bg-gray-950 text-gray-100">
                {result.debug.raw_response || "(пусто)"}
              </pre>
            </div>
            {(result.debug.continuation_log?.length ?? 0) > 0 && (
              <div className="rounded-lg border border-violet-200 bg-white overflow-hidden">
                <div className="px-3 py-2 bg-violet-50 text-[11px] font-semibold text-violet-700 flex items-center gap-1.5">
                  <Icon name="GitMerge" size={11} />Debug лог
                </div>
                <div className="px-3 py-2 space-y-0.5 max-h-40 overflow-y-auto">
                  {result.debug.continuation_log!.map((line, i) => (
                    <div key={i} className="text-[10px] font-mono text-muted-foreground">{line}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
