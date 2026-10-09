import ExcelJS from "exceljs";
import Papa from "papaparse";
import { cellText } from "./cell";
import type { SourceRow } from "./types";

export class SourceParseError extends Error {}

export function parseCsv(text: string): SourceRow[] {
  const result = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  if (result.errors.length && result.data.length === 0) {
    throw new SourceParseError(`CSV inválido: ${result.errors[0].message}`);
  }
  return result.data;
}

export async function parseXlsxSource(buffer: ArrayBuffer): Promise<SourceRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];

  const header: string[] = [];
  ws.getRow(1).eachCell((cell, col) => {
    header[col] = cellText(cell.value);
  });

  const rows: SourceRow[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    if (!row.hasValues) continue;
    const record: SourceRow = {};
    header.forEach((name, col) => {
      if (name) record[name] = cellText(row.getCell(col).value) || null;
    });
    rows.push(record);
  }
  return rows;
}

export async function parseSource(fileName: string, buffer: ArrayBuffer): Promise<SourceRow[]> {
  const name = fileName.toLowerCase();
  if (name.endsWith(".csv")) return parseCsv(new TextDecoder("utf-8").decode(buffer));
  if (name.endsWith(".xlsx")) return parseXlsxSource(buffer);
  throw new SourceParseError("A fonte precisa ser .csv ou .xlsx.");
}
