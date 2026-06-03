import { useEffect, useMemo, useState } from "react";
import { api, MaterialCategory } from "@/lib/api";
import { Role } from "@/App";
import Icon from "@/components/ui/icon";
import UncategorizedMaterials from "./UncategorizedMaterials";

const CAN_IMPORT_ROLES: Role[] = ["director", "supply_director"];

export default function CategoriesTab({ role }: { role?: Role }) {
  const canImport = !role || CAN_IMPORT_ROLES.includes(role);
  const [view, setView] = useState<"tree" | "uncategorized">("tree");
  const [cats, setCats] = useState<MaterialCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragId, setDragId] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<number | "root" | null>(null);
  // Ретроспективное назначение категорий
  const [recat, setRecat] = useState<{ running: boolean; total: number; processed: number; assigned: number; doneMsg: string }>({
    running: false, total: 0, processed: 0, assigned: 0, doneMsg: "",
  });

  const load = () => {
    setLoading(true);
    api.material_categories.list().then(setCats).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const childrenMap = useMemo(() => {
    const m = new Map<number | null, MaterialCategory[]>();
    cats.forEach(c => {
      if (!m.has(c.parent_id)) m.set(c.parent_id, []);
      m.get(c.parent_id)!.push(c);
    });
    m.forEach(list => list.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)));
    return m;
  }, [cats]);

  const toggle = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const isDescendant = (parentId: number, childId: number): boolean => {
    let cur: number | null = childId;
    const byId = new Map(cats.map(c => [c.id, c]));
    let guard = 0;
    while (cur != null && guard < 50) {
      if (cur === parentId) return true;
      cur = byId.get(cur)?.parent_id ?? null;
      guard++;
    }
    return false;
  };

  const handleImport = async () => {
    if (!confirm("Импортировать полное стандартное дерево категорий (~700 позиций)? Существующие категории не дублируются.")) return;
    setBusy(true); setError("");
    try {
      const res = await api.material_categories.seed();
      alert(
        res.created > 0
          ? `Импорт завершён. Добавлено новых категорий: ${res.created} (обработано позиций: ${res.total_lines}).`
          : `Дерево уже импортировано — новых категорий не добавлено (обработано позиций: ${res.total_lines}).`
      );
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка импорта");
    } finally { setBusy(false); }
  };

  // Ретроспективно назначить категории всем материалам без категории.
  // Идём пакетами по курсору after_id, накапливая прогресс.
  const handleRecategorize = async () => {
    if (recat.running) return;
    if (!confirm("Распространить категории на все материалы с такими же названиями? Категория берётся только от уже категоризированных материалов с точно таким же названием — без ошибочного подбора.")) return;
    setError("");
    setRecat({ running: true, total: 0, processed: 0, assigned: 0, doneMsg: "" });
    let afterId = 0;
    let total = 0;
    let processed = 0;
    let assigned = 0;
    let guard = 0;
    try {
       
      while (true) {
        guard++;
        if (guard > 100000) break; // страховка от бесконечного цикла
        const res = await api.material_categories.recategorize(afterId, 200);
        if (afterId === 0 && typeof res.total === "number") total = res.total;
        processed += res.batch;
        assigned  += res.assigned;
        afterId    = res.last_id;
        setRecat({ running: true, total, processed, assigned, doneMsg: "" });
        if (res.done || res.batch === 0) break;
      }
      const remaining = Math.max(0, total - assigned);
      setRecat({
        running: false, total, processed, assigned,
        doneMsg: `Категории обновлены. Назначено: ${assigned}, без категории осталось: ${remaining}.`,
      });
      load();
    } catch (e) {
      setRecat(prev => ({ ...prev, running: false }));
      setError(e instanceof Error ? e.message : "Ошибка назначения категорий");
    }
  };

  const handleAdd = async (parentId: number | null) => {
    const name = prompt(parentId ? "Название подкатегории:" : "Название корневой категории:");
    if (!name || !name.trim()) return;
    setError("");
    try {
      await api.material_categories.create({ name: name.trim(), parent_id: parentId });
      if (parentId) setExpanded(prev => new Set(prev).add(parentId));
      load();
    } catch (e) { setError(e instanceof Error ? e.message : "Ошибка"); }
  };

  const handleRename = async (cat: MaterialCategory) => {
    const name = prompt("Новое название:", cat.name);
    if (!name || !name.trim() || name.trim() === cat.name) return;
    setError("");
    try { await api.material_categories.rename(cat.id, name.trim()); load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Ошибка"); }
  };

  const handleDelete = async (cat: MaterialCategory) => {
    if (!confirm(`Удалить категорию «${cat.name}»?`)) return;
    setError("");
    try { await api.material_categories.remove(cat.id); load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Ошибка удаления"); }
  };

  const performMove = async (id: number, newParent: number | null) => {
    setError("");
    try {
      await api.material_categories.move(id, newParent);
      load();
    } catch (e) { setError(e instanceof Error ? e.message : "Ошибка перемещения"); }
  };

  const onDrop = (targetId: number | "root") => {
    if (dragId == null) return;
    const newParent = targetId === "root" ? null : targetId;
    // запрет на перемещение в себя/потомка
    if (newParent != null && (newParent === dragId || isDescendant(dragId, newParent))) {
      setError("Нельзя переместить категорию в саму себя или свою подкатегорию");
      setDragId(null); setDropTarget(null);
      return;
    }
    performMove(dragId, newParent);
    setDragId(null); setDropTarget(null);
  };

  const renderNode = (cat: MaterialCategory, depth: number) => {
    const kids = childrenMap.get(cat.id) || [];
    const hasKids = kids.length > 0;
    const isOpen = expanded.has(cat.id);
    const isDropHere = dropTarget === cat.id;
    return (
      <div key={cat.id}>
        <div
          draggable
          onDragStart={(e) => { setDragId(cat.id); e.dataTransfer.effectAllowed = "move"; }}
          onDragOver={(e) => { e.preventDefault(); if (dragId != null && dragId !== cat.id) setDropTarget(cat.id); }}
          onDragLeave={() => setDropTarget(t => (t === cat.id ? null : t))}
          onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onDrop(cat.id); }}
          className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[13px] transition-colors ${
            isDropHere ? "bg-primary/15 ring-1 ring-primary" : "hover:bg-secondary/60"
          } ${dragId === cat.id ? "opacity-40" : ""}`}
          style={{ paddingLeft: `${depth * 18 + 8}px` }}
        >
          {hasKids ? (
            <button type="button" onClick={() => toggle(cat.id)} className="shrink-0 text-muted-foreground hover:text-foreground">
              <Icon name={isOpen ? "ChevronDown" : "ChevronRight"} size={14} />
            </button>
          ) : <span className="w-3.5 shrink-0" />}
          <Icon name="GripVertical" size={12} className="text-muted-foreground/40 cursor-grab shrink-0" />
          <Icon name={hasKids ? "Folder" : "Tag"} size={13} className="text-muted-foreground shrink-0" />
          <span className="flex-1 truncate" title={cat.name}>{cat.name}</span>
          {cat.materials_count > 0 && (
            <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full shrink-0" title="Материалов в категории">
              {cat.materials_count}
            </span>
          )}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button onClick={() => handleAdd(cat.id)} title="Добавить подкатегорию"
              className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-primary">
              <Icon name="Plus" size={13} />
            </button>
            <button onClick={() => handleRename(cat)} title="Переименовать"
              className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground">
              <Icon name="Pencil" size={12} />
            </button>
            <button onClick={() => handleDelete(cat)} title="Удалить"
              className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-500">
              <Icon name="Trash2" size={12} />
            </button>
          </div>
        </div>
        {hasKids && isOpen && kids.map(k => renderNode(k, depth + 1))}
      </div>
    );
  };

  const roots = childrenMap.get(null) || [];

  // Кол-во материалов без категории = сумма по корню «Прочее» + материалы без category_id.
  // Для бейджа достаточно показать количество в категории «Прочее», если она есть.
  const otherCat = cats.find(c => c.parent_id === null && c.name.toLowerCase() === "прочее");
  const otherCount = otherCat?.materials_count ?? 0;

  return (
    <div className="space-y-4">
      {/* Переключатель видов */}
      <div className="flex items-center gap-1 border-b border-border">
        <button onClick={() => setView("tree")}
          className={`flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors ${
            view === "tree" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}>
          <Icon name="FolderTree" size={14} />
          Дерево категорий
        </button>
        <button onClick={() => setView("uncategorized")}
          className={`flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors ${
            view === "uncategorized" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}>
          <Icon name="Tags" size={14} />
          Материалы без категории
          {otherCount > 0 && (
            <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{otherCount}</span>
          )}
        </button>
      </div>

      {view === "uncategorized" && (
        <UncategorizedMaterials categories={cats} onAssigned={load} />
      )}

      {view === "tree" && (
      <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-[13px] text-hint">
          Перетаскивайте категории мышью, чтобы изменить родителя. {cats.length} категорий.
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canImport && (
            <button onClick={handleImport} disabled={busy || recat.running}
              className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-[13px] hover:bg-secondary transition-colors disabled:opacity-50">
              <Icon name={busy ? "Loader" : "Download"} size={14} className={busy ? "animate-spin" : ""} />
              Импортировать дерево
            </button>
          )}
          {canImport && (
            <button onClick={handleRecategorize} disabled={recat.running || busy}
              className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-[13px] hover:bg-secondary transition-colors disabled:opacity-50">
              <Icon name={recat.running ? "Loader" : "Wand2"} size={14} className={recat.running ? "animate-spin" : ""} />
              Назначить категории всем счетам
            </button>
          )}
          <button onClick={() => handleAdd(null)}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors">
            <Icon name="Plus" size={14} />
            Добавить категорию
          </button>
        </div>
      </div>

      {/* Прогресс ретроспективного назначения категорий */}
      {(recat.running || recat.doneMsg) && (
        <div className="px-4 py-3 bg-primary/5 border border-primary/20 rounded-lg space-y-2">
          {recat.running ? (
            <>
              <div className="flex items-center gap-2 text-[13px] text-foreground">
                <Icon name="Loader" size={14} className="animate-spin text-primary shrink-0" />
                <span>
                  Обработано {recat.processed}{recat.total ? ` из ${recat.total}` : ""} материалов · назначено {recat.assigned}
                </span>
              </div>
              {recat.total > 0 && (
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-primary transition-all"
                    style={{ width: `${Math.min(100, Math.round((recat.processed / recat.total) * 100))}%` }} />
                </div>
              )}
            </>
          ) : (
            <div className="flex items-start gap-2 text-[13px] text-emerald-700">
              <Icon name="CheckCircle2" size={14} className="text-emerald-600 shrink-0 mt-0.5" />
              <span className="flex-1">{recat.doneMsg}</span>
              <button onClick={() => setRecat(p => ({ ...p, doneMsg: "" }))} className="text-emerald-400 hover:text-emerald-700">
                <Icon name="X" size={13} />
              </button>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <Icon name="AlertCircle" size={14} className="text-red-500 shrink-0 mt-0.5" />
          <span className="text-[12px] text-red-700 flex-1">{error}</span>
          <button onClick={() => setError("")} className="text-red-400 hover:text-red-600"><Icon name="X" size={13} /></button>
        </div>
      )}

      <div
        className={`bg-white rounded-xl border p-2 min-h-[300px] ${dropTarget === "root" ? "border-primary ring-1 ring-primary" : "border-border"}`}
        onDragOver={(e) => { e.preventDefault(); if (dragId != null) setDropTarget("root"); }}
        onDrop={(e) => { e.preventDefault(); onDrop("root"); }}
      >
        {loading ? (
          <div className="space-y-2 p-2">
            {[1,2,3,4,5].map(i => <div key={i} className="h-8 bg-secondary/40 rounded animate-pulse" />)}
          </div>
        ) : roots.length === 0 ? (
          <div className="py-12 text-center text-hint">
            <Icon name="FolderTree" size={28} className="mx-auto mb-2 opacity-40" />
            <div className="text-[13px]">Категорий пока нет</div>
            {canImport && (
              <button onClick={handleImport} disabled={busy} className="mt-2 text-primary text-[13px] hover:underline">
                Импортировать стандартное дерево
              </button>
            )}
          </div>
        ) : (
          <>
            {dragId != null && (
              <div className="text-[11px] text-hint px-2 py-1 mb-1">
                Перетащите сюда (в пустое место), чтобы сделать категорию корневой
              </div>
            )}
            {roots.map(r => renderNode(r, 0))}
          </>
        )}
      </div>
      </div>
      )}
    </div>
  );
}