import ExcelJS from "exceljs";
import { headers } from "next/headers";
import { saveRun } from "@/lib/db";
import type { ErrorResponse, SheetPreview, SyncResponse } from "@/lib/api-types";
import { buildControlWorkbook, buildDailyExport, DEMO_CONFIG } from "@/lib/demo/scenario";
import { cellText } from "@/lib/engine/cell";
import { changesToCsv } from "@/lib/engine/log";
import { parseSource, SourceParseError } from "@/lib/engine/source";
import { summarize, SyncConfigError, syncWorkbook } from "@/lib/engine/sync";
import type { SourceRow, SyncConfig } from "@/lib/engine/types";
import { rateLimited } from "@/lib/rate-limit";

const MAX_FILE_BYTES = 2 * 1024 * 1024; // abaixo do limite de 4,5 MB de body da Vercel
const MAX_SOURCE_ROWS = 20_000;
const MAX_CHANGES_RETURNED = 500;

class BadRequest extends Error {}

const fail = (error: string, status: number) => Response.json({ error } satisfies ErrorResponse, { status });

export async function POST(request: Request) {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (rateLimited(ip)) return fail("Muitas execuções seguidas. Aguarde um minuto.", 429);

  // Mede o processo completo (ler arquivos, sincronizar, gerar o .xlsx),
  // que é o que de fato substitui a conferência manual.
  const started = performance.now();
  try {
    const isUpload = request.headers.get("content-type")?.includes("multipart/form-data");
    const input = isUpload ? await readUpload(request) : await readDemo(request);

    const changes = syncWorkbook(input.workbook, input.rows, input.config);
    const summary = summarize(changes);
    const xlsx = await input.workbook.xlsx.writeBuffer();
    const durationMs = performance.now() - started;

    // Conteúdo de arquivos enviados não é armazenado: só as contagens.
    let runId: string | null = null;
    try {
      runId = await saveRun(
        { origin: input.origin, day: input.day ?? undefined, summary, durationMs },
        input.origin === "demo" ? changes : undefined,
      );
    } catch (err) {
      console.error(err);
    }

    const order = { OK: 0, NAO_ENCONTRADO: 1, SEM_MUDANCA: 2 } as const;

    const body: SyncResponse = {
      runId,
      saved: runId !== null,
      day: input.day,
      summary,
      durationMs: Math.round(durationMs),
      changes: [...changes].sort((a, b) => order[a.status] - order[b.status]).slice(0, MAX_CHANGES_RETURNED),
      preview: input.origin === "demo" ? buildPreview(input.workbook, input.config) : [],
      files: {
        xlsxBase64: Buffer.from(xlsx).toString("base64"),
        logCsv: changesToCsv(changes),
        fileName: input.fileName,
      },
    };
    return Response.json(body);
  } catch (err) {
    if (err instanceof BadRequest || err instanceof SyncConfigError || err instanceof SourceParseError) {
      return fail(err.message, 400);
    }
    console.error(err);
    return fail("Não foi possível processar os arquivos. Confira se são .xlsx/.csv válidos.", 500);
  }
}

interface SyncInput {
  origin: "demo" | "upload";
  day: number | null;
  workbook: ExcelJS.Workbook;
  rows: SourceRow[];
  config: SyncConfig;
  fileName: string;
}

async function readDemo(request: Request): Promise<SyncInput> {
  const body = (await request.json().catch(() => ({}))) as { day?: unknown };
  const day = Number.isInteger(body.day) ? (body.day as number) : Math.floor(Math.random() * 365) + 1;
  if (day < 1 || day > 10_000) throw new BadRequest("Dia inválido (use 1 a 10000).");

  return {
    origin: "demo",
    day,
    workbook: await buildControlWorkbook(),
    rows: buildDailyExport(day),
    config: DEMO_CONFIG,
    fileName: `controle_nimbus_dia_${day}.xlsx`,
  };
}

async function readUpload(request: Request): Promise<SyncInput> {
  const form = await request.formData();
  const target = form.get("target");
  const source = form.get("source");
  if (!(target instanceof File) || !(source instanceof File)) {
    throw new BadRequest("Envie a planilha de controle (.xlsx) e o arquivo-fonte (.csv ou .xlsx).");
  }
  if (!target.name.toLowerCase().endsWith(".xlsx")) throw new BadRequest("A planilha de controle precisa ser .xlsx.");
  for (const f of [target, source]) {
    if (f.size > MAX_FILE_BYTES) throw new BadRequest(`"${f.name}" passa de 2 MB, o limite da demo.`);
  }

  const list = (name: string) =>
    String(form.get(name) ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  const headerRow = Number(form.get("headerRow") ?? 1);
  if (!Number.isInteger(headerRow) || headerRow < 1 || headerRow > 100) {
    throw new BadRequest("Linha do cabeçalho deve ser um número entre 1 e 100.");
  }
  const config: SyncConfig = {
    keyColumn: String(form.get("keyColumn") ?? "").trim(),
    updateColumns: list("updateColumns"),
    headerRow,
    ignoredSheets: list("ignoredSheets"),
  };

  const rows = await parseSource(source.name, await source.arrayBuffer());
  if (rows.length > MAX_SOURCE_ROWS) throw new BadRequest(`A demo aceita até ${MAX_SOURCE_ROWS} linhas na fonte.`);
  if (rows.length && !(config.keyColumn in rows[0])) {
    throw new BadRequest(`A coluna-chave "${config.keyColumn}" não existe no arquivo-fonte.`);
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(await target.arrayBuffer());
  } catch {
    throw new BadRequest("Não consegui abrir a planilha de controle. Ela é um .xlsx válido?");
  }

  return {
    origin: "upload",
    day: null,
    workbook,
    rows,
    config,
    fileName: target.name.replace(/\.xlsx$/i, "") + "_sincronizado.xlsx",
  };
}

function buildPreview(wb: ExcelJS.Workbook, config: SyncConfig): SheetPreview[] {
  return wb.worksheets
    .filter((ws) => !config.ignoredSheets.includes(ws.name))
    .map((ws) => {
      const header: string[] = [];
      ws.getRow(config.headerRow).eachCell((cell, col) => {
        header[col - 1] = cellText(cell.value);
      });
      const rows: string[][] = [];
      for (let r = config.headerRow + 1; r <= ws.rowCount; r++) {
        rows.push(header.map((_, i) => cellText(ws.getCell(r, i + 1).value)));
      }
      return { name: ws.name, header, firstRow: config.headerRow + 1, rows };
    });
}
