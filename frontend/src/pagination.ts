import { useState } from 'react';

export interface PageState<T> {
  pageItems: T[];
  // 1-based, always within [1, pageCount].
  page: number;
  pageCount: number;
  setPage: (page: number) => void;
  // 1-based index of the first/last item on this page, for "11–20 of 34".
  from: number;
  to: number;
  total: number;
}

// Client-side pagination over an already-fetched list (every list in this
// app is fetched whole). `resetKey` returns to page 1 whenever it changes —
// pass the active filters, so narrowing the list never strands the user on
// an empty or unrelated page.
export function usePagination<T>(
  items: T[],
  pageSize: number,
  resetKey = '',
): PageState<T> {
  const [requested, setRequested] = useState(1);
  const [lastResetKey, setLastResetKey] = useState(resetKey);

  // Adjusting state during render (not in an effect) is React's
  // recommended way to reset on a prop change: no extra render with the
  // stale page.
  let current = requested;
  if (resetKey !== lastResetKey) {
    setLastResetKey(resetKey);
    setRequested(1);
    current = 1;
  }

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  // Derived, not stored: deleting the last item on the last page just shows
  // the new last page.
  const page = Math.min(current, pageCount);
  const start = (page - 1) * pageSize;

  return {
    pageItems: items.slice(start, start + pageSize),
    page,
    pageCount,
    setPage: (next) => setRequested(Math.min(Math.max(1, next), pageCount)),
    from: items.length === 0 ? 0 : start + 1,
    to: Math.min(start + pageSize, items.length),
    total: items.length,
  };
}

// Page numbers to render: always the first and last page, plus the current
// one and its neighbours; `null` marks a gap ("…"). E.g. page 5 of 9 ->
// [1, null, 4, 5, 6, null, 9].
export function pageWindow(page: number, pageCount: number): (number | null)[] {
  const pages = new Set(
    [1, pageCount, page - 1, page, page + 1].filter(
      (p) => p >= 1 && p <= pageCount,
    ),
  );
  const sorted = [...pages].sort((a, b) => a - b);
  const result: (number | null)[] = [];
  sorted.forEach((p, i) => {
    const prev = sorted[i - 1];
    if (prev !== undefined && p - prev === 2) result.push(prev + 1);
    else if (prev !== undefined && p - prev > 2) result.push(null);
    result.push(p);
  });
  return result;
}
