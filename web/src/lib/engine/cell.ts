import type { CellValue } from "exceljs";

/** Converte qualquer valor de célula do exceljs em texto comparável. */
export function cellText(value: CellValue | undefined): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("richText" in value) return value.richText.map((r) => r.text).join("").trim();
    if ("result" in value) return cellText(value.result as CellValue);
    if ("text" in value) return String(value.text).trim();
    if ("error" in value) return String(value.error);
    return "";
  }
  return String(value).trim();
}
