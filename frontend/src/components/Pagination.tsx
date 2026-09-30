import { pageWindow, type PageState } from '../pagination';

interface Props {
  state: PageState<unknown>;
  // Plural noun for the range label, e.g. "tickers" -> "11–20 of 34 tickers".
  itemLabel: string;
}

export function Pagination({ state, itemLabel }: Props) {
  const { page, pageCount, from, to, total } = state;
  if (pageCount <= 1) return null;

  function goTo(next: number) {
    state.setPage(next);
    // The list above just changed under the user; start them at its top.
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <nav className="pagination" aria-label="Pagination">
      <span className="pagination-range text-muted">
        {from}–{to} of {total} {itemLabel}
      </span>
      <div className="pagination-pages">
        <button
          type="button"
          onClick={() => goTo(page - 1)}
          disabled={page === 1}
          aria-label="Previous page"
        >
          ‹ Prev
        </button>
        {pageWindow(page, pageCount).map((p, i) =>
          p === null ? (
            <span key={`gap-${i}`} className="pagination-gap">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              className={p === page ? 'is-current' : undefined}
              onClick={() => goTo(p)}
              aria-current={p === page ? 'page' : undefined}
            >
              {p}
            </button>
          ),
        )}
        <button
          type="button"
          onClick={() => goTo(page + 1)}
          disabled={page === pageCount}
          aria-label="Next page"
        >
          Next ›
        </button>
      </div>
    </nav>
  );
}
