import * as XLSX from "xlsx";

export async function readWorksheet(buffer: ArrayBuffer): Promise<{ header: string[]; rows: string[][] }> {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error("EMPTY_FILE");
  }
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("EMPTY_FILE");

  type Cell = string | number | boolean | Date | null | undefined;
  const aoa = XLSX.utils.sheet_to_json<Cell[]>(sheet, { header: 1, defval: "" });

  // Find first meaningful row as the header.
  let header: string[] | null = null;
  let start = 0;
  for (let r = 0; r < aoa.length; r++) {
    if (aoa[r].some((c) => String(c).trim() !== "")) {
      header = aoa[r].map((c) => String(c));
      start = r + 1;
      break;
    }
  }
  if (!header) throw new Error("EMPTY_FILE");

  const rows = aoa.slice(start).map((r) => r.map((c) => String(c)));
  return { header, rows };
}