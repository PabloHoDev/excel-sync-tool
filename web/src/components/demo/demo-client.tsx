"use client";

import { useState } from "react";
import type { ErrorResponse, SyncResponse } from "@/lib/api-types";
import { DEMO_CONFIG } from "@/lib/demo/config";
import { ResultView } from "./result-view";

type Mode = "exemplo" | "arquivos";

const randomDay = () => Math.floor(Math.random() * 365) + 1;

export function DemoClient() {
  const [mode, setMode] = useState<Mode>("exemplo");
  const [day, setDay] = useState(12);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SyncResponse | null>(null);

  async function run(init: RequestInit) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/sync", { method: "POST", ...init });
      const body = (await res.json()) as SyncResponse | ErrorResponse;
      if (!res.ok || "error" in body) {
        setError("error" in body ? body.error : "Falha na sincronização.");
        return;
      }
      setResult(body);
    } catch {
      setError("Não foi possível falar com o servidor. Tente de novo.");
    } finally {
      setLoading(false);
    }
  }

  function runExample(nextDay = day) {
    setDay(nextDay);
    run({ headers: { "Content-Type": "application/json" }, body: JSON.stringify({ day: nextDay }) });
  }

  return (
    <div className="mt-8 space-y-8">
      <div className="rounded-xl border border-border bg-surface">
        <div role="tablist" aria-label="Origem dos dados" className="flex border-b border-border px-2">
          {(
            [
              ["exemplo", "Cenário de exemplo"],
              ["arquivos", "Seus arquivos"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              role="tab"
              aria-selected={mode === value}
              onClick={() => setMode(value)}
              className={`-mb-px border-b-2 px-4 py-3 text-sm font-medium ${
                mode === value ? "border-accent text-text" : "border-transparent text-text-3 hover:text-text"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {mode === "exemplo" ? (
            <ExamplePanel day={day} setDay={setDay} loading={loading} onRun={runExample} />
          ) : (
            <UploadPanel loading={loading} onSubmit={(form) => run({ body: form })} />
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-sm">
          <span aria-hidden>⚠ </span>
          {error}
        </p>
      )}

      {result && <ResultView result={result} />}
    </div>
  );
}

function ExamplePanel({
  day,
  setDay,
  loading,
  onRun,
}: {
  day: number;
  setDay: (d: number) => void;
  loading: boolean;
  onRun: (day?: number) => void;
}) {
  return (
    <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
      <div className="space-y-3 text-sm text-text-2">
        <p>
          <strong className="text-text">Planilha de controle:</strong> 160 processos em 4 abas (Financeiro, Jurídico,
          Comercial, RH), cabeçalho na linha {DEMO_CONFIG.headerRow}, aba Jurídico protegida por senha e uma aba de
          resumo que deve ser ignorada.
        </p>
        <p>
          <strong className="text-text">Exportação do ERP:</strong> gerada para o dia escolhido. Cerca de 20% dos
          processos mudam de status, alguns trocam de equipe e aparecem códigos novos que ainda não estão no controle.
        </p>
        <p className="text-text-3">
          Baixe os arquivos para abrir no Excel ou testar em “Seus arquivos”:{" "}
          <a className="text-accent underline-offset-4 hover:underline" href="/api/demo-files?file=controle">
            controle_nimbus.xlsx
          </a>{" "}
          ·{" "}
          <a className="text-accent underline-offset-4 hover:underline" href={`/api/demo-files?file=exportacao&day=${day}`}>
            exportação do dia {day}.csv
          </a>
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-text-2">Dia simulado</span>
          <input
            type="number"
            min={1}
            max={10000}
            value={day}
            onChange={(e) => setDay(Math.max(1, Math.min(10000, Number(e.target.value) || 1)))}
            className="w-24 rounded-lg border border-border bg-bg px-3 py-2 tabular-nums"
          />
        </label>
        <button
          type="button"
          onClick={() => onRun(randomDay())}
          disabled={loading}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-surface-2 disabled:opacity-50"
        >
          Sortear dia
        </button>
        <button
          type="button"
          onClick={() => onRun()}
          disabled={loading}
          className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-on-accent hover:bg-accent-hover disabled:opacity-50"
        >
          {loading ? "Sincronizando…" : "Sincronizar"}
        </button>
      </div>
    </div>
  );
}

function UploadPanel({ loading, onSubmit }: { loading: boolean; onSubmit: (form: FormData) => void }) {
  const field = "w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm";
  return (
    <form
      className="grid gap-5 md:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(new FormData(e.currentTarget));
      }}
    >
      <label className="text-sm">
        <span className="mb-1 block font-medium">Planilha de controle (.xlsx)</span>
        <input name="target" type="file" accept=".xlsx" required className={field} />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Exportação do sistema (.csv ou .xlsx)</span>
        <input name="source" type="file" accept=".csv,.xlsx" required className={field} />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Coluna-chave</span>
        <input name="keyColumn" defaultValue="Codigo" required className={field} />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Colunas a atualizar (separadas por vírgula)</span>
        <input name="updateColumns" defaultValue="Area, Status" required className={field} />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Linha do cabeçalho</span>
        <input name="headerRow" type="number" min={1} max={100} defaultValue={4} required className={field} />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Abas a ignorar (opcional)</span>
        <input name="ignoredSheets" defaultValue="VISAO GERAL" className={field} />
      </label>
      <div className="flex flex-col gap-3 md:col-span-2 md:flex-row md:items-center md:justify-between">
        <p className="text-xs text-text-3">
          Até 2 MB por arquivo. Os arquivos são processados em memória e descartados: só as contagens (atualizados,
          sem mudança, não encontrados) vão para o painel.
        </p>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-on-accent hover:bg-accent-hover disabled:opacity-50"
        >
          {loading ? "Sincronizando…" : "Sincronizar arquivos"}
        </button>
      </div>
    </form>
  );
}
