export const MAX_FILE_SIZE = 20 * 1024 * 1024;

export const SUPPORTED_EXTENSIONS = [".csv", ".xlsx"] as const;

export type FileError = {
  code: "unsupported-type" | "too-large";
  message: string;
};

export function validateFile(file: File): FileError | null {
  const name = file.name.toLowerCase();
  if (!SUPPORTED_EXTENSIONS.some((ext) => name.endsWith(ext))) {
    return {
      code: "unsupported-type",
      message: "Unsupported file type. Please upload a CSV or XLSX file.",
    };
  }
  if (file.size > MAX_FILE_SIZE) {
    return {
      code: "too-large",
      message: "File too large. This file exceeds the current upload limit.",
    };
  }
  return null;
}

export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    return `${Math.round(mb * 10) / 10} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${bytes} B`;
}