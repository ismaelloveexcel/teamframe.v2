import { useMemo, useState } from "react";

const PAGE_SIZE = 10;

/**
 * Client-side search + pagination over an already-fetched array. List endpoints
 * currently return plain arrays (no server pagination), so we slice locally; the
 * API layer still forwards limit/offset so this upgrades cleanly later.
 */
export function usePaginatedList<T>(
  items: T[],
  matches: (item: T, query: string) => boolean,
  pageSize = PAGE_SIZE,
) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => matches(i, q));
  }, [items, query, matches]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageItems = useMemo(
    () => filtered.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filtered, safePage, pageSize],
  );

  return {
    query,
    setQuery: (q: string) => {
      setQuery(q);
      setPage(1);
    },
    page: safePage,
    setPage,
    pageCount,
    total: filtered.length,
    pageItems,
  };
}
