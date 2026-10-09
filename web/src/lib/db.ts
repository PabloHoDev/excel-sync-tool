import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { simulateHistory } from "./demo/history";
import type { ChangeRecord, SyncSummary } from "./engine/types";

export type RunOrigin = "seed" | "demo" | "upload";

export interface RunRow {
  id: string;
  created_at: string;
  origin: RunOrigin;
  day: number | null;
  total: number;
  updated: number;
  unchanged: number;
  not_found: number;
  cells_changed: number;
  duration_ms: number;
  by_sheet: Record<string, number>;
}

export interface ChangeRow {
  sheet: string;
  key_value: string;
  column_name: string;
  old_value: string;
  new_value: string;
  created_at: string;
}

export interface Dashboard {
  /** "unavailable": banco configurado, mas a leitura falhou — mostra o ilustrativo com aviso. */
  source: "supabase" | "illustrative" | "unavailable";
  totals: { runs: number; records: number; updated: number; cellsChanged: number; notFound: number; avgDurationMs: number };
  runs: RunRow[];
  recentChanges: ChangeRow[];
}

let client: SupabaseClient | null | undefined;

/** Cliente com a secret key — só existe no servidor (import "server-only"). */
function getClient(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  client = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  return client;
}

export function isDbConfigured() {
  return getClient() !== null;
}

/** Grava uma execução. Para uploads, `changes` deve ser omitido (só contagens são salvas). */
export async function saveRun(
  run: { origin: Exclude<RunOrigin, "seed">; day?: number; summary: SyncSummary; durationMs: number },
  changes?: ChangeRecord[],
): Promise<string | null> {
  const db = getClient();
  if (!db) return null;

  const { data, error } = await db
    .from("sync_runs")
    .insert({
      origin: run.origin,
      day: run.day ?? null,
      total: run.summary.total,
      updated: run.summary.updated,
      unchanged: run.summary.unchanged,
      not_found: run.summary.notFound,
      cells_changed: run.summary.cellsChanged,
      duration_ms: Math.round(run.durationMs),
      by_sheet: run.summary.bySheet,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Falha ao gravar execução: ${error.message}`);

  if (changes?.length) {
    const rows = changes
      .filter((c) => c.status === "OK")
      .flatMap((c) =>
        c.updatedColumns.map((col) => ({
          run_id: data.id,
          sheet: c.sheet,
          key_value: c.keyValue,
          row_number: c.row,
          column_name: col,
          old_value: c.oldValues[col] ?? "",
          new_value: c.newValues[col],
        })),
      );
    const { error: changesError } = await db.from("sync_changes").insert(rows);
    if (changesError) throw new Error(`Falha ao gravar alterações: ${changesError.message}`);
  }

  await db.rpc("prune_sync_runs");
  return data.id;
}

export async function getDashboard(): Promise<Dashboard> {
  const db = getClient();
  if (!db) return illustrativeDashboard();

  const [totals, runs, changes] = await Promise.all([
    db.from("sync_totals").select("*").single(),
    db.from("sync_runs").select("*").order("created_at", { ascending: false }).limit(30),
    db
      .from("sync_changes")
      .select("sheet, key_value, column_name, old_value, new_value, sync_runs!inner(created_at)")
      .order("id", { ascending: false })
      .limit(12),
  ]);
  const error = totals.error ?? runs.error ?? changes.error;
  if (error) {
    // O painel nunca deve quebrar a página: registra o erro e cai no histórico ilustrativo.
    console.error(`Falha ao ler o painel: ${error.message}`);
    return { ...(await illustrativeDashboard()), source: "unavailable" };
  }

  return {
    source: "supabase",
    totals: {
      runs: totals.data.runs,
      records: totals.data.records,
      updated: totals.data.updated,
      cellsChanged: totals.data.cells_changed,
      notFound: totals.data.not_found,
      avgDurationMs: totals.data.avg_duration_ms,
    },
    runs: runs.data as RunRow[],
    recentChanges: (changes.data ?? []).map((c) => {
      const run = c.sync_runs as unknown as { created_at: string };
      return {
        sheet: c.sheet,
        key_value: c.key_value,
        column_name: c.column_name,
        old_value: c.old_value,
        new_value: c.new_value,
        created_at: run.created_at,
      };
    }),
  };
}

/** Sem Supabase configurado (ex.: rodando local), o painel usa o mesmo histórico do seed. */
async function illustrativeDashboard(): Promise<Dashboard> {
  "use cache";
  const sims = await simulateHistory(30);
  const today = new Date();
  today.setUTCHours(10, 0, 0, 0);

  const runs: RunRow[] = sims
    .map(({ day, summary }) => ({
      id: `illustrative-${day}`,
      created_at: new Date(today.getTime() - (30 - day) * 86_400_000).toISOString(),
      origin: "seed" as const,
      day,
      total: summary.total,
      updated: summary.updated,
      unchanged: summary.unchanged,
      not_found: summary.notFound,
      cells_changed: summary.cellsChanged,
      duration_ms: 120 + ((day * 37) % 90),
      by_sheet: summary.bySheet,
    }))
    .reverse();

  const last = sims[sims.length - 1];
  const recentChanges: ChangeRow[] = last.changes
    .filter((c) => c.status === "OK")
    .flatMap((c) =>
      c.updatedColumns.map((col) => ({
        sheet: c.sheet,
        key_value: c.keyValue,
        column_name: col,
        old_value: c.oldValues[col] ?? "",
        new_value: c.newValues[col],
        created_at: runs[0].created_at,
      })),
    )
    .slice(0, 12);

  const sum = (pick: (r: RunRow) => number) => runs.reduce((acc, r) => acc + pick(r), 0);
  return {
    source: "illustrative",
    totals: {
      runs: runs.length,
      records: sum((r) => r.total),
      updated: sum((r) => r.updated),
      cellsChanged: sum((r) => r.cells_changed),
      notFound: sum((r) => r.not_found),
      avgDurationMs: Math.round(sum((r) => r.duration_ms) / runs.length),
    },
    runs,
    recentChanges,
  };
}
