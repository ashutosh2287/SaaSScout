import * as XLSX from "xlsx";
import { parseDate } from "./dates";

// SheetJS XLSX.read inflates the whole workbook archive into memory and exposes
// no decompression cap, so a small, heavily-compressed workbook can expand
// unboundedly (a zip bomb slipped past the file-size cap). Before parsing, sum
// the uncompressed sizes straight from the ZIP central directory — pure
// metadata, nothing is inflated — and reject pathological expansion.
//
// Real spreadsheets export far under this: a 20MB CSV-style workbook rarely
// unzips past ~200MB, and the file cap itself is 20MB.
const MAX_UNCOMPRESSED = 256 * 1024 * 1024;
const EOCD_SIG = 0x06054b50;
const CD_SIG = 0x02014b50;

function assertReasonableXlsxExpansion(buffer: ArrayBuffer): void {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  // End-of-central-directory sits within the last 22+64KB bytes (largest legal
  // comment). Scan backwards for its signature.
  const searchStart = Math.max(0, bytes.length - 22 - 65535);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= searchStart; i--) {
    if (view.getUint32(i, true) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("COULD_NOT_READ_XLSX");

  const totalEntries = view.getUint16(eocd + 10, true);
  let cdOffset = view.getUint32(eocd + 16, true);
  // ZIP64 sentinels mean >4GB entries/counts; impossible for a ≤20MB file
  // unless adversarial. Reject rather than chase the ZIP64 extra fields.
  if (totalEntries === 0xffff || cdOffset === 0xffffffff) {
    throw new Error("XLSX_TOO_LARGE");
  }

  let total = 0;
  for (let i = 0; i < totalEntries; i++) {
    if (cdOffset + 46 > bytes.length || view.getUint32(cdOffset, true) !== CD_SIG) {
      throw new Error("COULD_NOT_READ_XLSX");
    }
    const uncompressed = view.getUint32(cdOffset + 24, true);
    const nameLen = view.getUint16(cdOffset + 28, true);
    const extraLen = view.getUint16(cdOffset + 30, true);
    const commentLen = view.getUint16(cdOffset + 32, true);
    cdOffset += 46 + nameLen + extraLen + commentLen;
    if (uncompressed > MAX_UNCOMPRESSED || uncompressed === 0xffffffff) {
      throw new Error("XLSX_TOO_LARGE");
    }
    total += uncompressed;
    if (total > MAX_UNCOMPRESSED) throw new Error("XLSX_TOO_LARGE");
  }
}

// Sheet cells may be Date objects (cellDates: true). String(Date) produces a
// locale-dependent string such as "Fri Mar 15 2024 00:00:00 GMT+0530 (India
// Standard Time)" that parseDate rejects, silently breaking valid date cells.
// Format Date cells as YYYY-MM-DD instead; readWorksheet hands them to
// parseDate again unchanged, and sheetjs returns local-midnight Date
// instances, so the local calendar components are the ones intended.
function cellToString(c: unknown): string {
  if (c instanceof Date) {
    const d = parseDate(c);
    return d.ok ? d.value : String(c);
  }
  return String(c == null ? "" : c);
}

export async function readWorksheet(buffer: ArrayBuffer): Promise<{ header: string[]; rows: string[][] }> {
  assertReasonableXlsxExpansion(buffer);
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
    if (aoa[r].some((c) => cellToString(c).trim() !== "")) {
      header = aoa[r].map(cellToString);
      start = r + 1;
      break;
    }
  }
  if (!header) throw new Error("EMPTY_FILE");

  const rows = aoa.slice(start).map((r) => r.map(cellToString));
  return { header, rows };
}