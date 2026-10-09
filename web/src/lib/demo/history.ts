import { summarize, syncWorkbook } from "../engine/sync";
import type { ChangeRecord, SyncSummary } from "../engine/types";
import { buildControlWorkbook, buildDailyExport, DEMO_CONFIG } from "./scenario";

export interface SimulatedRun {
  day: number;
  summary: SyncSummary;
  changes: ChangeRecord[];
}

/** Executa o cenário para os dias 1..`days` — base do seed e do modo sem banco. */
export async function simulateHistory(days = 30): Promise<SimulatedRun[]> {
  const runs: SimulatedRun[] = [];
  for (let day = 1; day <= days; day++) {
    const changes = syncWorkbook(await buildControlWorkbook(), buildDailyExport(day), DEMO_CONFIG);
    runs.push({ day, summary: summarize(changes), changes });
  }
  return runs;
}
