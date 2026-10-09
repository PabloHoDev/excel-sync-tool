import type { ChangeRecord, SyncSummary } from "./engine/types";

/** Uma aba do controle depois da sincronização, para a pré-visualização na demo. */
export interface SheetPreview {
  name: string;
  header: string[];
  /** Número da linha no Excel da primeira linha de `rows`. */
  firstRow: number;
  rows: string[][];
}

export interface SyncResponse {
  runId: string | null;
  saved: boolean;
  day: number | null;
  summary: SyncSummary;
  durationMs: number;
  /** Até 500 registros (os não alterados ficam por último). */
  changes: ChangeRecord[];
  preview: SheetPreview[];
  files: { xlsxBase64: string; logCsv: string; fileName: string };
}

export interface ErrorResponse {
  error: string;
}
