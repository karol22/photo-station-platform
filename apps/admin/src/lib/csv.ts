/**
 * Parser y serializador CSV mínimos (RFC 4180): separador coma, comillas dobles con escape `""`,
 * saltos CRLF o LF, campos con saltos de línea dentro de comillas. Sin dependencias.
 */

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const input = text.startsWith('﻿') ? text.slice(1) : text;
  while (i < input.length) {
    const ch = input[i] as string;
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      i += 1;
      continue;
    }
    if (ch === '\r') {
      i += 1;
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Una línea totalmente vacía al final no es una fila.
  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

/** Convierte filas CSV (primera fila = encabezados) en objetos clave → valor. */
export function csvToObjects(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const parsed = parseCsv(text);
  const headers = (parsed[0] ?? []).map((h) => h.trim());
  const rows = parsed.slice(1).map((cells) => {
    const obj: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (header) obj[header] = cells[index] ?? '';
    });
    return obj;
  });
  return { headers, rows };
}

function escapeCell(value: unknown): string {
  const text = value === undefined || value === null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Serializa filas a CSV con CRLF. */
export function toCsv(rows: unknown[][]): string {
  return rows.map((row) => row.map(escapeCell).join(',')).join('\r\n');
}

/** Serializa objetos a CSV tomando `columns` como encabezados (en ese orden). */
export function objectsToCsv(items: Record<string, unknown>[], columns: string[]): string {
  return toCsv([columns, ...items.map((item) => columns.map((c) => item[c]))]);
}
