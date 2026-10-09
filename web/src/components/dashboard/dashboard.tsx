import Link from "next/link";
import { getDashboard, type RunOrigin } from "@/lib/db";
import { formatDuration, MANUAL_SECONDS_PER_RECORD, manualMinutes, numberFmt } from "@/lib/metrics";
import { RunsChart } from "./runs-chart";

const ORIGIN_LABEL: Record<RunOrigin, string> = {
  seed: "Ilustrativo",
  demo: "Demo",
  upload: "Arquivo enviado",
};

const dateFmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
const shortDateFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });

export async function Dashboard() {
  const data = await getDashboard();
  const { totals } = data;

  const chronological = [...data.runs].reverse();
  const byTeam = new Map<string, number>();
  for (const run of data.runs) {
    for (const [sheet, n] of Object.entries(run.by_sheet)) byTeam.set(sheet, (byTeam.get(sheet) ?? 0) + n);
  }
  const teams = [...byTeam.entries()].sort((a, b) => b[1] - a[1]);
  const maxTeam = Math.max(1, ...teams.map(([, n]) => n));

  return (
    <div className="mt-8 space-y-6">
      {data.source === "illustrative" && (
        <p className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-text-2">
          <span aria-hidden>ℹ </span>
          Supabase não configurado neste ambiente: o painel mostra 30 dias ilustrativos do cenário fictício. Com o banco
          ligado, as execuções feitas na{" "}
          <Link href="/demo" className="text-accent underline-offset-4 hover:underline">
            demo
          </Link>{" "}
          aparecem aqui.
        </p>
      )}

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi label="Execuções" value={numberFmt.format(totals.runs)} />
        <Kpi label="Registros conferidos" value={numberFmt.format(totals.records)} />
        <Kpi label="Registros atualizados" value={numberFmt.format(totals.updated)} hint={`${numberFmt.format(totals.cellsChanged)} células`} />
        <Kpi
          label="Trabalho manual evitado"
          value={formatDuration(manualMinutes(totals.records))}
          hint={`estimativa: ${MANUAL_SECONDS_PER_RECORD} s por registro`}
        />
        <Kpi label="Tempo médio por execução" value={`${numberFmt.format(totals.avgDurationMs)} ms`} />
      </dl>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-xl border border-border bg-surface p-5" aria-labelledby="chart-title">
          <h2 id="chart-title" className="font-medium">
            Registros atualizados por execução
          </h2>
          <p className="text-sm text-text-3">Últimas {chronological.length} execuções</p>
          <RunsChart
            runs={chronological.map((r) => ({
              id: r.id,
              label: shortDateFmt.format(new Date(r.created_at)),
              fullLabel: dateFmt.format(new Date(r.created_at)),
              updated: r.updated,
              total: r.total,
              notFound: r.not_found,
              origin: ORIGIN_LABEL[r.origin],
            }))}
          />
        </section>

        <section className="rounded-xl border border-border bg-surface p-5" aria-labelledby="teams-title">
          <h2 id="teams-title" className="font-medium">
            Atualizações por aba
          </h2>
          <p className="text-sm text-text-3">Soma das últimas {data.runs.length} execuções</p>
          <ul className="mt-5 space-y-4">
            {teams.map(([team, n]) => (
              <li key={team}>
                <div className="flex justify-between text-sm">
                  <span>{team}</span>
                  <span className="tabular-nums text-text-2">{numberFmt.format(n)}</span>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-surface-2">
                  <div className="h-2 rounded-full bg-series-1" style={{ width: `${(n / maxTeam) * 100}%` }} />
                </div>
              </li>
            ))}
            {teams.length === 0 && <li className="text-sm text-text-3">Sem execuções ainda.</li>}
          </ul>
        </section>
      </div>

      <div className="grid gap-6">
        <section className="rounded-xl border border-border bg-surface" aria-labelledby="changes-title">
          <h2 id="changes-title" className="px-5 pt-5 font-medium">
            Últimas alterações gravadas
          </h2>
          <p className="px-5 text-sm text-text-3">Só do cenário fictício. Arquivos enviados não têm conteúdo armazenado.</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-2 text-xs text-text-2 uppercase">
                <tr>
                  <th className="px-5 py-2 font-medium">Código</th>
                  <th className="px-5 py-2 font-medium">Aba</th>
                  <th className="px-5 py-2 font-medium">Mudança</th>
                </tr>
              </thead>
              <tbody>
                {data.recentChanges.map((c, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-5 py-2 font-mono whitespace-nowrap">{c.key_value}</td>
                    <td className="px-5 py-2">{c.sheet}</td>
                    <td className="px-5 py-2">
                      <span className="text-text-3">{c.column_name}: </span>
                      <span className="text-text-3 line-through">{c.old_value || "(vazio)"}</span> →{" "}
                      <strong className="font-medium">{c.new_value}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-surface" aria-labelledby="runs-title">
          <h2 id="runs-title" className="px-5 pt-5 font-medium">
            Execuções recentes
          </h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-2 text-xs text-text-2 uppercase">
                <tr>
                  <th className="px-5 py-2 font-medium">Quando</th>
                  <th className="px-5 py-2 font-medium">Origem</th>
                  <th className="px-5 py-2 text-right font-medium">Atualizados</th>
                  <th className="px-5 py-2 text-right font-medium">Não encontr.</th>
                  <th className="px-5 py-2 text-right font-medium">Tempo</th>
                </tr>
              </thead>
              <tbody>
                {data.runs.slice(0, 10).map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-5 py-2 whitespace-nowrap">{dateFmt.format(new Date(r.created_at))}</td>
                    <td className="px-5 py-2 whitespace-nowrap text-text-2">
                      {ORIGIN_LABEL[r.origin]}
                      {r.day !== null && <span className="text-text-3"> · dia {r.day}</span>}
                    </td>
                    <td className="px-5 py-2 text-right tabular-nums">
                      {r.updated}
                      <span className="text-text-3">/{r.total}</span>
                    </td>
                    <td className="px-5 py-2 text-right tabular-nums">{r.not_found}</td>
                    <td className="px-5 py-2 text-right whitespace-nowrap tabular-nums">{r.duration_ms} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <dt className="text-xs text-text-2">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</dd>
      {hint && <dd className="mt-0.5 text-xs text-text-3">{hint}</dd>}
    </div>
  );
}
