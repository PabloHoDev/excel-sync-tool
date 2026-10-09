import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { buildControlWorkbook, buildDailyExport, DEMO_CONFIG } from "../demo/scenario";
import { changesToCsv } from "./log";
import { parseCsv, parseXlsxSource } from "./source";
import { summarize, SyncConfigError, syncWorkbook } from "./sync";
import type { SyncConfig } from "./types";

const config: SyncConfig = {
  keyColumn: "Codigo",
  updateColumns: ["Area", "Status"],
  headerRow: 1,
  ignoredSheets: ["RESUMO"],
};

function targetWorkbook() {
  const wb = new ExcelJS.Workbook();
  const a = wb.addWorksheet("EquipeA");
  a.addRow(["Codigo", "Area", "Status"]);
  a.addRow(["TASK-001", "Financeiro Antigo", "Aberto"]);
  const b = wb.addWorksheet("EquipeB");
  b.addRow(["Codigo", "Area", "Status"]);
  b.addRow(["TASK-002", "Juridico", "Aberto"]);
  const resumo = wb.addWorksheet("RESUMO");
  resumo.addRow(["Codigo", "Area", "Status"]);
  resumo.addRow(["TASK-003", "X", "Y"]);
  return wb;
}

const source = parseCsv(
  "Codigo,Area,Status\nTASK-001,Financeiro,Concluido\nTASK-002,Juridico,Em andamento\nTASK-999,Comercial,Pendente\nTASK-003,Z,Z\n",
);

async function roundTrip(wb: ExcelJS.Workbook) {
  const reloaded = new ExcelJS.Workbook();
  await reloaded.xlsx.load(await wb.xlsx.writeBuffer());
  return reloaded;
}

describe("syncWorkbook", () => {
  it("atualiza só os campos que mudaram", () => {
    const wb = targetWorkbook();
    const byKey = Object.fromEntries(syncWorkbook(wb, source, config).map((c) => [c.keyValue, c]));

    expect(byKey["TASK-001"]).toMatchObject({ status: "OK", updatedColumns: ["Area", "Status"] });
    expect(byKey["TASK-002"]).toMatchObject({ status: "OK", updatedColumns: ["Status"] });
    expect(byKey["TASK-999"].status).toBe("NAO_ENCONTRADO");
    expect(wb.getWorksheet("EquipeA")!.getCell("B2").value).toBe("Financeiro");
    expect(wb.getWorksheet("EquipeB")!.getCell("C2").value).toBe("Em andamento");
  });

  it("não procura chaves em abas ignoradas", () => {
    const wb = targetWorkbook();
    const changes = syncWorkbook(wb, source, config);
    expect(changes.find((c) => c.keyValue === "TASK-003")!.status).toBe("NAO_ENCONTRADO");
    expect(wb.getWorksheet("RESUMO")!.getCell("B2").value).toBe("X");
  });

  it("mantém a primeira ocorrência de chave duplicada", () => {
    const wb = targetWorkbook();
    wb.getWorksheet("EquipeB")!.addRow(["TASK-001", "Duplicado", "Duplicado"]);
    const changes = syncWorkbook(wb, source, config);
    expect(changes.find((c) => c.keyValue === "TASK-001")!.sheet).toBe("EquipeA");
    expect(wb.getWorksheet("EquipeB")!.getCell("B3").value).toBe("Duplicado");
  });

  it("valor vazio na fonte não apaga o controle", () => {
    const wb = targetWorkbook();
    const [change] = syncWorkbook(wb, [{ Codigo: "TASK-002", Area: "", Status: null }], config);
    expect(change.status).toBe("SEM_MUDANCA");
    expect(wb.getWorksheet("EquipeB")!.getCell("C2").value).toBe("Aberto");
  });

  it("explica o erro quando o cabeçalho não é encontrado", () => {
    expect(() => syncWorkbook(targetWorkbook(), source, { ...config, headerRow: 2 })).toThrow(SyncConfigError);
  });

  it("lê fonte .xlsx e ignora chave vazia", async () => {
    const src = new ExcelJS.Workbook();
    const ws = src.addWorksheet("Export");
    ws.addRow(["Codigo", "Area", "Status"]);
    ws.addRow(["TASK-001", "Financeiro", "Concluido"]);
    ws.addRow([null, "Sem chave", "Ignorar"]);
    const rows = await parseXlsxSource(await src.xlsx.writeBuffer());

    const changes = syncWorkbook(targetWorkbook(), rows, config);
    expect(changes.map((c) => c.keyValue)).toEqual(["TASK-001"]);
  });
});

describe("cenário de demonstração", () => {
  it("preserva formatação e proteção depois de salvar", async () => {
    const wb = await buildControlWorkbook();
    const changes = syncWorkbook(wb, buildDailyExport(1), DEMO_CONFIG);
    const saved = await roundTrip(wb);

    const juridico = saved.getWorksheet("Juridico")!;
    // `sheetProtection` existe em runtime, mas não está nos tipos do exceljs.
    expect((juridico as unknown as { sheetProtection?: { sheet?: boolean } }).sheetProtection?.sheet).toBe(true);
    const headerCell = juridico.getCell(DEMO_CONFIG.headerRow, 1);
    expect(headerCell.font?.bold).toBe(true);
    expect(headerCell.fill).toMatchObject({ fgColor: { argb: "FF1F3A5F" } });
    expect(juridico.getColumn(2).width).toBe(20);

    const updated = changes.find((c) => c.status === "OK")!;
    const ws = saved.getWorksheet(updated.sheet)!;
    const col = updated.updatedColumns[0] === "Area" ? 4 : 5;
    expect(ws.getCell(updated.row, col).value).toBe(updated.newValues[updated.updatedColumns[0]]);
  });

  it("é reproduzível para o mesmo dia e varia entre dias", async () => {
    const run = async (day: number) => summarize(syncWorkbook(await buildControlWorkbook(), buildDailyExport(day), DEMO_CONFIG));
    expect(await run(7)).toEqual(await run(7));
    expect(await run(7)).not.toEqual(await run(8));

    const s = await run(7);
    expect(s.total).toBeGreaterThan(160);
    expect(s.updated).toBeGreaterThan(10);
    expect(s.notFound).toBeGreaterThanOrEqual(1);
  });

  it("gera log CSV no formato do motor Python", async () => {
    const changes = syncWorkbook(targetWorkbook(), source, config);
    const csv = changesToCsv(changes);
    expect(csv.split("\n")[0]).toContain("sheet,key_value,row,status,updated_columns,old_Area,new_Area,old_Status,new_Status");
  });
});
