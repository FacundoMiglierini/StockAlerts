import { useMemo, useState } from 'react';
import type { Alarm, NotificationStatus } from '../types';
import {
  STRATEGY_LABELS,
  STRATEGY_FIELDS,
  PRICE_FIELD_NAMES,
} from '../strategies';
import { MARKET_LABELS, CURRENCY_SYMBOLS } from '../markets';
import {
  TrashIcon,
  EmptyAlarmsIcon,
  ClockIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  LayersIcon,
} from './icons';
import { ConfirmDialog } from './ConfirmDialog';
import { Pagination } from './Pagination';
import { SortControl } from './SortControl';
import { sortItems, type SortField, type SortState } from '../sorting';
import { usePagination } from '../pagination';

interface Props {
  alarms: Alarm[];
  onSetStatus: (id: string, status: 'ACTIVE' | 'DISABLED') => void;
  onEdit: (alarm: Alarm) => void;
  onDelete: (id: string) => void;
  // Portfolio id -> name, for tagging alarms that came from an import.
  portfolioNames: Map<string, string>;
  // Expand every group regardless of what the user toggled — AlarmsPage
  // sets it while a ticker search is active, so matches are visible at once.
  forceExpanded: boolean;
  // Changes whenever the filters do, sending pagination back to page 1.
  paginationKey: string;
}

// Paginates tickers, not alarms, so one ticker's ladder never splits
// across pages.
const TICKERS_PER_PAGE = 10;

interface ParamStat {
  label: string;
  value: string;
}

// One ticker on one market: the same ticker string can be a different
// security on another market (see root CLAUDE.md), so both form the key.
interface AlarmGroup {
  key: string;
  ticker: string;
  market: Alarm['market'];
  // Sorted: price thresholds by trigger (highest first, like a ladder),
  // then every other strategy, newest first.
  alarms: Alarm[];
  // Alarm id -> 1-based ladder step, for MANUAL_THRESHOLD alarms only.
  steps: Map<string, number>;
  portfolioIds: string[];
  // Counts for the header summary and the "Needs attention" sort.
  selling: number;
  triggered: number;
  disabled: number;
  // createdAt of the group's newest alarm (ISO strings sort as dates).
  newest: string;
}

type GroupSortField = 'TICKER' | 'ATTENTION' | 'CREATED' | 'ALARMS';

// numeric: X2 before X10.
const byTicker = (a: AlarmGroup, b: AlarmGroup) =>
  a.ticker.localeCompare(b.ticker, undefined, { numeric: true }) ||
  a.market.localeCompare(b.market);

// Whole groups are sorted, never alarms across groups, so a ladder stays
// together; ties fall back to ticker A → Z (see sortItems).
const GROUP_SORT_FIELDS: Record<GroupSortField, SortField<AlarmGroup>> = {
  TICKER: {
    label: 'Ticker',
    kind: 'text',
    defaultDir: 'asc',
    compare: byTicker,
  },
  // Triggered alarms and open positions (waiting to sell) are what the
  // user has to act on or watch.
  ATTENTION: {
    label: 'Needs attention',
    kind: 'number',
    defaultDir: 'desc',
    compare: (a, b) => a.triggered + a.selling - (b.triggered + b.selling),
  },
  CREATED: {
    label: 'Created',
    kind: 'date',
    defaultDir: 'desc',
    compare: (a, b) => a.newest.localeCompare(b.newest),
  },
  ALARMS: {
    label: 'Alarm count',
    kind: 'number',
    defaultDir: 'desc',
    compare: (a, b) => a.alarms.length - b.alarms.length,
  },
};

const INITIAL_SORT: SortState<GroupSortField> = { field: 'TICKER', dir: 'asc' };

function paramStats(alarm: Alarm): ParamStat[] {
  const currency = CURRENCY_SYMBOLS[alarm.market];
  const fields = STRATEGY_FIELDS[alarm.strategyType];
  // Follow the strategy's field order, not the stored one: Postgres jsonb
  // reorders keys (shortest first), which would put target before trigger.
  const rank = (key: string) => {
    const index = fields.findIndex((f) => f.name === key);
    return index === -1 ? fields.length : index;
  };
  const entries = Object.entries(alarm.params).sort(
    ([a], [b]) => rank(a) - rank(b),
  );
  return entries.map(([key, value]) => {
    const label =
      alarm.strategyType === 'MANUAL_THRESHOLD'
        ? key === 'trigger'
          ? 'Buy at'
          : 'Sell at'
        : (fields.find((f) => f.name === key)?.label ?? key);
    return {
      label,
      value: PRICE_FIELD_NAMES.has(key)
        ? `${currency}${value.toLocaleString(undefined, { maximumFractionDigits: 6 })}`
        : String(value),
    };
  });
}

function groupAlarms(alarms: Alarm[]): AlarmGroup[] {
  const byKey = new Map<string, Alarm[]>();
  for (const alarm of alarms) {
    const key = `${alarm.market}:${alarm.ticker}`;
    byKey.set(key, [...(byKey.get(key) ?? []), alarm]);
  }

  return [...byKey.entries()].map(([key, members]) => {
    const thresholds = members
      .filter((a) => a.strategyType === 'MANUAL_THRESHOLD')
      .sort((a, b) => b.params.trigger - a.params.trigger);
    const others = members
      .filter((a) => a.strategyType !== 'MANUAL_THRESHOLD')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return {
      key,
      ticker: members[0].ticker,
      market: members[0].market,
      alarms: [...thresholds, ...others],
      steps: new Map(thresholds.map((a, index) => [a.id, index + 1])),
      portfolioIds: [
        ...new Set(
          members.flatMap((a) => (a.portfolioId ? [a.portfolioId] : [])),
        ),
      ],
      selling: members.filter(
        (a) =>
          a.strategyType === 'MANUAL_THRESHOLD' &&
          a.status === 'ACTIVE' &&
          a.notificationStatus === 'NOTIFIED_ONCE',
      ).length,
      triggered: members.filter((a) => a.status === 'TRIGGERED').length,
      disabled: members.filter((a) => a.status === 'DISABLED').length,
      newest: members.reduce(
        (max, a) => (a.createdAt > max ? a.createdAt : max),
        '',
      ),
    };
  });
}

function formatTriggeredAt(triggeredAt: string): string {
  return new Date(triggeredAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const NOTIFICATION_LABELS: Record<NotificationStatus, string> = {
  NOT_NOTIFIED: 'Not yet notified',
  NOTIFIED_ONCE: 'Notified once',
  NOTIFIED_TWICE: 'Notified twice',
};

// MANUAL_THRESHOLD's two phases (see worker/strategies/manual_threshold.py):
// NOT_NOTIFIED watches the trigger, NOTIFIED_ONCE watches the target.
const PHASE_LABELS: Record<NotificationStatus, string> = {
  NOT_NOTIFIED: 'Waiting to buy',
  NOTIFIED_ONCE: 'Waiting to sell',
  NOTIFIED_TWICE: 'Sold',
};

function NotificationStatusTag({ alarm }: { alarm: Alarm }) {
  const status = alarm.notificationStatus;
  const labels =
    alarm.strategyType === 'MANUAL_THRESHOLD'
      ? PHASE_LABELS
      : NOTIFICATION_LABELS;
  return (
    <span
      className={`notification-status ${status !== 'NOT_NOTIFIED' ? 'is-notified' : ''}`}
    >
      {status === 'NOT_NOTIFIED' ? <ClockIcon /> : <CheckCircleIcon />}
      {labels[status]}
    </span>
  );
}

function StatusBadge({ status }: { status: Alarm['status'] }) {
  return (
    <span className={`badge badge-${status.toLowerCase()}`}>
      <span className="badge-dot" />
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

function groupSummary({
  alarms,
  selling,
  triggered,
  disabled,
}: AlarmGroup): string {
  return [
    plural(alarms.length, 'alarm'),
    selling > 0 && `${selling} waiting to sell`,
    triggered > 0 && `${triggered} triggered`,
    disabled > 0 && `${disabled} disabled`,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function AlarmList({
  alarms,
  onSetStatus,
  onEdit,
  onDelete,
  portfolioNames,
  forceExpanded,
  paginationKey,
}: Props) {
  const [pendingDelete, setPendingDelete] = useState<Alarm | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState(INITIAL_SORT);
  const groups = useMemo(
    () => sortItems(groupAlarms(alarms), GROUP_SORT_FIELDS, sort, byTicker),
    [alarms, sort],
  );
  const pagination = usePagination(
    groups,
    TICKERS_PER_PAGE,
    `${paginationKey}|${sort.field}|${sort.dir}`,
  );

  if (alarms.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-state-icon">
          <EmptyAlarmsIcon />
        </span>
        <h3>No alarms yet</h3>
        <p>Create your first alarm to get started.</p>
      </div>
    );
  }

  const isOpen = (key: string) => forceExpanded || expanded.has(key);

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <>
      <div className="alarm-groups-toolbar">
        <span className="text-muted">{plural(groups.length, 'ticker')}</span>
        <SortControl
          fields={GROUP_SORT_FIELDS}
          value={sort}
          initial={INITIAL_SORT}
          onChange={setSort}
          itemLabel="tickers"
        />
        {!forceExpanded && (
          <div className="alarm-groups-toggle">
            <button
              type="button"
              onClick={() => setExpanded(new Set(groups.map((g) => g.key)))}
            >
              Expand all
            </button>
            <button type="button" onClick={() => setExpanded(new Set())}>
              Collapse all
            </button>
          </div>
        )}
      </div>
      <ul className="alarm-groups">
        {pagination.pageItems.map((group) => (
          <li key={group.key} className="card alarm-group">
            <button
              type="button"
              className={`alarm-group-header ${isOpen(group.key) ? 'is-open' : ''}`}
              onClick={() => toggle(group.key)}
              aria-expanded={isOpen(group.key)}
              disabled={forceExpanded}
            >
              <span className="alarm-group-chevron">
                <ChevronDownIcon />
              </span>
              <strong className="ticker">{group.ticker}</strong>
              <span className="tag">{MARKET_LABELS[group.market]}</span>
              {group.portfolioIds
                .filter((id) => portfolioNames.has(id))
                .map((id) => (
                  <span
                    key={id}
                    className="tag portfolio-tag"
                    title={`From portfolio "${portfolioNames.get(id)}"`}
                  >
                    <LayersIcon size={11} />
                    <span>{portfolioNames.get(id)}</span>
                  </span>
                ))}
              <span className="alarm-group-summary">{groupSummary(group)}</span>
            </button>
            {isOpen(group.key) && (
              <ul className="alarm-group-rows">
                {group.alarms.map((alarm) => (
                  <li
                    key={alarm.id}
                    className={`alarm-line ${alarm.status === 'TRIGGERED' ? 'is-triggered' : ''} ${
                      alarm.status === 'DISABLED' ? 'is-disabled' : ''
                    }`}
                  >
                    <span className="alarm-line-step mono">
                      {group.steps.has(alarm.id)
                        ? `#${group.steps.get(alarm.id)}`
                        : ''}
                    </span>
                    <div className="alarm-line-params">
                      {alarm.strategyType !== 'MANUAL_THRESHOLD' && (
                        <span className="alarm-strategy-label">
                          {STRATEGY_LABELS[alarm.strategyType]}
                        </span>
                      )}
                      {paramStats(alarm).map((stat) => (
                        <span key={stat.label} className="alarm-line-stat">
                          <span className="alarm-param-label">
                            {stat.label}
                          </span>
                          <span className="alarm-param-value mono">
                            {stat.value}
                          </span>
                        </span>
                      ))}
                    </div>
                    <div className="alarm-line-state">
                      <StatusBadge status={alarm.status} />
                      <NotificationStatusTag alarm={alarm} />
                      {alarm.status === 'TRIGGERED' && alarm.triggeredAt && (
                        <span className="alarm-triggered-at">
                          {formatTriggeredAt(alarm.triggeredAt)}
                        </span>
                      )}
                    </div>
                    <div className="alarm-actions">
                      {alarm.status !== 'ACTIVE' && (
                        <button
                          type="button"
                          onClick={() => onSetStatus(alarm.id, 'ACTIVE')}
                        >
                          {alarm.status === 'TRIGGERED' ? 'Re-arm' : 'Enable'}
                        </button>
                      )}
                      {alarm.status === 'ACTIVE' && (
                        <button
                          type="button"
                          onClick={() => onSetStatus(alarm.id, 'DISABLED')}
                        >
                          Disable
                        </button>
                      )}
                      <button type="button" onClick={() => onEdit(alarm)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => setPendingDelete(alarm)}
                        aria-label={`Delete ${alarm.ticker} alarm`}
                      >
                        <TrashIcon size={13} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      <Pagination state={pagination} itemLabel="tickers" />
      {pendingDelete && (
        <ConfirmDialog
          title="Delete alarm"
          message={`Delete the ${STRATEGY_LABELS[pendingDelete.strategyType]} alarm for ${pendingDelete.ticker}? This can't be undone.`}
          confirmLabel="Delete"
          danger
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            onDelete(pendingDelete.id);
            setPendingDelete(null);
          }}
        />
      )}
    </>
  );
}
