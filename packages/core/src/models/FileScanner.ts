import { readdir, stat } from "fs/promises";
import { join, basename } from "path";
import type { FileInfo, ScanResult } from "./types";

export class FileScanner {
  /**
   * Recursively scan a directory and return all files with their sizes
   */
  async scan(dirPath: string): Promise<ScanResult> {
    const files: FileInfo[] = [];
    const skippedFiles: string[] = [];
    await this.scanDir(dirPath, files, skippedFiles);

    const totalSize = files.reduce((sum, f) => sum + f.size, 0);

    // Warn about skipped files
    if (skippedFiles.length > 0) {
      console.warn(`Warning: Skipped ${skippedFiles.length} files that could not be read:`);
      skippedFiles.slice(0, 10).forEach(f => console.warn(`  - ${f}`));
      if (skippedFiles.length > 10) {
        console.warn(`  ... and ${skippedFiles.length - 10} more`);
      }
    }

    return {
      files,
      totalSize,
      fileCount: files.length,
    };
  }

  private async scanDir(dirPath: string, files: FileInfo[], skippedFiles: string[]): Promise<void> {
    try {
      const entries = await readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dirPath, entry.name);

        // Skip hidden files and directories
        if (entry.name.startsWith(".")) {
          continue;
        }

        if (entry.isDirectory()) {
          await this.scanDir(fullPath, files, skippedFiles);
        } else if (entry.isFile()) {
          try {
            const stats = await stat(fullPath);
            files.push({
              path: fullPath,
              name: entry.name,
              size: stats.size,
            });
          } catch (error) {
            // Track files we can't read
            skippedFiles.push(fullPath);
            console.warn(`Cannot read file: ${fullPath} - ${error instanceof Error ? error.message : String(error)}`);
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
