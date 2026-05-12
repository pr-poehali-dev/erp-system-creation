import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { TableTemplate, MAPPABLE_FIELDS } from "./invoices.shared";
import { api } from "@/lib/api";

function fmtDate(s: string | null) {
  try { return s ? new Date(s).toLocaleDateString("ru-RU") : "—"; }
  catch { return "—"; }
}

const FIELD_LABEL: Record<string, string> = Object.fromEntries(MAPPABLE_FIELDS.map(f => [f.key, f.label]));

export default function TemplatesTab() {
  const [templates, setTemplates] = useState<TableTemplate[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expanded,  setExpanded]  = useState<number | null>(null);
  const [renaming,  setRenaming]  = useState<number | null>(null);
  const [newName,   setNewName]   = useState("");
  const [saving,    setSaving]    = useState(false);
  const [deleting,  setDeleting]  = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.get("table_templates");
      // Ответ может быть массивом напрямую или завёрнут в объект
      const list: TableTemplate[] = Array.isArray(res)
        ? res
        : Array.isArray(res?.data) ? res.data : [];
      setTemplates(list);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Ошибка загрузки шаблонов");
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: number) => {
    if (!confirm("Удалить шаблон? Это не затронет уже созданные счета.")) return;
    setDeleting(id);
    try {
      await api.post("table_templates", { action: "delete", id });
      setTemplates(t => t.filter(x => x.id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка удаления");
    } finally {
      setDeleting(null);
    }
  };

  const startRename = (tpl: TableTemplate) => {
    setRenaming(tpl.id);
    setNewName(tpl.name);
  };

  const handleRename = async (id: number) => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await api.post("table_templates", { action: "rename", id, name: newName.trim() });
      setTemplates(t => t.map(x => x.id === id ? { ...x, name: newName.trim() } : x));
      setRenaming(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка переименования");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
      <Icon name="Loader" size={16} className="animate-spin" />Загрузка шаблонов...
    </div>
  );

  if (loadError) return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <Icon name="AlertTriangle" size={32} className="text-amber-500 opacity-60" />
      <div className="text-center">
        <div className="text-[14px] font-medium text-foreground">Ошибка загрузки шаблонов</div>
        <div className="text-[12px] text-muted-foreground mt-1">{loadError}</div>
      </div>
      <button onClick={load}
        className="flex items-center gap-1.5 px-4 py-2 border border-border rounded-lg text-[13px] hover:bg-secondary transition-colors">
        <Icon name="RefreshCw" size={13} />Попробовать снова
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Заголовок */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-[15px] font-semibold">Шаблоны таблиц</h2>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Система запоминает структуру каждого нового формата счёта.
            Чем больше шаблонов — тем быстрее распознавание.
          </p>
        </div>
        <button onClick={load}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-[12px] text-muted-foreground hover:bg-secondary transition-colors">
          <Icon name="RefreshCw" size={13} />Обновить
        </button>
      </div>

      {/* Пусто */}
      {templates.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <Icon name="BookOpen" size={36} className="opacity-25" />
          <div className="text-center">
            <div className="text-[14px] font-medium">Шаблонов пока нет</div>
            <div className="text-[12px] mt-1">
              При распознавании нового формата счёта система предложит создать шаблон
            </div>
          </div>
        </div>
      )}

      {/* Список шаблонов */}
      <div className="space-y-2">
        {templates.map(tpl => {
          const isExpanded = expanded === tpl.id;
          const isRenaming = renaming === tpl.id;
          const isDel      = deleting === tpl.id;

          // Безопасный разбор column_map
          let colMapEntries: [string, number | null][] = [];
          try {
            const cm = tpl.column_map ?? {};
            colMapEntries = (Object.entries(cm) as [string, number | null][])
              .filter(([k, v]) => v !== null && k !== "skip")
              .sort((a, b) => (a[1] as number) - (b[1] as number));
          } catch { /* пустой маппинг — ничего страшного */ }

          // Безопасный разбор headers
          const headers: string[] = Array.isArray(tpl.headers) ? tpl.headers : [];

          return (
            <div key={tpl.id}
              className="border border-border rounded-xl bg-white overflow-hidden">

              {/* Шапка карточки */}
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  {isRenaming ? (
                    <div className="flex items-center gap-2">
                      <input
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") handleRename(tpl.id);
                          if (e.key === "Escape") setRenaming(null);
                        }}
                        autoFocus
                        className="flex-1 border border-primary rounded px-2 py-1 text-[13px] outline-none focus:ring-1 focus:ring-primary"
                      />
                      <button onClick={() => handleRename(tpl.id)} disabled={saving}
                        className="px-2 py-1 bg-primary text-white rounded text-[12px] disabled:opacity-50">
                        {saving ? <Icon name="Loader" size={12} className="animate-spin" /> : "OK"}
                      </button>
                      <button onClick={() => setRenaming(null)} className="text-muted-foreground hover:text-foreground">
                        <Icon name="X" size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[13px] truncate">{tpl.name}</span>
                      {tpl.ai_suggested && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-violet-50 text-violet-600 rounded border border-violet-200 whitespace-nowrap">
                          AI-предложение
                        </span>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                    <span className="flex items-center gap-1">
                      <Icon name="BarChart2" size={10} />
                      Использован {tpl.use_count ?? 0} раз
                    </span>
                    <span>Создан {fmtDate(tpl.created_at)}</span>
                    {tpl.last_used_at && <span>· Последний раз {fmtDate(tpl.last_used_at)}</span>}
                  </div>
                </div>

                {/* Действия */}
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => setExpanded(isExpanded ? null : tpl.id)}
                    className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded transition-colors"
                    title="Подробнее">
                    <Icon name={isExpanded ? "ChevronUp" : "ChevronDown"} size={14} />
                  </button>
                  <button onClick={() => startRename(tpl)}
                    className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded transition-colors"
                    title="Переименовать">
                    <Icon name="Pencil" size={13} />
                  </button>
                  <button onClick={() => handleDelete(tpl.id)} disabled={isDel}
                    className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                    title="Удалить">
                    {isDel ? <Icon name="Loader" size={13} className="animate-spin" /> : <Icon name="Trash2" size={13} />}
                  </button>
                </div>
              </div>

              {/* Детали (раскрываемые) */}
              {isExpanded && (
                <div className="border-t border-border px-4 py-3 bg-secondary/20 space-y-3">
                  {/* Заголовки из счёта */}
                  <div>
                    <div className="text-[11px] font-semibold text-muted-foreground mb-1.5">
                      Заголовки таблицы из документа
                    </div>
                    {headers.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {headers.map((h, i) => (
                          <span key={i} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 bg-white border border-border rounded font-mono">
                            <span className="text-hint">[{i}]</span> {h}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[11px] text-hint italic">Заголовки не сохранены</span>
                    )}
                  </div>

                  {/* Маппинг колонок */}
                  <div>
                    <div className="text-[11px] font-semibold text-muted-foreground mb-1.5">
                      Маппинг полей
                    </div>
                    {colMapEntries.length > 0 ? (
                      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                        {colMapEntries.map(([field, colIdx]) => (
                          <div key={field} className="flex items-center gap-2 text-[11px] bg-white border border-border rounded px-2 py-1">
                            <span className="font-medium text-primary">{FIELD_LABEL[field] ?? field}</span>
                            <span className="text-hint">←</span>
                            <span className="font-mono text-[10px]">
                              [{colIdx}] {headers[colIdx as number] ?? "?"}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[11px] text-hint italic">Маппинг не задан</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Подсказка снизу */}
      {templates.length > 0 && (
        <div className="flex items-start gap-2 text-[11px] text-muted-foreground bg-secondary/30 rounded-lg px-4 py-3">
          <Icon name="Info" size={13} className="shrink-0 mt-0.5" />
          <span>
            При распознавании нового счёта система ищет шаблон с совпадением заголовков &gt;70%.
            Если найден — парсит без AI. Если качество &lt;50% — автоматически переключается на AI.
          </span>
        </div>
      )}
    </div>
  );
}
