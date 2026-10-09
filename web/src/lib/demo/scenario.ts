/**
 * Cenário de demonstração (dados fictícios).
 *
 * A "Nimbus Serviços" controla 160 processos em uma planilha com uma aba por
 * equipe. Todo dia o ERP exporta um CSV com o status atualizado. A planilha
 * base é sempre a mesma (semente fixa); cada "dia" gera uma exportação
 * diferente a partir da sua própria semente, então qualquer execução pode ser
 * reproduzida informando o mesmo número de dia.
 */
import ExcelJS from "exceljs";
import type { SourceRow } from "../engine/types";
import { DEMO_CONFIG, DEMO_PROCESS_COUNT, DEMO_SHEET_PASSWORD, TEAMS } from "./config";

export { DEMO_CONFIG, DEMO_PROCESS_COUNT, DEMO_SHEET_PASSWORD, TEAMS };

export const STATUSES = ["Aberto", "Em andamento", "Aguardando cliente", "Concluido"] as const;
const CLIENTS = [
  "Atlas Engenharia",
  "Bravo Logística",
  "Cedro Alimentos",
  "Delta Saúde",
  "Eixo Construtora",
  "Fênix Varejo",
  "Gama Têxtil",
  "Horizonte Agro",
];
const OWNERS = ["Ana", "Bruno", "Carla", "Diego", "Elisa", "Fábio", "Gabi", "Hugo"];
const HEADER = ["Codigo", "Cliente", "Responsavel", "Area", "Status", "Prazo"] as const;

type Process = Record<(typeof HEADER)[number], string>;

/** PRNG determinístico (mulberry32) — mesma semente, mesmos dados. */
export function createRng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pick = <T>(items: readonly T[]) => items[Math.floor(next() * items.length)];
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  return { next, pick, int };
}

export function buildProcesses(): Process[] {
  const rng = createRng(42);
  return Array.from({ length: DEMO_PROCESS_COUNT }, (_, i) => ({
    Codigo: `PRC-${String(i + 1).padStart(4, "0")}`,
    Cliente: rng.pick(CLIENTS),
    Responsavel: rng.pick(OWNERS),
    Area: TEAMS[i % TEAMS.length],
    Status: rng.pick(STATUSES.slice(0, 3)),
    Prazo: `2026-${String(rng.int(10, 12)).padStart(2, "0")}-${String(rng.int(1, 28)).padStart(2, "0")}`,
  }));
}

/** Simula a exportação do ERP de um dia: ~20% mudam de status, ~5% trocam de área e alguns são novos. */
export function buildDailyExport(day: number): SourceRow[] {
  const rng = createRng(day * 7919);
  const rows: SourceRow[] = buildProcesses().map((p) => {
    const row: SourceRow = { Codigo: p.Codigo, Area: p.Area, Status: p.Status };
    const roll = rng.next();
    if (roll < 0.2) row.Status = rng.pick(STATUSES.filter((s) => s !== p.Status));
    else if (roll < 0.25) row.Area = rng.pick(TEAMS.filter((t) => t !== p.Area));
    return row;
  });
  const newOnes = rng.int(1, 4);
  for (let n = 1; n <= newOnes; n++) {
    rows.push({
      Codigo: `PRC-${String(DEMO_PROCESS_COUNT + n).padStart(4, "0")}`,
      Area: rng.pick(TEAMS),
      Status: "Aberto",
    });
  }
  return rows;
}

export async function buildControlWorkbook(): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "excel-sync-tool (demo)";
  const processes = buildProcesses();

  const summary = wb.addWorksheet("VISAO GERAL");
  summary.getCell("A1").value = "Nimbus Serviços — Controle de processos (dados fictícios)";
  summary.getCell("A1").font = { bold: true, size: 14 };
  TEAMS.forEach((team, i) => {
    summary.getCell(3 + i, 1).value = team;
    summary.getCell(3 + i, 2).value = processes.filter((p) => p.Area === team).length;
  });

  for (const team of TEAMS) {
    const ws = wb.addWorksheet(team);
    ws.getCell("A1").value = `Equipe ${team}`;
    ws.getCell("A1").font = { bold: true, size: 13 };
    ws.getCell("A2").value = "Atualizado automaticamente pelo excel-sync-tool";
    ws.getCell("A2").font = { italic: true, color: { argb: "FF666666" } };

    const header = ws.getRow(DEMO_CONFIG.headerRow);
    HEADER.forEach((name, i) => {
      const cell = header.getCell(i + 1);
      cell.value = name;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3A5F" } };
      cell.alignment = { horizontal: "center" };
    });
    processes
      .filter((p) => p.Area === team)
      .forEach((p, i) => {
        ws.getRow(DEMO_CONFIG.headerRow + 1 + i).values = HEADER.map((h) => p[h]);
      });
    [12, 20, 14, 14, 20, 12].forEach((width, i) => {
      ws.getColumn(i + 1).width = width;
    });
  }

  // Aba protegida: a sincronização precisa manter a proteção.
  await wb.getWorksheet("Juridico")!.protect(DEMO_SHEET_PASSWORD, {});
  return wb;
}
