"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { SyncResponse } from "@/lib/api-types";
import type { ChangeStatus } from "@/lib/engine/types";
import { formatDuration, MANUAL_SECONDS_PER_RECORD, manualMinutes, numberFmt } from "@/lib/metrics";
import { StatusBadge } from "../status-badge";

type Filter = ChangeStatus | "TODOS";

export function ResultView({ result }: { result: SyncResponse }) {
  const { summary } = result;
  const [view, setView] = useState<"alteracoes" | "planilha">("alteracoes");

  return (
    <section aria-labelledby="resultado" className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="resultado" className="text-2xl font-semibold tracking-tight">
            Resultado{result.day !== null && <span className="text-text-3"> · dia {result.day}</span>}
          </h2>
          <p className="mt-1 text-sm text-text-2">
            {result.saved ? (
              <>
                Execução registrada no{" "}
                <Link href="/painel" className="text-accent underline-offset-4 hover:underline">
                  painel
                </Link>
                .
              </>
            ) : (
              "Banco de dados não configurado neste ambiente: a execução não foi registrada no painel."
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <DownloadButton
            label="Planilha atualizada (.xlsx)"
            fileName={result.files.fileName}
            make={() => base64ToBlob(result.files.xlsxBase64, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
            primary
          />
          <DownloadButton
            label="Log de alterações (.csv)"
            fileName="log_atualizacao.csv"
            make={() => new Blob([result.files.logCsv], { type: "text/csv;charset=utf-8" })}
          />
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi label="Registros atualizados" value={numberFmt.format(summary.updated)} hint={`${summary.cellsChanged} células`} />
        <Kpi label="Sem mudança" value={numberFmt.format(summary.unchanged)} hint="nenhuma escrita" />
        <Kpi label="Não encontrados" value={numberFmt.format(summary.notFound)} hint="códigos novos para revisar" />
        <Kpi label="Tempo da ferramenta" value={`${numberFmt.format(result.durationMs)} ms`} hint={`${summary.total} registros`} />
        <Kpi
          label="Conferência manual estimada"
          value={formatDuration(manualMinutes(summary.total))}
          hint={`${MANUAL_SECONDS_PER_RECORD} s por registro (ilustrativo)`}
        />
      </dl>

      <div className="rounded-xl border border-border bg-surface">
        <div role="tablist" aria-label="Visualização" className="flex border-b border-border px-2">
          <Tab active={view === "alteracoes"} onClick={() => setView("alteracoes")}>
            Alterações
          </Tab>
          {result.preview.length > 0 && (
            <Tab active={view === "planilha"} onClick={() => setView("planilha")}>
              Planilha depois da sincronização
            </Tab>
          )}
        </div>
        {view === "alteracoes" ? <ChangesTable result={result} /> : <SheetPreview result={result} />}
      </div>
    </section>
  );
}

function ChangesTable({ result }: { result: SyncResponse }) {
  const [filter, setFilter] = useState<Filter>("OK");
  const rows = result.changes.filter((c) => filter === "TODOS" || c.status === filter);
  const counts: Record<Filter, number> = {
    OK: result.summary.updated,
    NAO_ENCONTRADO: result.summary.notFound,
    SEM_MUDANCA: result.summary.unchanged,
    TODOS: result.summary.total,
  };
  const labels: Record<Filter, string> = {
    OK: "Atualizados",
    NAO_ENCONTRADO: "Não encontrados",
    SEM_MUDANCA: "Sem mudança",
    TODOS: "Todos",
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 p-4">
        {(Object.keys(labels) as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={`rounded-full border px-3 py-1 text-sm ${
              filter === f ? "border-accent bg-accent-soft text-text" : "border-border text-text-2 hover:bg-surface-2"
            }`}
          >
            {labels[f]} <span className="tabular-nums text-text-3">{counts[f]}</span>
          </button>
        ))}
      </div>
      <div className="max-h-[28rem] overflow-auto border-t border-border">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-surface-2 text-xs text-text-2 uppercase">
            <tr>
              <th className="px-4 py-2 font-medium">Código</th>
              <th className="px-4 py-2 font-medium">Aba</th>
              <th className="px-4 py-2 font-medium">Linha</th>
              <th className="px-4 py-2 font-medium">Situação</th>
              <th className="px-4 py-2 font-medium">Mudança</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={`${c.sheet}-${c.keyValue}-${c.row}`} className="border-t border-border">
                <td className="px-4 py-2 font-mono whitespace-nowrap">{c.keyValue}</td>
                <td className="px-4 py-2">{c.sheet}</td>
                <td className="px-4 py-2 tabular-nums">{c.row}</td>
                <td className="px-4 py-2">
                  <StatusBadge status={c.status} />
                </td>
                <td className="px-4 py-2">
                  {c.updatedColumns.map((col) => (
                    <div key={col}>
                      <span className="text-text-3">{col}: </span>
                      <span className="text-text-3 line-through">{c.oldValues[col] || "(vazio)"}</span>
                      <span aria-label="para"> → </span>
                      <strong className="font-medium">{c.newValues[col]}</strong>
                    </div>
                  ))}
                  {c.status === "NAO_ENCONTRADO" && <span className="text-text-3">Código não existe no controle</span>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-text-3">
                  Nenhum registro nesta situação.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SheetPreview({ result }: { result: SyncResponse }) {
  const [active, setActive] = useState(result.preview[0]?.name);
  const sheet = result.preview.find((s) => s.name === active) ?? result.preview[0];

  // sheet|linha|coluna -> valor antigo, para destacar as células alteradas.
  const changed = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of result.changes) {
      for (const col of c.updatedColumns) map.set(`${c.sheet}|${c.row}|${col}`, c.oldValues[col]);
    }
    return map;
  }, [result.changes]);

  if (!sheet) return null;
  return (
    <div>
      <div className="flex flex-wrap gap-1 p-3">
        {result.preview.map((s) => (
          <button
            key={s.name}
            onClick={() => setActive(s.name)}
            aria-pressed={s.name === sheet.name}
            className={`rounded-md px-3 py-1 text-sm ${
              s.name === sheet.name ? "bg-accent text-on-accent" : "text-text-2 hover:bg-surface-2"
            }`}
          >
            {s.name} <span className="opacity-75">({result.summary.bySheet[s.name] ?? 0})</span>
          </button>
        ))}
        <p className="ml-auto self-center text-xs text-text-3">
          <span className="mr-1 inline-block size-3 rounded-sm bg-changed align-middle ring-1 ring-border" /> célula
          alterada (passe o mouse para ver o valor anterior)
        </p>
      </div>
      <div className="max-h-[28rem] overflow-auto border-t border-border">
        <table className="w-full font-mono text-xs">
          <thead className="sticky top-0 bg-surface-2 text-text-2">
            <tr>
              <th className="w-12 px-2 py-1.5 text-right font-normal">#</th>
              {sheet.header.map((h) => (
                <th key={h} className="px-3 py-1.5 text-left font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sheet.rows.map((row, i) => {
              const excelRow = sheet.firstRow + i;
              return (
                <tr key={excelRow} className="border-t border-border">
                  <td className="px-2 py-1 text-right text-text-3">{excelRow}</td>
                  {row.map((value, j) => {
                    const old = changed.get(`${sheet.name}|${excelRow}|${sheet.header[j]}`);
                    return (
                      <td
                        key={j}
                        title={old !== undefined ? `Antes: ${old || "(vazio)"}` : undefined}
                        className={`px-3 py-1 whitespace-nowrap ${old !== undefined ? "bg-changed font-semibold" : ""}`}
                      >
                        {value}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <dt className="text-xs text-text-2">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</dd>
      <dd className="mt-0.5 text-xs text-text-3">{hint}</dd>
    </div>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-3 text-sm font-medium ${
        active ? "border-accent text-text" : "border-transparent text-text-3 hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}

function DownloadButton({
  label,
  fileName,
  make,
  primary,
}: {
  label: string;
  fileName: string;
  make: () => Blob;
  primary?: boolean;
}) {
  return (
    <button
      onClick={() => {
        const url = URL.createObjectURL(make());
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      }}
      className={
        primary
          ? "rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:bg-accent-hover"
          : "rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-surface-2"
      }
    >
      ↓ {label}
    </button>
  );
}

function base64ToBlob(b64: string, type: string) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}
