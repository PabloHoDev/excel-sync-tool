"use client";

import { useState } from "react";

export interface ChartRun {
  id: string;
  label: string;
  fullLabel: string;
  updated: number;
  total: number;
  notFound: number;
  origin: string;
}

const HEIGHT = 220;
const PAD = { top: 12, right: 8, bottom: 28, left: 36 };

/** Barras de uma série (sem legenda: o título nomeia a série), com tooltip e visão em tabela. */
export function RunsChart({ runs }: { runs: ChartRun[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);

  if (runs.length === 0) return <p className="mt-6 text-sm text-text-3">Sem execuções ainda.</p>;

  const max = Math.max(...runs.map((r) => r.updated));
  const yMax = Math.max(10, Math.ceil(max / 10) * 10);
  const ticks = [0, yMax / 2, yMax];
  const width = 640;
  const plotW = width - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const slot = plotW / runs.length;
  const barW = Math.max(3, Math.min(18, slot - 2)); // 2px de respiro entre barras
  const y = (v: number) => PAD.top + plotH - (v / yMax) * plotH;
  const labelEvery = Math.ceil(runs.length / 6);
  const active = hover !== null ? runs[hover] : null;

  return (
    <div className="mt-4">
      <div className="mb-2 flex justify-end">
        <button onClick={() => setAsTable((v) => !v)} className="text-xs text-text-3 underline-offset-4 hover:text-text hover:underline">
          {asTable ? "Ver gráfico" : "Ver como tabela"}
        </button>
      </div>

      {asTable ? (
        <div className="max-h-64 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-text-2 uppercase">
              <tr>
                <th className="py-1 font-medium">Quando</th>
                <th className="py-1 text-right font-medium">Atualizados</th>
                <th className="py-1 text-right font-medium">Conferidos</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="py-1">{r.fullLabel}</td>
                  <td className="py-1 text-right tabular-nums">{r.updated}</td>
                  <td className="py-1 text-right tabular-nums">{r.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          <svg viewBox={`0 0 ${width} ${HEIGHT}`} className="w-full" role="img" aria-label="Registros atualizados por execução">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} />
                <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--text-3)">
                  {t}
                </text>
              </g>
            ))}
            {runs.map((r, i) => {
              const cx = PAD.left + slot * i + slot / 2;
              const top = y(r.updated);
              const h = PAD.top + plotH - top;
              const radius = Math.min(4, barW / 2, h);
              return (
                <g key={r.id}>
                  {/* Barra com topo arredondado e base reta, ancorada no eixo. */}
                  <path
                    d={`M${cx - barW / 2},${PAD.top + plotH} V${top + radius} Q${cx - barW / 2},${top} ${cx - barW / 2 + radius},${top} H${cx + barW / 2 - radius} Q${cx + barW / 2},${top} ${cx + barW / 2},${top + radius} V${PAD.top + plotH} Z`}
                    fill="var(--series-1)"
                    opacity={hover === null || hover === i ? 1 : 0.45}
                  />
                  {i % labelEvery === 0 && (
                    <text x={cx} y={HEIGHT - 8} textAnchor="middle" fontSize={11} fill="var(--text-3)">
                      {r.label}
                    </text>
                  )}
                  {/* Área de hover maior que a barra. */}
                  <rect
                    x={PAD.left + slot * i}
                    y={PAD.top}
                    width={slot}
                    height={plotH}
                    fill="transparent"
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                  />
                </g>
              );
            })}
          </svg>
          {active && hover !== null && (
            <div
              role="tooltip"
              className="pointer-events-none absolute top-0 z-10 w-48 -translate-x-1/2 rounded-lg border border-border bg-surface p-3 text-xs shadow-lg"
              style={{ left: `${((PAD.left + slot * hover + slot / 2) / width) * 100}%` }}
            >
              <p className="font-medium">{active.fullLabel}</p>
              <p className="text-text-3">{active.origin}</p>
              <dl className="mt-2 space-y-0.5">
                <Row label="Atualizados" value={active.updated} />
                <Row label="Conferidos" value={active.total} />
                <Row label="Não encontrados" value={active.notFound} />
              </dl>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <dt className="text-text-2">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}
