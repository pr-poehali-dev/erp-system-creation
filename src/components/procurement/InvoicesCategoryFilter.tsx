import { MaterialCategory } from "@/lib/api";
import Icon from "@/components/ui/icon";
import CategoryTreeSelect from "./CategoryTreeSelect";

export type CatFilter = { kind: "all" | "id" | "none" | "other"; id: number | null };

interface Props {
  categories: MaterialCategory[];
  catFilter: CatFilter;
  setCatFilter: (f: CatFilter) => void;
}

export default function InvoicesCategoryFilter({ categories, catFilter, setCatFilter }: Props) {
  return (
    <div className="flex items-center gap-2 flex-wrap bg-white border border-border rounded-xl px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[13px] text-hint shrink-0">
        <Icon name="FolderTree" size={14} />
        Категория:
      </div>
      <div className="w-72 max-w-full">
        <CategoryTreeSelect
          categories={categories}
          value={catFilter.kind === "id" ? catFilter.id : null}
          placeholder="Все категории"
          onChange={(id) => setCatFilter(id ? { kind: "id", id } : { kind: "all", id: null })}
        />
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <button onClick={() => setCatFilter({ kind: "all", id: null })}
          className={`text-[12px] px-3 py-1.5 rounded-lg border transition-colors ${catFilter.kind === "all" ? "bg-primary/10 border-primary text-primary font-medium" : "border-border text-muted-foreground hover:bg-secondary"}`}>
          Все
        </button>
        <button onClick={() => setCatFilter({ kind: "none", id: null })}
          className={`text-[12px] px-3 py-1.5 rounded-lg border transition-colors ${catFilter.kind === "none" ? "bg-amber-100 border-amber-300 text-amber-700 font-medium" : "border-border text-muted-foreground hover:bg-secondary"}`}>
          Без категории
        </button>
        <button onClick={() => setCatFilter({ kind: "other", id: null })}
          className={`text-[12px] px-3 py-1.5 rounded-lg border transition-colors ${catFilter.kind === "other" ? "bg-primary/10 border-primary text-primary font-medium" : "border-border text-muted-foreground hover:bg-secondary"}`}>
          Прочее
        </button>
      </div>
    </div>
  );
}
