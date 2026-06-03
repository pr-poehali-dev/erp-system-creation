import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import { MaterialCategory } from "@/lib/api";

interface Props {
  categories: MaterialCategory[];
  value: number | null;
  onChange: (id: number | null) => void;
  placeholder?: string;
  allowEmpty?: boolean;
}

/** Строит путь категории вида "Металлопрокат / Арматура рифленная" */
export function buildCategoryPath(categories: MaterialCategory[], id: number | null): string {
  if (!id) return "";
  const byId = new Map(categories.map(c => [c.id, c]));
  const parts: string[] = [];
  let cur = byId.get(id);
  let guard = 0;
  while (cur && guard < 20) {
    parts.unshift(cur.name);
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
    guard++;
  }
  return parts.join(" / ");
}

export default function CategoryTreeSelect({ categories, value, onChange, placeholder = "Выберите категорию", allowEmpty = true }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const childrenMap = useMemo(() => {
    const m = new Map<number | null, MaterialCategory[]>();
    categories.forEach(c => {
      const key = c.parent_id;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(c);
    });
    m.forEach(list => list.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)));
    return m;
  }, [categories]);

  // При поиске — плоский список совпадений с путём
  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    return categories
      .filter(c => c.name.toLowerCase().includes(q))
      .slice(0, 50)
      .map(c => ({ id: c.id, path: buildCategoryPath(categories, c.id) }));
  }, [search, categories]);

  const toggle = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const pick = (id: number | null) => { onChange(id); setOpen(false); setSearch(""); };

  const renderNode = (cat: MaterialCategory, depth: number) => {
    const kids = childrenMap.get(cat.id) || [];
    const hasKids = kids.length > 0;
    const isOpen = expanded.has(cat.id);
    return (
      <div key={cat.id}>
        <div className={`flex items-center gap-1 px-2 py-1.5 rounded cursor-pointer hover:bg-secondary text-[13px] ${value === cat.id ? "bg-primary/10 text-primary font-medium" : ""}`}
          style={{ paddingLeft: `${depth * 14 + 8}px` }}>
          {hasKids ? (
            <button type="button" onClick={(e) => { e.stopPropagation(); toggle(cat.id); }} className="shrink-0 text-muted-foreground">
              <Icon name={isOpen ? "ChevronDown" : "ChevronRight"} size={13} />
            </button>
          ) : <span className="w-[13px] shrink-0" />}
          <span className="flex-1 truncate" onClick={() => pick(cat.id)}>{cat.name}</span>
        </div>
        {hasKids && isOpen && kids.map(k => renderNode(k, depth + 1))}
      </div>
    );
  };

  const roots = childrenMap.get(null) || [];
  const selectedPath = buildCategoryPath(categories, value);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full border border-border rounded-lg px-3 py-2 text-[13px] bg-white outline-none focus:ring-1 focus:ring-primary flex items-center justify-between gap-2 text-left">
        <span className={`truncate ${selectedPath ? "" : "text-hint"}`}>{selectedPath || placeholder}</span>
        <Icon name="ChevronsUpDown" size={14} className="text-muted-foreground shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-border rounded-lg shadow-xl max-h-[340px] overflow-hidden flex flex-col">
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Icon name="Search" size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск категории..."
                className="w-full border border-border rounded-md pl-7 pr-2 py-1.5 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>
          <div className="overflow-y-auto p-1">
            {allowEmpty && !search && (
              <div onClick={() => pick(null)}
                className={`px-2 py-1.5 rounded cursor-pointer hover:bg-secondary text-[13px] text-hint ${value === null ? "bg-primary/10 text-primary" : ""}`}>
                — Без категории —
              </div>
            )}
            {searchResults ? (
              searchResults.length === 0
                ? <div className="px-2 py-4 text-center text-hint text-[12px]">Ничего не найдено</div>
                : searchResults.map(r => (
                    <div key={r.id} onClick={() => pick(r.id)}
                      className={`px-2 py-1.5 rounded cursor-pointer hover:bg-secondary text-[13px] ${value === r.id ? "bg-primary/10 text-primary font-medium" : ""}`}>
                      {r.path}
                    </div>
                  ))
            ) : (
              roots.map(r => renderNode(r, 0))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
