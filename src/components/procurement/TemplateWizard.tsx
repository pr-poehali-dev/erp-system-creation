import { useState } from "react";
import Icon from "@/components/ui/icon";
import { MAPPABLE_FIELDS } from "./invoices.shared";

interface Props {
  headers: string[];
  aiSuggestion: Record<string, number | null>;
  saving: boolean;
  savingAndApplying: boolean;
  onSave: (columnMap: Record<string, number | null>, name: string) => Promise<void>;
  onSaveAndApply: (columnMap: Record<string, number | null>, name: string) => Promise<void>;
}

export default function TemplateWizard({
  headers, aiSuggestion, saving, savingAndApplying,
  onSave, onSaveAndApply,
}: Props) {
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

  const busy = saving || savingAndApplying;

  return (
    <div className="space-y-3">
      <div className="text-[11px] text-muted-foreground">
        AI предварительно заполнил соответствие колонок. Проверь и исправь если нужно.
      </div>

      <div className="border border-border rounded-lg overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="bg-secondary/60 text-hint">
              <th className="px-3 py-1.5 text-left font-medium w-1/2">Заголовок из счёта</th>
              <th className="px-3 py-1.5 text-left font-medium">Это поле:</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-white">
            {headers.map((h, colIdx) => {
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

      <div className="flex gap-2 flex-wrap">
        {/* Основная кнопка: сохранить И применить */}
        <button type="button" disabled={busy}
          onClick={() => onSaveAndApply(colMap, tplName)}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
          {savingAndApplying
            ? <><Icon name="Loader" size={13} className="animate-spin" />Применяем...</>
            : <><Icon name="BookmarkPlus" size={13} />Сохранить и применить</>
          }
        </button>

        {/* Вторичная кнопка: только сохранить */}
        <button type="button" disabled={busy}
          onClick={() => onSave(colMap, tplName)}
          className="flex items-center gap-1.5 px-3 py-2 border border-border bg-white rounded-lg text-[12px] text-muted-foreground hover:bg-secondary transition-colors disabled:opacity-50">
          {saving
            ? <><Icon name="Loader" size={12} className="animate-spin" />Сохраняем...</>
            : <><Icon name="Bookmark" size={12} />Только сохранить</>
          }
        </button>
      </div>
    </div>
  );
}