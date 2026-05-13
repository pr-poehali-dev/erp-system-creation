import { useState, useEffect } from "react";

export const PAGER_SIZE = 25;

export interface PaginationResult<T> {
  page: number;
  totalPages: number;
  pageItems: T[];
  setPage: (p: number) => void;
  Pager: JSX.Element | null;
}

export function usePagination<T>(items: T[]): PaginationResult<T> {
  const [page, setPageRaw] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / PAGER_SIZE));

  // Сброс на первую страницу при смене набора данных
  useEffect(() => {
    setPageRaw(p => Math.min(p, Math.max(1, Math.ceil(items.length / PAGER_SIZE))));
  }, [items.length]);

  const setPage = (p: number) => setPageRaw(Math.max(1, Math.min(p, totalPages)));
  const pageItems = items.slice((page - 1) * PAGER_SIZE, page * PAGER_SIZE);

  const nums: (number | "…")[] = totalPages <= 1 ? [] :
    Array.from({ length: totalPages }, (_, i) => i + 1)
      .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
      .reduce<(number | "…")[]>((acc, p, i, arr) => {
        if (i > 0 && typeof arr[i - 1] === "number" && (p as number) - (arr[i - 1] as number) > 1) acc.push("…");
        acc.push(p);
        return acc;
      }, []);

  const Pager = totalPages <= 1 ? null : (
    <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-secondary/20 text-[12px]">
      <span className="text-muted-foreground">
        {(page - 1) * PAGER_SIZE + 1}–{Math.min(page * PAGER_SIZE, items.length)} из {items.length}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => setPage(page - 1)} disabled={page === 1}
          className="px-2.5 py-1 rounded border border-border bg-white hover:bg-secondary disabled:opacity-40 transition-colors"
        >←</button>
        {nums.map((p, i) =>
          p === "…"
            ? <span key={`e${i}`} className="px-1 text-muted-foreground">…</span>
            : <button
                key={p}
                onClick={() => setPage(p as number)}
                className={`px-2.5 py-1 rounded border transition-colors ${page === p ? "bg-primary text-white border-primary" : "border-border bg-white hover:bg-secondary"}`}
              >{p}</button>
        )}
        <button
          onClick={() => setPage(page + 1)} disabled={page === totalPages}
          className="px-2.5 py-1 rounded border border-border bg-white hover:bg-secondary disabled:opacity-40 transition-colors"
        >→</button>
      </div>
    </div>
  );

  return { page, totalPages, pageItems, setPage, Pager };
}
