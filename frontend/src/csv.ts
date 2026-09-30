// Minimal CSV reader for the portfolio import: a header row followed by data
// rows, with quoted fields ("a,b" and "" escapes) and the delimiters a
// spreadsheet export or a paste might use. Not a general-purpose parser —
// no type inference, no locale-aware numbers: every cell stays a string and
// the backend (expandRecipe) is the single validator of their values.

export interface ParsedCsv {
  // Lowercased, trimmed header names; `symbol` (the old script's stocks.csv
  // column) is read as `ticker`.
  headers: string[];
  rows: Record<string, string>[];
}

const DELIMITERS = [',', ';', '\t'] as const;

function detectDelimiter(headerLine: string): string {
  let best: string = ',';
  let bestCount = 0;
  for (const delimiter of DELIMITERS) {
    const count = headerLine.split(delimiter).length - 1;
    if (count > bestCount) {
      best = delimiter;
      bestCount = count;
    }
  }
  return best;
}

// Splits text into records of cells, honoring quotes; throws on an
// unterminated quoted field.
function tokenize(text: string, delimiter: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      record.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      record.push(cell);
      records.push(record);
      record = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  if (inQuotes) {
    throw new Error('A quoted value is missing its closing quote');
  }
  if (cell !== '' || record.length > 0) {
    record.push(cell);
    records.push(record);
  }
  return records;
}

export function parseCsv(input: string): ParsedCsv {
  const text = input.replace(/^﻿/, '');
  const firstLine = text.split(/\r\n|\n|\r/).find((l) => l.trim() !== '') ?? '';
  const delimiter = detectDelimiter(firstLine);

  const records = tokenize(text, delimiter).filter((r) =>
    r.some((cell) => cell.trim() !== ''),
  );
  if (records.length === 0) return { headers: [], rows: [] };

  const headers = records[0].map((h) => {
    const name = h.trim().toLowerCase();
    return name === 'symbol' ? 'ticker' : name;
  });

  const rows = records
    .slice(1)
    .map((record) =>
      Object.fromEntries(
        headers.map((header, index) => [header, (record[index] ?? '').trim()]),
      ),
    );
  return { headers, rows };
}
