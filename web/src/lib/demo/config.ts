import type { SyncConfig } from "../engine/types";

// Constantes do cenário sem dependência do exceljs: podem ir para o navegador.
export const TEAMS = ["Financeiro", "Juridico", "Comercial", "RH"] as const;
export const DEMO_PROCESS_COUNT = 160;
export const DEMO_SHEET_PASSWORD = "nimbus";
export const DEMO_CONFIG: SyncConfig = {
  keyColumn: "Codigo",
  updateColumns: ["Area", "Status"],
  headerRow: 4,
  ignoredSheets: ["VISAO GERAL"],
};
