import Icon from "@/components/ui/icon";

const UNITS = ["шт", "м3", "т", "пог.м", "м2", "компл"];

export interface ManualRow {
  supplier_name: string;
  material: string;
  unit: string;
  unit_price: string;
  quantity: string;
}

export const EMPTY_MANUAL: ManualRow = {
  supplier_name: "", material: "", unit: "шт", unit_price: "", quantity: "",
};

interface Props {
  rows: ManualRow[];
  applying: boolean;
  hasItems: boolean;
  pluralInvoice: (n: number) => string;
  onUpdate: (idx: number, field: keyof ManualRow, value: string) => void;
  onAdd: () => void;
  onRemove: (idx: number) => void;
  onApply: () => void;
  onGoItems: () => void;
}

export default function AiManualTab({
  rows, applying, hasItems, pluralInvoice,
  onUpdate, onAdd, onRemove, onApply, onGoItems,
}: Props) {
  const readyCount = rows.filter(r => r.material.trim()).length;

  return (
    <>
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
              {rows.map((row, idx) => (
                <tr key={idx}>
                  <td className="px-1 py-1">
                    <input value={row.supplier_name} onChange={e => onUpdate(idx, "supplier_name", e.target.value)}
                      placeholder="Поставщик"
                      className="w-full border border-border rounded px-1.5 py-1 text-[11px] outline-none focus:ring-1 focus:ring-primary" />
                  </td>
                  <td className="px-1 py-1">
                    <input value={row.material} onChange={e => onUpdate(idx, "material", e.target.value)}
                      placeholder="Наименование *"
                      className="w-full border border-border rounded px-1.5 py-1 text-[11px] outline-none focus:ring-1 focus:ring-primary" />
                  </td>
                  <td className="px-1 py-1">
                    <select value={row.unit} onChange={e => onUpdate(idx, "unit", e.target.value)}
                      className="w-full border border-border rounded px-1 py-1 text-[11px] outline-none bg-white">
                      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </td>
                  <td className="px-1 py-1">
                    <input value={row.unit_price} onChange={e => onUpdate(idx, "unit_price", e.target.value)}
                      placeholder="0" inputMode="decimal"
                      className="w-full border border-border rounded px-1.5 py-1 text-[11px] outline-none focus:ring-1 focus:ring-primary text-right" />
                  </td>
                  <td className="px-1 py-1">
                    <input value={row.quantity} onChange={e => onUpdate(idx, "quantity", e.target.value)}
                      placeholder="0" inputMode="decimal"
                      className="w-full border border-border rounded px-1.5 py-1 text-[11px] outline-none focus:ring-1 focus:ring-primary text-right" />
                  </td>
                  <td className="px-1 py-1 text-center">
                    {rows.length > 1 && (
                      <button type="button" onClick={() => onRemove(idx)}
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
        <button type="button" onClick={onApply}
          disabled={applying || readyCount === 0}
          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-[13px] font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50">
          {applying
            ? <><Icon name="Loader" size={13} className="animate-spin" />Создаём...</>
            : <><Icon name="Check" size={13} />Создать {pluralInvoice(readyCount)}</>
          }
        </button>
        <button type="button" onClick={onAdd} disabled={applying}
          className="flex items-center gap-1 px-3 py-2 border border-border rounded-lg text-[12px] text-muted-foreground hover:bg-white transition-colors">
          <Icon name="Plus" size={12} />Добавить строку
        </button>
        {hasItems && (
          <button type="button" onClick={onGoItems} disabled={applying}
            className="px-3 py-2 text-[12px] text-primary hover:underline">
            ← К результатам AI
          </button>
        )}
      </div>
    </>
  );
}
