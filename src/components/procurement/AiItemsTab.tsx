import Icon from "@/components/ui/icon";
import { AiItem, fmtMoney } from "./invoices.shared";

interface Props {
  items: AiItem[];
  selected: boolean[];
  applying: boolean;
  checkedCount: number;
  allComplete: boolean;
  hasParseError: boolean;
  parseError: string | null;
  needWizard: boolean;
  pluralInvoice: (n: number) => string;
  onToggleAll: () => void;
  onToggle: (idx: number) => void;
  onApply: () => void;
  onGoWizard: () => void;
  onGoManual: () => void;
}

export default function AiItemsTab({
  items, selected, applying, checkedCount, allComplete,
  hasParseError, parseError, needWizard, pluralInvoice,
  onToggleAll, onToggle, onApply, onGoWizard, onGoManual,
}: Props) {
  if (!items.length) {
    return (
      <div className="text-center py-6 space-y-2">
        <Icon name="SearchX" size={28} className="mx-auto text-muted-foreground opacity-50" />
        <div className="text-[13px] text-muted-foreground">AI не нашёл позиций в документе</div>
        <div className="flex justify-center gap-2">
          {needWizard && (
            <button type="button" onClick={onGoWizard}
              className="text-[12px] text-primary hover:underline flex items-center gap-1">
              <Icon name="Wand2" size={11} />Настроить шаблон
            </button>
          )}
          <button type="button" onClick={onGoManual}
            className="text-[12px] text-muted-foreground hover:underline">
            Ввести вручную →
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-secondary/60 text-hint">
                <th className="px-2 py-1.5 w-7 text-center">
                  <input type="checkbox" checked={selected.every(Boolean)} onChange={onToggleAll} className="cursor-pointer" />
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
              {items.map((item, idx) => {
                const total = item.unit_price != null && item.quantity != null
                  ? item.unit_price * item.quantity : null;
                const q = item.quality ?? (item.complete ? "ok" : "bad");
                const qDot = q === "ok" ? "bg-emerald-500" : q === "suspicious" ? "bg-amber-400" : "bg-red-400";
                return (
                  <tr key={idx} className={`transition-opacity ${selected[idx] ? "" : "opacity-40"}`}>
                    <td className="px-2 py-2 text-center">
                      <input type="checkbox" checked={selected[idx]}
                        onChange={() => onToggle(idx)}
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
          <span>Частичное распознавание: <span className="font-mono">{parseError?.slice(0, 120)}</span></span>
        </div>
      )}

      <div className="flex gap-2 flex-wrap items-center">
        <button type="button" onClick={onApply}
          disabled={applying || checkedCount === 0}
          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-[13px] font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50">
          {applying
            ? <><Icon name="Loader" size={13} className="animate-spin" />Создаём...</>
            : <><Icon name="Check" size={13} />Создать {checkedCount} {pluralInvoice(checkedCount)}</>
          }
        </button>
        {needWizard && (
          <button type="button" onClick={onGoWizard} disabled={applying}
            className="flex items-center gap-1 px-3 py-2 border border-border rounded-lg text-[12px] text-muted-foreground hover:bg-white transition-colors">
            <Icon name="Wand2" size={12} />
            Настроить шаблон
          </button>
        )}
        <button type="button" onClick={onGoManual} disabled={applying}
          className="px-3 py-2 border border-border rounded-lg text-[12px] text-muted-foreground hover:bg-white transition-colors">
          Ввести вручную
        </button>
      </div>
    </>
  );
}
