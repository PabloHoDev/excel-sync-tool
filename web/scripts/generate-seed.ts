/**
 * Gera supabase/seed.sql com 30 dias de execuções ilustrativas do cenário
 * fictício, para o painel já abrir com histórico.
 *
 *   npm run db:seed:generate
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { simulateHistory } from "../src/lib/demo/history";

const DAYS = 30;
const CHANGES_FOR_LAST = 3; // detalhe de alterações só para os últimos dias

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;

async function main() {
  const runs = await simulateHistory(DAYS);
  const lines: string[] = [
    "-- Gerado por scripts/generate-seed.ts — não edite à mão.",
    "-- 30 dias de execuções do cenário fictício (Nimbus Serviços).",
    "delete from public.sync_runs where origin = 'seed';",
    "",
  ];

  for (const { day, summary, changes } of runs) {
    const id = `00000000-0000-4000-8000-${String(day).padStart(12, "0")}`;
    const daysAgo = DAYS - day;
    // ~1 ms por registro: mesma ordem de grandeza da execução real na Vercel.
    const duration = 120 + ((day * 37) % 90);
    lines.push(
      "insert into public.sync_runs (id, created_at, origin, day, total, updated, unchanged, not_found, cells_changed, duration_ms, by_sheet) values (" +
        [
          q(id),
          `date_trunc('day', now()) - interval '${daysAgo} days' + interval '7 hours'`,
          q("seed"),
          day,
          summary.total,
          summary.updated,
          summary.unchanged,
          summary.notFound,
          summary.cellsChanged,
          duration,
          `${q(JSON.stringify(summary.bySheet))}::jsonb`,
        ].join(", ") +
        ");",
    );

    if (day > DAYS - CHANGES_FOR_LAST) {
      for (const c of changes.filter((c) => c.status === "OK")) {
        for (const col of c.updatedColumns) {
          lines.push(
            `insert into public.sync_changes (run_id, sheet, key_value, row_number, column_name, old_value, new_value) values (${[
              q(id),
              q(c.sheet),
              q(c.keyValue),
              c.row,
              q(col),
              q(c.oldValues[col]),
              q(c.newValues[col]),
            ].join(", ")});`,
          );
        }
      }
    }
  }

  const out = join(__dirname, "..", "supabase", "seed.sql");
  writeFileSync(out, lines.join("\n") + "\n", "utf-8");
  console.log(`seed.sql gerado com ${runs.length} execuções → ${out}`);
}

main();
