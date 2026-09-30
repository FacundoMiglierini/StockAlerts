import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Portfolio } from '../types';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { LayersIcon, PlusIcon, TrashIcon } from '../components/icons';
import { Modal } from '../components/Modal';
import { PortfolioImportForm } from '../components/PortfolioImportForm';
import { useToast } from '../components/Toast';

export function PortfoliosPage() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Portfolio | null>(null);
  const { showSuccess, showError } = useToast();

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
              {portfolios.length}{' '}
              {portfolios.length === 1 ? 'portfolio' : 'portfolios'}
            </span>
            <button
              type="button"
              className="new-alarm-trigger"
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
          <ul className="portfolio-list">
            {portfolios.map((p) => (
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
                <button
                  type="button"
                  className="danger"
                  onClick={() => setPendingDelete(p)}
                >
                  <TrashIcon size={13} />
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
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
