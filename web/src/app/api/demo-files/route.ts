import Papa from "papaparse";
import { buildControlWorkbook, buildDailyExport } from "@/lib/demo/scenario";

/** Baixa os arquivos do cenário fictício, para testar o modo "seus arquivos". */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const file = params.get("file");
  const day = Number(params.get("day") ?? 1);
  if (!Number.isInteger(day) || day < 1 || day > 10_000) {
    return Response.json({ error: "Dia inválido (use 1 a 10000)." }, { status: 400 });
  }

  if (file === "controle") {
    const buffer = await (await buildControlWorkbook()).xlsx.writeBuffer();
    return new Response(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="controle_nimbus.xlsx"',
      },
    });
  }

  if (file === "exportacao") {
    const csv = "﻿" + Papa.unparse(buildDailyExport(day), { columns: ["Codigo", "Area", "Status"] });
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="exportacao_erp_dia_${day}.csv"`,
      },
    });
  }

  return Response.json({ error: 'Use ?file=controle ou ?file=exportacao&day=N' }, { status: 400 });
}
