import type { Alarm, AlarmStatus, Market, Portfolio } from '../types';
import { MARKET_LABELS } from '../markets';
import { FilterIcon } from './icons';

export type DateRangeFilter = 'ALL' | '7' | '30' | '90';

// 'NONE' = alarms created one by one; any other value is a portfolio id.
export type PortfolioFilter = 'ALL' | 'NONE' | string;

export interface AlarmFilters {
  market: Market | 'ALL';
  status: AlarmStatus | 'ALL';
  dateRange: DateRangeFilter;
  portfolio: PortfolioFilter;
  // Case-insensitive substring of the ticker; '' = no search.
  search: string;
}

export const DEFAULT_FILTERS: AlarmFilters = {
  market: 'ALL',
  status: 'ALL',
  dateRange: 'ALL',
  portfolio: 'ALL',
  search: '',
};

const STATUS_LABELS: Record<AlarmStatus, string> = {
  ACTIVE: 'Active',
  TRIGGERED: 'Triggered',
  DISABLED: 'Disabled',
};

const DATE_RANGE_LABELS: Record<DateRangeFilter, string> = {
  ALL: 'Any time',
  '7': 'Last 7 days',
  '30': 'Last 30 days',
  '90': 'Last 90 days',
};

export function applyAlarmFilters(
  alarms: Alarm[],
  filters: AlarmFilters,
): Alarm[] {
  const cutoff =
    filters.dateRange === 'ALL'
      ? null
      : Date.now() - Number(filters.dateRange) * 24 * 60 * 60 * 1000;
  const search = filters.search.trim().toUpperCase();
  return alarms.filter((alarm) => {
    if (search && !alarm.ticker.includes(search)) return false;
    if (filters.market !== 'ALL' && alarm.market !== filters.market)
      return false;
    if (filters.status !== 'ALL' && alarm.status !== filters.status)
      return false;
    if (cutoff !== null && new Date(alarm.createdAt).getTime() < cutoff)
      return false;
    if (
      filters.portfolio !== 'ALL' &&
      (alarm.portfolioId ?? 'NONE') !== filters.portfolio
    )
      return false;
    return true;
  });
}

interface Props {
  filters: AlarmFilters;
  onChange: (filters: AlarmFilters) => void;
  portfolios: Portfolio[];
}

export function FiltersBar({ filters, onChange, portfolios }: Props) {
  const isActive =
    filters.market !== 'ALL' ||
    filters.status !== 'ALL' ||
    filters.dateRange !== 'ALL' ||
    filters.portfolio !== 'ALL' ||
    filters.search.trim() !== '';

  return (
    <div className="filters-bar">
      <span className="filters-label">
        <FilterIcon />
        Filters
      </span>
      <div className="filters-divider" />
      <input
        type="search"
        className={
          filters.search.trim() ? 'filter-search is-active' : 'filter-search'
        }
        placeholder="Search ticker"
        value={filters.search}
        onChange={(e) => onChange({ ...filters, search: e.target.value })}
        aria-label="Search by ticker"
      />
      <select
        className={
          filters.market !== 'ALL' ? 'filter-select is-active' : 'filter-select'
        }
        value={filters.market}
        onChange={(e) =>
          onChange({
            ...filters,
            market: e.target.value as AlarmFilters['market'],
          })
        }
        aria-label="Filter by market"
      >
        <option value="ALL">All markets</option>
        {Object.entries(MARKET_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <select
        className={
          filters.status !== 'ALL' ? 'filter-select is-active' : 'filter-select'
        }
        value={filters.status}
        onChange={(e) =>
          onChange({
            ...filters,
            status: e.target.value as AlarmFilters['status'],
          })
        }
        aria-label="Filter by status"
      >
        <option value="ALL">All statuses</option>
        {Object.entries(STATUS_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <select
        className={
          filters.dateRange !== 'ALL'
            ? 'filter-select is-active'
            : 'filter-select'
        }
        value={filters.dateRange}
        onChange={(e) =>
          onChange({ ...filters, dateRange: e.target.value as DateRangeFilter })
        }
        aria-label="Filter by creation date"
      >
        {Object.entries(DATE_RANGE_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      {portfolios.length > 0 && (
        <select
          className={
            filters.portfolio !== 'ALL'
              ? 'filter-select is-active'
              : 'filter-select'
          }
          value={filters.portfolio}
          onChange={(e) => onChange({ ...filters, portfolio: e.target.value })}
          aria-label="Filter by portfolio"
        >
          <option value="ALL">All portfolios</option>
          <option value="NONE">Not in a portfolio</option>
          {portfolios.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      )}
      {isActive && (
        <button
          type="button"
          className="filters-clear"
          onClick={() => onChange(DEFAULT_FILTERS)}
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
