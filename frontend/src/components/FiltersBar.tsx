import type { Alarm, AlarmStatus, Market } from '../types';
import { MARKET_LABELS } from '../markets';
import { FilterIcon } from './icons';

export type DateRangeFilter = 'ALL' | '7' | '30' | '90';

export interface AlarmFilters {
  market: Market | 'ALL';
  status: AlarmStatus | 'ALL';
  dateRange: DateRangeFilter;
}

export const DEFAULT_FILTERS: AlarmFilters = {
  market: 'ALL',
  status: 'ALL',
  dateRange: 'ALL',
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
  return alarms.filter((alarm) => {
    if (filters.market !== 'ALL' && alarm.market !== filters.market)
      return false;
    if (filters.status !== 'ALL' && alarm.status !== filters.status)
      return false;
    if (cutoff !== null && new Date(alarm.createdAt).getTime() < cutoff)
      return false;
    return true;
  });
}

interface Props {
  filters: AlarmFilters;
  onChange: (filters: AlarmFilters) => void;
}

export function FiltersBar({ filters, onChange }: Props) {
  const isActive =
    filters.market !== 'ALL' ||
    filters.status !== 'ALL' ||
    filters.dateRange !== 'ALL';

  return (
    <div className="filters-bar">
      <span className="filters-label">
        <FilterIcon />
        Filters
      </span>
      <div className="filters-divider" />
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
