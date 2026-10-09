import Papa from "papaparse";
import type { ChangeRecord } from "./types";

/** Gera o log CSV no mesmo formato do motor Python (old_<col> / new_<col>). */
export function changesToCsv(changes: ChangeRecord[]): string {
  const cols = [...new Set(changes.flatMap((c) => c.updatedColumns))];
  const header = ["sheet", "key_value", "row", "status", "updated_columns", ...cols.flatMap((c) => [`old_${c}`, `new_${c}`])];

  const rows = changes.map((c) => {
    const row: Record<string, string | number> = {
      sheet: c.sheet,
      key_value: c.keyValue,
      row: c.row,
      status: c.status,
      updated_columns: c.updatedColumns.join(";"),
    };
    for (const col of cols) {
      row[`old_${col}`] = c.oldValues[col] ?? "";
      row[`new_${col}`] = c.newValues[col] ?? "";
    }
    return row;
  });

  // BOM para o Excel abrir o CSV com acentos corretos.
  return "﻿" + Papa.unparse(rows, { columns: header });
}
