export type ChangeStatus = "OK" | "SEM_MUDANCA" | "NAO_ENCONTRADO";

export interface SyncConfig {
  keyColumn: string;
  updateColumns: string[];
  /** Linha do cabeçalho no destino (1 = primeira linha). */
  headerRow: number;
  ignoredSheets: string[];
}

export type SourceRow = Record<string, string | null>;

export interface ChangeRecord {
  sheet: string;
  keyValue: string;
  row: number;
  status: ChangeStatus;
  updatedColumns: string[];
  oldValues: Record<string, string>;
  newValues: Record<string, string>;
}

export interface SyncSummary {
  total: number;
  updated: number;
  unchanged: number;
  notFound: number;
  cellsChanged: number;
  /** Registros atualizados por aba, ex.: { Financeiro: 7, RH: 3 }. */
  bySheet: Record<string, number>;
}
