import { useEffect, useMemo, useState } from "react";
import { api, MaterialCategory, UncategorizedMaterial } from "@/lib/api";
import Icon from "@/components/ui/icon";
import CategoryTreeSelect, { buildCategoryPath } from "./CategoryTreeSelect";

interface Props {
  categories: MaterialCategory[];
  /** Вызывается после любого назначения, чтобы родитель обновил счётчики/дерево. */
  onAssigned: () => void;
}

export default function UncategorizedMaterials({ categories, onAssigned }: Props) {
  const [items, setItems] = useState<UncategorizedMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busyId, setBusyId] = useState<number | null>(null);
  const [bulkCat, setBulkCat] = useState<number | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [info, setInfo] = useState("");
  // id материала, для которого открыт инлайн-выбор категории (быстрое назначение)
  const [pickFor, setPickFor] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    api.material_categories.uncategorized()
      .then(setItems)
      .catch(e => setError(e instanceof Error ? e.message : "Ошибка загрузки"))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(m => m.name.toLowerCase().includes(q));
  }, [items, search]);

  const allVisibleSelected = filtered.length > 0 && filtered.every(m => selected.has(m.id));

  const toggleOne = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelected(prev => {
      const next = new Set(prev);
      if (allVisibleSelected) filtered.forEach(m => next.delete(m.id));
      else filtered.forEach(m => next.add(m.id));
      return next;
    });
  };

  // Назначить категорию набору материалов; после — убрать их из списка локально.
  const assign = async (ids: number[], catId: number | null) => {
    if (!ids.length || !catId) return;
    setError(""); setInfo("");
    try {
      const res = await api.material_categories.assign(ids, catId);
      const path = buildCategoryPath(categories, catId) || "категория";
      setInfo(
        res.inherited > 0
          ? `Назначено «${path}»: ${res.directly}. Авто-наследование по совпадению названий: +${res.inherited}. Всего: ${res.total}.`
          : `Назначено «${path}»: ${res.directly}.`
      );
      onAssigned();
      load();           // перезагружаем — наследованные тоже исчезнут из списка
      setSelected(new Set());
      setPickFor(null);
      setBulkCat(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка назначения");
    }
  };

  const handleQuickAssign = async (id: number, catId: number | null) => {
    setBusyId(id);
    try { await assign([id], catId); }
    finally { setBusyId(null); }
  };

  const handleBulkAssign = async () => {
    if (!bulkCat || selected.size === 0) return;
    setBulkBusy(true);
    try { await assign(Array.from(selected), bulkCat); }
    finally { setBulkBusy(false); }
  };

  const createCategory = async (name: string): Promise<number | null> => {
    try {
      const res = await api.material_categories.create({ name, parent_id: null });
      onAssigned(); // чтобы родитель подтянул свежее дерево категорий
      return res.id;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось создать категорию");
      return null;
    }
  };

  return (
    <div className="space-y-3">
      {/* Панель управления */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Icon name="Search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Поиск материала..."
            className="w-full border border-border rounded-lg pl-8 pr-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
        </div>
        <div className="text-[13px] text-hint shrink-0">
          {loading ? "загрузка..." : `${filtered.length} материалов без категории`}
        </div>
      </div>

      {/* Массовое назначение */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 flex-wrap bg-primary/5 border border-primary/20 rounded-lg px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-[13px] font-medium shrink-0">
            <Icon name="CheckSquare" size={14} className="text-primary" />
            Выбрано: {selected.size}
          </div>
          <div className="w-64 max-w-full">
            <CategoryTreeSelect
              categories={categories}
              value={bulkCat}
              onChange={setBulkCat}
              onCreate={createCategory}
              placeholder="Категория для всех выбранных"
              allowEmpty={false}
            />
          </div>
          <button onClick={handleBulkAssign} disabled={!bulkCat || bulkBusy}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
            <Icon name={bulkBusy ? "Loader" : "Check"} size={14} className={bulkBusy ? "animate-spin" : ""} />
            Назначить выбранным
          </button>
          <button onClick={() => setSelected(new Set())}
            className="text-[12px] text-muted-foreground hover:text-foreground underline">
            Сбросить
          </button>
        </div>
      )}

      {info && (
        <div className="px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2">
          <Icon name="CheckCircle2" size={14} className="text-emerald-600 shrink-0 mt-0.5" />
          <span className="text-[12px] text-emerald-700 flex-1">{info}</span>
          <button onClick={() => setInfo("")} className="text-emerald-400 hover:text-emerald-700"><Icon name="X" size={13} /></button>
        </div>
      )}
      {error && (
        <div className="px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <Icon name="AlertCircle" size={14} className="text-red-500 shrink-0 mt-0.5" />
          <span className="text-[12px] text-red-700 flex-1">{error}</span>
          <button onClick={() => setError("")} className="text-red-400 hover:text-red-600"><Icon name="X" size={13} /></button>
        </div>
      )}

      {/* Список материалов */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="space-y-2 p-3">
            {[1,2,3,4,5].map(i => <div key={i} className="h-9 bg-secondary/40 rounded animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-hint">
            <Icon name="CheckCircle2" size={28} className="mx-auto mb-2 text-emerald-400" />
            <div className="text-[13px]">{items.length === 0 ? "Все материалы категоризированы!" : "Ничего не найдено"}</div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-secondary/30 text-[12px] text-muted-foreground">
              <button onClick={toggleAllVisible} className="flex items-center gap-1.5 hover:text-foreground">
                <Icon name={allVisibleSelected ? "CheckSquare" : "Square"} size={14} />
                Выбрать все ({filtered.length})
              </button>
            </div>
            <div className="divide-y divide-border max-h-[60vh] overflow-y-auto">
              {filtered.map(m => {
                const isSel = selected.has(m.id);
                const isPicking = pickFor === m.id;
                return (
                  <div key={m.id} className={`px-3 py-2.5 ${isSel ? "bg-primary/5" : "hover:bg-secondary/30"} transition-colors`}>
                    <div className="flex items-center gap-2.5">
                      <button onClick={() => toggleOne(m.id)} className="shrink-0 text-muted-foreground hover:text-primary">
                        <Icon name={isSel ? "CheckSquare" : "Square"} size={16} className={isSel ? "text-primary" : ""} />
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] truncate" title={m.name}>{m.name}</div>
                        <div className="text-[11px] text-hint">
                          {m.unit}{m.usage_count > 0 ? ` · в счетах: ${m.usage_count}` : ""}
                        </div>
                      </div>
                      {!isPicking ? (
                        <button onClick={() => setPickFor(m.id)} disabled={busyId === m.id}
                          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-[12px] hover:bg-secondary transition-colors disabled:opacity-50">
                          {busyId === m.id
                            ? <Icon name="Loader" size={13} className="animate-spin" />
                            : <Icon name="FolderPlus" size={13} />}
                          Назначить категорию
                        </button>
                      ) : (
                        <button onClick={() => setPickFor(null)}
                          className="shrink-0 text-muted-foreground hover:text-foreground">
                          <Icon name="X" size={15} />
                        </button>
                      )}
                    </div>
                    {isPicking && (
                      <div className="mt-2 pl-8">
                        <CategoryTreeSelect
                          categories={categories}
                          value={null}
                          onChange={(catId) => handleQuickAssign(m.id, catId)}
                          onCreate={createCategory}
                          placeholder="Выберите категорию из дерева..."
                          allowEmpty={false}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
