/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Parse a human-readable size string to bytes
 * Supports formats like: "25GB", "4.7 GB", "700MB", "23.3gb", etc.
 */
export function parseSize(sizeStr: string): { bytes: number; label: string } | null {
  const normalized = sizeStr.trim().toUpperCase();

  // Match number (with optional decimal) followed by unit
  const match = normalized.match(/^([\d.]+)\s*(TB|GB|MB|KB|B)?$/);

  if (!match || !match[1]) {
    return null;
  }

  const value = parseFloat(match[1]);
  const unit = match[2] ?? "B";

  if (isNaN(value) || value <= 0) {
    return null;
  }

  let bytes: number;
  let label: string;

  switch (unit) {
    case "TB":
      bytes = value * 1024 * 1024 * 1024 * 1024;
      label = `${value} TB`;
      break;
    case "GB":
      bytes = value * 1024 * 1024 * 1024;
      label = `${value} GB`;
      break;
    case "MB":
      bytes = value * 1024 * 1024;
      label = `${value} MB`;
      break;
    case "KB":
      bytes = value * 1024;
      label = `${value} KB`;
      break;
    default:
      bytes = value;
      label = `${value} B`;
  }

  return { bytes: Math.floor(bytes), label };
}

/**
 * Format a file count with proper pluralization
 */
export function formatFileCount(count: number): string {
  return count === 1 ? "1 file" : `${count} files`;
}

/**
 * Truncate a path for display, showing only the last n segments
 */
export function truncatePath(path: string, maxLength: number = 50): string {
  if (path.length <= maxLength) return path;

  const segments = path.split("/");
  let result = "";

  for (let i = segments.length - 1; i >= 0; i--) {
    const newResult = "/" + segments.slice(i).join("/");
    if (newResult.length > maxLength - 3) {
      return "..." + result;
    }
    result = newResult;
  }

  return path;
}
