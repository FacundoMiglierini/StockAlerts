// Shared sort model for list pages (AlarmList's ticker groups,
// PortfoliosPage): a field picked from a select plus a direction the user
// can flip. Kept out of components/SortControl.tsx so that file only
// exports components (react-refresh lint rule).

export type SortDir = 'asc' | 'desc';

// Decides the wording of the direction button, so it says what the order
// means ("Newest first") instead of a bare arrow.
export type SortKind = 'text' | 'date' | 'number';

export const DIRECTION_LABELS: Record<SortKind, Record<SortDir, string>> = {
  text: { asc: 'A → Z', desc: 'Z → A' },
  date: { asc: 'Oldest first', desc: 'Newest first' },
  number: { asc: 'Low → high', desc: 'High → low' },
};

export interface SortField<T> {
  label: string;
  kind: SortKind;
  // Direction a field starts in when picked: A → Z for names, newest first
  // for dates, highest first for counts.
  defaultDir: SortDir;
  // Ascending order; 'desc' reverses it.
  compare: (a: T, b: T) => number;
}

export interface SortState<F extends string> {
  field: F;
  dir: SortDir;
}

// Sorts a copy. `tieBreak` always runs ascending, even when the field is
// reversed, so equal items keep a stable, readable order (A → Z).
export function sortItems<T, F extends string>(
  items: T[],
  fields: Record<F, SortField<T>>,
  { field, dir }: SortState<F>,
  tieBreak: (a: T, b: T) => number,
): T[] {
  const sign = dir === 'asc' ? 1 : -1;
  const { compare } = fields[field];
  return [...items].sort((a, b) => sign * compare(a, b) || tieBreak(a, b));
}
