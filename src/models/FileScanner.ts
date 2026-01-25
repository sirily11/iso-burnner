import { readdir, stat } from "fs/promises";
import { join, basename } from "path";
import type { FileInfo, ScanResult } from "./types";

export class FileScanner {
  /**
   * Recursively scan a directory and return all files with their sizes
   */
  async scan(dirPath: string): Promise<ScanResult> {
    const files: FileInfo[] = [];
    await this.scanDir(dirPath, files);

    const totalSize = files.reduce((sum, f) => sum + f.size, 0);

    return {
      files,
      totalSize,
      fileCount: files.length,
    };
  }

  private async scanDir(dirPath: string, files: FileInfo[]): Promise<void> {
    try {
      const entries = await readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dirPath, entry.name);

        // Skip hidden files and directories
        if (entry.name.startsWith(".")) {
          continue;
        }

        if (entry.isDirectory()) {
          await this.scanDir(fullPath, files);
        } else if (entry.isFile()) {
          try {
            const stats = await stat(fullPath);
            files.push({
              path: fullPath,
              name: entry.name,
              size: stats.size,
            });
          } catch {
            // Skip files we can't read
          }
        }
      }
    } catch (error) {
      throw new Error(
        `Failed to scan directory: ${dirPath}. ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Validate that a path exists and is a directory
   */
  async validateDirectory(dirPath: string): Promise<boolean> {
    try {
      const stats = await stat(dirPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Get the folder name from a path
   */
  getFolderName(dirPath: string): string {
    return basename(dirPath);
  }
}

export const fileScanner = new FileScanner();
