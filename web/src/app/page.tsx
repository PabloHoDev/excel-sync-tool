import Link from "next/link";
import { REPO_URL } from "@/components/site-header";
import { DEMO_PROCESS_COUNT, TEAMS } from "@/lib/demo/config";
import { formatDuration, MANUAL_SECONDS_PER_RECORD, manualMinutes } from "@/lib/metrics";

const STEPS = [
  {
    title: "Lê a exportação do sistema",
    body: "CSV ou Excel que chega todo dia do ERP, CRM ou sistema interno — a fonte da verdade.",
  },
  {
    title: "Indexa todas as abas do controle",
    body: "Encontra cada registro pela coluna-chave (ex.: Código), em qualquer aba, numa única passada.",
  },
  {
    title: "Atualiza só o que mudou",
    body: "Escreve apenas as células das colunas configuradas, e só quando o valor é diferente.",
  },
  {
    title: "Gera o log de auditoria",
    body: "Cada alteração com aba, linha, valor antigo e novo. Registros não encontrados ficam à vista.",
  },
];

const GUARANTEES = [
  ["Formatação intacta", "Cores, larguras, títulos e comentários continuam como estavam."],
  ["Proteção de aba mantida", "Abas protegidas por senha continuam protegidas depois da sincronização."],
  ["Nenhuma regra fixa no código", "Colunas, cabeçalho e abas ignoradas vêm de configuração."],
  ["Testado nas duas versões", "Motor Python (CLI) e motor TypeScript (web) com a mesma suíte de casos."],
];

export default function Home() {
  const dailyRecords = DEMO_PROCESS_COUNT + 3;

  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pt-16 pb-12 sm:pt-24">
        <p className="mb-4 inline-flex rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-text-2">
          Automação de planilhas · Python + Node.js
        </p>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          A exportação do sistema chega todo dia. A planilha de controle se atualiza sozinha.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-pretty text-text-2">
          O excel-sync-tool encontra cada registro na aba certa e atualiza só as células que mudaram, sem
          sobrescrever a formatação, sem quebrar a proteção e com log de tudo o que foi alterado.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/demo"
            className="rounded-lg bg-accent px-5 py-2.5 font-medium text-on-accent shadow-sm hover:bg-accent-hover"
          >
            Rodar a demonstração
          </Link>
          <Link href="/painel" className="rounded-lg border border-border bg-surface px-5 py-2.5 font-medium hover:bg-surface-2">
            Ver o painel de execuções
          </Link>
          <a href={REPO_URL} className="rounded-lg px-5 py-2.5 font-medium text-text-2 hover:text-text">
            Código no GitHub ↗
          </a>
        </div>
      </section>

      <section aria-labelledby="cenario" className="border-y border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <h2 id="cenario" className="text-sm font-semibold tracking-wide text-text-3 uppercase">
            O cenário da demo (empresa fictícia)
          </h2>
          <p className="mt-2 max-w-2xl text-text-2">
            A Nimbus Serviços acompanha seus processos numa planilha com uma aba por equipe. Todo dia o ERP exporta o
            status atualizado, e alguém precisa conferir linha por linha.
          </p>
          <dl className="mt-8 grid grid-cols-2 gap-6 md:grid-cols-4">
            <Stat value={String(DEMO_PROCESS_COUNT)} label="processos controlados" />
            <Stat value={String(TEAMS.length)} label="abas, uma por equipe" />
            <Stat
              value={`≈ ${formatDuration(manualMinutes(dailyRecords))}`}
              label={`por dia conferindo à mão (${MANUAL_SECONDS_PER_RECORD} s por registro)`}
            />
            <Stat value="< 1 s" label="para a ferramenta fazer o mesmo" />
          </dl>
        </div>
      </section>

      <section aria-labelledby="como" className="mx-auto max-w-6xl px-4 py-16">
        <h2 id="como" className="text-2xl font-semibold tracking-tight">
          Como funciona
        </h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-4">
          {STEPS.map((step, i) => (
            <li key={step.title} className="rounded-xl border border-border bg-surface p-5">
              <span className="font-mono text-sm text-accent">0{i + 1}</span>
              <h3 className="mt-2 font-medium">{step.title}</h3>
              <p className="mt-1 text-sm text-text-2">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="garantias" className="mx-auto grid max-w-6xl gap-10 px-4 pb-20 md:grid-cols-2">
        <div>
          <h2 id="garantias" className="text-2xl font-semibold tracking-tight">
            O que ele não estraga
          </h2>
          <ul className="mt-6 space-y-4">
            {GUARANTEES.map(([title, body]) => (
              <li key={title} className="flex gap-3">
                <span aria-hidden className="mt-0.5 text-good">
                  ✓
                </span>
                <div>
                  <p className="font-medium">{title}</p>
                  <p className="text-sm text-text-2">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Para rodar todo dia: a CLI em Python</h2>
          <p className="mt-2 text-text-2">
            A versão de linha de comando roda agendada (cron, Agendador de Tarefas) sem precisar abrir o Excel. Esta
            demo web usa o mesmo algoritmo, portado para TypeScript.
          </p>
          <pre className="mt-4 overflow-x-auto rounded-xl bg-[#0f1720] p-4 font-mono text-sm leading-relaxed text-[#d7e1ea]">
            <code>{`pip install -e .
excel-sync --config config.yaml

Resumo da sincronização
------------------------
Atualizados:      33
Sem mudança:      127
Não encontrados:  3
Total processado: 163`}</code>
          </pre>
        </div>
      </section>
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <dt className="sr-only">{label}</dt>
      <dd className="text-3xl font-semibold tracking-tight tabular-nums">{value}</dd>
      <dd className="mt-1 text-sm text-text-2">{label}</dd>
    </div>
  );
}
