import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { Portfolio } from '../types';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { LayersIcon, PlusIcon, TrashIcon } from '../components/icons';
import { Modal } from '../components/Modal';
import { Pagination } from '../components/Pagination';
import { PortfolioImportForm } from '../components/PortfolioImportForm';
import { usePagination } from '../pagination';
import { useToast } from '../components/Toast';

const PORTFOLIOS_PER_PAGE = 10;

type PortfolioSort = 'NEWEST' | 'OLDEST' | 'NAME' | 'MOST_ALARMS';

const SORT_LABELS: Record<PortfolioSort, string> = {
  NEWEST: 'Newest',
  OLDEST: 'Oldest',
  NAME: 'Name A–Z',
  MOST_ALARMS: 'Most alarms',
};

// numeric: "Extra 2" before "Extra 10".
const byName = (a: Portfolio, b: Portfolio) =>
  a.name.localeCompare(b.name, undefined, { numeric: true });

const COMPARATORS: Record<
  PortfolioSort,
  (a: Portfolio, b: Portfolio) => number
> = {
  NEWEST: (a, b) => b.createdAt.localeCompare(a.createdAt) || byName(a, b),
  OLDEST: (a, b) => a.createdAt.localeCompare(b.createdAt) || byName(a, b),
  NAME: byName,
  MOST_ALARMS: (a, b) => b.alarmCount - a.alarmCount || byName(a, b),
};

export function PortfoliosPage() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Portfolio | null>(null);
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<PortfolioSort>('NEWEST');
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return portfolios
      .filter((p) => p.name.toLowerCase().includes(needle))
      .sort(COMPARATORS[sort]);
  }, [portfolios, search, sort]);
  const pagination = usePagination(
    visible,
    PORTFOLIOS_PER_PAGE,
    `${search.trim()}|${sort}`,
  );

  async function loadPortfolios() {
    setError(null);
    try {
      setPortfolios(await api.get<Portfolio[]>('/portfolios'));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load portfolios',
      );
    }
  }

  useEffect(() => {
    loadPortfolios().finally(() => setLoading(false));
  }, []);

  function handleCreated(created: Portfolio) {
    setPortfolios((prev) => [created, ...prev]);
    setImporting(false);
    showSuccess(
      `Portfolio "${created.name}" created with ${created.alarmCount} ${created.alarmCount === 1 ? 'alarm' : 'alarms'}.`,
    );
  }

  async function handleDelete(portfolio: Portfolio) {
    try {
      await api.delete(`/portfolios/${portfolio.id}`);
      setPortfolios((prev) => prev.filter((p) => p.id !== portfolio.id));
      showSuccess(`Portfolio "${portfolio.name}" and its alarms deleted.`);
    } catch (err) {
      showError(
        err instanceof Error ? err.message : 'Failed to delete portfolio',
      );
    }
  }

  return (
    <div className="page-stack">
      <section>
        <div className="section-header">
          <div>
            <h2>Portfolios</h2>
            <p className="text-muted admin-subtitle">
              Create many alarms at once from a table of tickers.
            </p>
          </div>
          <div className="section-header-actions">
            <span className="tag">
              {visible.length === portfolios.length
                ? `${portfolios.length} ${portfolios.length === 1 ? 'portfolio' : 'portfolios'}`
                : `${visible.length} of ${portfolios.length} portfolios`}
            </span>
            <button
              type="button"
              className="new-alarm-trigger portfolio-import-trigger"
              onClick={() => setImporting(true)}
            >
              <PlusIcon />
              Import portfolio
            </button>
          </div>
        </div>

        {loading && <p className="text-muted">Loading…</p>}
        {error && <p className="error-text">{error}</p>}

        {!loading && !error && portfolios.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">
              <LayersIcon size={22} />
            </div>
            <h3>No portfolios yet</h3>
            <p>
              Import a CSV of tickers to create a whole set of buy/sell alarms
              in one go.
            </p>
          </div>
        )}

        {!loading && !error && portfolios.length > 0 && (
          <div className="filters-bar">
            <input
              type="search"
              className={
                search.trim() ? 'filter-search is-active' : 'filter-search'
              }
              placeholder="Search name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search portfolios by name"
            />
            <select
              className={
                sort !== 'NEWEST' ? 'filter-select is-active' : 'filter-select'
              }
              value={sort}
              onChange={(e) => setSort(e.target.value as PortfolioSort)}
              aria-label="Sort portfolios"
            >
              {Object.entries(SORT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  Sort: {label}
                </option>
              ))}
            </select>
          </div>
        )}

        {!loading &&
          !error &&
          portfolios.length > 0 &&
          visible.length === 0 && (
            <div className="empty-state">
              <h3>No portfolios match "{search.trim()}"</h3>
              <p>Try another name or clear the search.</p>
            </div>
          )}

        {!loading && !error && visible.length > 0 && (
          <ul className="portfolio-list">
            {pagination.pageItems.map((p) => (
              <li key={p.id} className="card portfolio-row">
                <div>
                  <div className="portfolio-name">{p.name}</div>
                  <div className="portfolio-meta">
                    <span className="mono">{p.alarmCount}</span>{' '}
                    {p.alarmCount === 1 ? 'alarm' : 'alarms'} · created{' '}
                    {new Date(p.createdAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                </div>
                <div className="portfolio-actions">
                  <button
                    type="button"
                    onClick={() =>
                      navigate(`/alarms?portfolio=${encodeURIComponent(p.id)}`)
                    }
                  >
                    View alarms
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => setPendingDelete(p)}
                  >
                    <TrashIcon size={13} />
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Pagination state={pagination} itemLabel="portfolios" />
      </section>

      {importing && (
        <Modal
          title="Import portfolio"
          wide
          onClose={() => setImporting(false)}
        >
          <PortfolioImportForm onCreated={handleCreated} />
        </Modal>
      )}
      {pendingDelete && (
        <ConfirmDialog
          title="Delete portfolio"
          message={`Delete "${pendingDelete.name}"? This also deletes its ${pendingDelete.alarmCount} ${pendingDelete.alarmCount === 1 ? 'alarm' : 'alarms'}, including any that already triggered. This can't be undone.`}
          confirmLabel="Delete"
          danger
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            handleDelete(pendingDelete);
            setPendingDelete(null);
          }}
        />
      )}
    </div>
  );
}
