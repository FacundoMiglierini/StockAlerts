import {
  DIRECTION_LABELS,
  type SortDir,
  type SortKind,
  type SortState,
} from '../sorting';

interface Props<F extends string> {
  fields: Record<F, { label: string; kind: SortKind; defaultDir: SortDir }>;
  value: SortState<F>;
  // The page's initial sort field; picking another one is highlighted like
  // an active filter.
  initial: SortState<F>;
  onChange: (next: SortState<F>) => void;
  // What is being sorted, for screen readers ("tickers", "portfolios").
  itemLabel: string;
}

export function SortControl<F extends string>({
  fields,
  value,
  initial,
  onChange,
  itemLabel,
}: Props<F>) {
  const field = fields[value.field];
  const directionLabel = DIRECTION_LABELS[field.kind][value.dir];

  return (
    <div className="sort-control">
      <select
        className={
          value.field !== initial.field
            ? 'filter-select is-active'
            : 'filter-select'
        }
        value={value.field}
        // A newly picked field starts in its natural direction.
        onChange={(e) => {
          const next = e.target.value as F;
          onChange({ field: next, dir: fields[next].defaultDir });
        }}
        aria-label={`Sort ${itemLabel} by`}
      >
        {(Object.keys(fields) as F[]).map((key) => (
          <option key={key} value={key}>
            Sort: {fields[key].label}
          </option>
        ))}
      </select>
      <button
        type="button"
        // Highlighted only once reversed from the field's natural order.
        className={
          value.dir !== field.defaultDir
            ? 'sort-direction is-active'
            : 'sort-direction'
        }
        onClick={() =>
          onChange({ ...value, dir: value.dir === 'asc' ? 'desc' : 'asc' })
        }
        aria-label={`Sort order: ${directionLabel}. Click to reverse.`}
        title="Reverse order"
      >
        {directionLabel}
      </button>
    </div>
  );
}
