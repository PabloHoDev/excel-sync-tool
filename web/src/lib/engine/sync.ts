/**
 * Motor de sincronização — versão TypeScript do `excel_sync.sync` (Python).
 *
 * Mesma regra: indexa a coluna-chave de todas as abas válidas uma única vez e,
 * para cada registro da fonte, atualiza apenas as colunas configuradas e apenas
 * quando o valor mudou. Formatação, proteção de aba e abas ignoradas são
 * preservadas porque só o `value` das células alteradas é escrito.
 */
import type { Workbook, Worksheet } from "exceljs";
import { cellText } from "./cell";
import type { ChangeRecord, SourceRow, SyncConfig, SyncSummary } from "./types";

interface Location {
  sheet: Worksheet;
  row: number;
  columns: Record<string, number>;
}

export class SyncConfigError extends Error {}

function findHeaderIndices(sheet: Worksheet, headerRow: number, wanted: string[]) {
  const found: Record<string, number> = {};
  sheet.getRow(headerRow).eachCell((cell, col) => {
    const name = cellText(cell.value);
    if (name && !(name in found)) found[name] = col;
  });
  if (!wanted.every((name) => name in found)) return null;
  return Object.fromEntries(wanted.map((name) => [name, found[name]]));
}

export function buildKeyIndex(wb: Workbook, config: SyncConfig): Map<string, Location> {
  const wanted = [config.keyColumn, ...config.updateColumns];
  const index = new Map<string, Location>();

  for (const sheet of wb.worksheets) {
    if (config.ignoredSheets.includes(sheet.name)) continue;
    const columns = findHeaderIndices(sheet, config.headerRow, wanted);
    if (!columns) continue;

    const keyCol = columns[config.keyColumn];
    for (let row = config.headerRow + 1; row <= sheet.rowCount; row++) {
      const key = cellText(sheet.getCell(row, keyCol).value);
      // Chave duplicada: vale a primeira ocorrência, como no motor Python.
      if (key && !index.has(key)) index.set(key, { sheet, row, columns });
    }
  }
  return index;
}

export function syncWorkbook(wb: Workbook, rows: SourceRow[], config: SyncConfig): ChangeRecord[] {
  if (!config.keyColumn.trim()) throw new SyncConfigError("Informe a coluna-chave.");
  if (config.updateColumns.length === 0) throw new SyncConfigError("Informe ao menos uma coluna para atualizar.");

  const index = buildKeyIndex(wb, config);
  if (index.size === 0) {
    throw new SyncConfigError(
      `Nenhuma aba tem as colunas ${[config.keyColumn, ...config.updateColumns].join(", ")} ` +
        `na linha ${config.headerRow}. Confira a linha do cabeçalho e os nomes das colunas.`,
    );
  }

  const changes: ChangeRecord[] = [];
  rows.forEach((record, i) => {
    const keyValue = (record[config.keyColumn] ?? "").trim();
    if (!keyValue) return;

    const location = index.get(keyValue);
    if (!location) {
      changes.push({
        sheet: "(N/A)",
        keyValue,
        row: i + 2, // linha no arquivo-fonte (cabeçalho = 1)
        status: "NAO_ENCONTRADO",
        updatedColumns: [],
        oldValues: {},
        newValues: {},
      });
      return;
    }

    const { sheet, row, columns } = location;
    const change: ChangeRecord = {
      sheet: sheet.name,
      keyValue,
      row,
      status: "SEM_MUDANCA",
      updatedColumns: [],
      oldValues: {},
      newValues: {},
    };

    for (const col of config.updateColumns) {
      const cell = sheet.getCell(row, columns[col]);
      const current = cellText(cell.value);
      const next = (record[col] ?? "").trim();
      // Valor vazio na fonte não apaga o que está no controle.
      if (next && next !== current) {
        cell.value = next;
        change.updatedColumns.push(col);
        change.oldValues[col] = current;
        change.newValues[col] = next;
      }
    }
    if (change.updatedColumns.length) change.status = "OK";
    changes.push(change);
  });

  return changes;
}

export function summarize(changes: ChangeRecord[]): SyncSummary {
  const summary: SyncSummary = {
    total: changes.length,
    updated: 0,
    unchanged: 0,
    notFound: 0,
    cellsChanged: 0,
    bySheet: {},
  };
  for (const c of changes) {
    if (c.status === "OK") {
      summary.updated++;
      summary.cellsChanged += c.updatedColumns.length;
      summary.bySheet[c.sheet] = (summary.bySheet[c.sheet] ?? 0) + 1;
    } else if (c.status === "SEM_MUDANCA") {
      summary.unchanged++;
    } else {
      summary.notFound++;
    }
  }
  return summary;
}
