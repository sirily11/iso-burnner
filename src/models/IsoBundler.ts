import { platform } from "os";
import { join, basename, dirname, relative } from "path";
import { mkdir, symlink, rm, writeFile, unlink, readdir, stat } from "fs/promises";
import type { FileInfo, Bundle, BundlePlan, GenerationProgress } from "./types";

export type ProgressCallback = (progress: GenerationProgress) => void;

export class IsoBundler {
  /**
   * Plan bundles using First-Fit Decreasing bin packing algorithm
   */
  planBundles(
    files: FileInfo[],
    diskSizeBytes: number,
    diskSizeLabel: string,
    sourcePath: string
  ): BundlePlan {
    const folderName = basename(sourcePath);

    // Check for files larger than disk size
    const oversizedFiles = files.filter((f) => f.size > diskSizeBytes);
    if (oversizedFiles.length > 0) {
      throw new Error(
        `The following files are larger than the disk size (${diskSizeLabel}):\n` +
          oversizedFiles.map((f) => `  - ${f.name} (${formatBytes(f.size)})`).join("\n")
      );
    }

    // Sort files by size (largest first) for First-Fit Decreasing
    const sortedFiles = [...files].sort((a, b) => b.size - a.size);

    const bundles: Bundle[] = [];

    for (const file of sortedFiles) {
      // Try to fit file in existing bundle
      let placed = false;
      for (const bundle of bundles) {
        if (bundle.totalSize + file.size <= diskSizeBytes) {
          bundle.files.push(file);
          bundle.totalSize += file.size;
          placed = true;
          break;
        }
      }

      // If no existing bundle can fit the file, create a new one
      if (!placed) {
        bundles.push({
          files: [file],
          totalSize: file.size,
          name: "", // Will be set below
        });
      }
    }

    // Name the bundles
    if (bundles.length === 1 && bundles[0]) {
      bundles[0].name = `${folderName}.iso`;
    } else {
      bundles.forEach((bundle, index) => {
        bundle.name = `${folderName}-${index + 1}.iso`;
      });
    }

    return {
      bundles,
      sourcePath,
      diskSizeBytes,
      diskSizeLabel,
    };
  }

  /**
   * Generate ISO files from a bundle plan
   */
  async generateIsos(
    plan: BundlePlan,
    outputDir: string,
    onProgress: ProgressCallback
  ): Promise<string[]> {
    const createdIsos: string[] = [];
    const completedBundles: string[] = [];

    for (let i = 0; i < plan.bundles.length; i++) {
      const bundle = plan.bundles[i];
      if (!bundle) continue;

      const isoPath = join(outputDir, bundle.name);

      onProgress({
        currentBundle: i + 1,
        totalBundles: plan.bundles.length,
        currentBundleName: bundle.name,
        progress: 0,
        completedBundles: [...completedBundles],
      });

      await this.createIso(bundle, plan.sourcePath, isoPath, (progress) => {
        onProgress({
          currentBundle: i + 1,
          totalBundles: plan.bundles.length,
          currentBundleName: bundle.name,
          progress,
          completedBundles: [...completedBundles],
        });
      });

      completedBundles.push(bundle.name);
      createdIsos.push(isoPath);
    }

    // Final progress update
    const lastBundle = plan.bundles[plan.bundles.length - 1];
    if (lastBundle) {
      onProgress({
        currentBundle: plan.bundles.length,
        totalBundles: plan.bundles.length,
        currentBundleName: lastBundle.name,
        progress: 100,
        completedBundles,
      });
    }

    return createdIsos;
  }

  /**
   * Create a single ISO file from a bundle
   */
  private async createIso(
    bundle: Bundle,
    sourcePath: string,
    outputPath: string,
    onProgress: (progress: number) => void
  ): Promise<void> {
    const os = platform();

    // Windows: Skip staging directory and process files directly
    if (os === "win32") {
      await this.createIsoWindows(bundle, sourcePath, outputPath, onProgress);
      return;
    }

    // macOS/Linux: Use staging directory with symlinks
    const stagingDir = join(dirname(outputPath), `.staging-${Date.now()}`);
    await mkdir(stagingDir, { recursive: true });

    try {
      // Create symlinks to preserve directory structure
      let symlinkCount = 0;
      for (const file of bundle.files) {
        const relativePath = relative(sourcePath, file.path);
        const targetPath = join(stagingDir, relativePath);
        const targetDir = dirname(targetPath);

        await mkdir(targetDir, { recursive: true });

        try {
          await symlink(file.path, targetPath);
          symlinkCount++;
        } catch (error) {
          console.error(`Failed to create symlink for ${file.path}: ${error}`);
          throw new Error(`Failed to create symlink for ${relativePath}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      console.log(`Created ${symlinkCount} symlinks in staging directory`);
      onProgress(10);

      // Generate ISO based on platform
      if (os === "darwin") {
        await this.createIsoMacOS(stagingDir, outputPath, onProgress);
      } else if (os === "linux") {
        await this.createIsoLinux(stagingDir, outputPath, onProgress);
      } else {
        throw new Error(`Unsupported platform: ${os}`);
      }
    } finally {
      // Clean up staging directory
      await rm(stagingDir, { recursive: true, force: true });
    }
  }

  /**
   * Count files recursively in a directory
   */
  private async countFilesInDir(dirPath: string): Promise<number> {
    let count = 0;
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);
      if (entry.isDirectory()) {
        count += await this.countFilesInDir(fullPath);
      } else if (entry.isFile() || entry.isSymbolicLink()) {
        count++;
      }
    }

    return count;
  }

  /**
   * Verify ISO was created successfully with expected file count
   */
  private async verifyIsoCreation(isoPath: string, expectedFileCount: number): Promise<void> {
    try {
      const isoStat = await stat(isoPath);
      const isoSizeMB = (isoStat.size / 1024 / 1024).toFixed(2);

      console.log(`ISO created successfully: ${isoPath}`);
      console.log(`ISO size: ${isoSizeMB} MB (${isoStat.size} bytes)`);

      // Warn if ISO is suspiciously small (< 2KB per file suggests symlinks weren't followed)
      const minExpectedSize = expectedFileCount * 2048; // 2KB per file minimum
      if (isoStat.size < minExpectedSize) {
        console.warn(`WARNING: ISO size (${isoStat.size} bytes) is smaller than expected for ${expectedFileCount} files`);
        console.warn(`This may indicate symlinks were not followed properly`);
      }
    } catch (error) {
      throw new Error(`Failed to verify ISO creation: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * macOS: Use hdiutil makehybrid
   */
  private async createIsoMacOS(
    sourceDir: string,
    outputPath: string,
    onProgress: (progress: number) => void
  ): Promise<void> {
    onProgress(20);

    const volumeName = basename(outputPath, ".iso");

    // Count files in staging directory for verification
    const fileCount = await this.countFilesInDir(sourceDir);
    console.log(`Creating ISO from staging directory: ${sourceDir}`);
    console.log(`Files in staging directory: ${fileCount}`);
    console.log("Using hdiutil to create ISO...");

    try {
      const proc = Bun.spawn(
        ['hdiutil', 'makehybrid', '-iso', '-joliet', '-o', outputPath, sourceDir, '-default-volume-name', volumeName],
        { stdout: 'pipe', stderr: 'pipe' }
      );

      const [exitCode, stdout, stderr] = await Promise.all([
        proc.exited,
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text()
      ]);

      if (stdout) console.log('hdiutil output:', stdout);
      if (stderr) console.log('hdiutil info:', stderr);

      if (exitCode !== 0) {
        throw new Error(`hdiutil exited with code ${exitCode}`);
      }

      await this.verifyIsoCreation(outputPath, fileCount);
      onProgress(100);
    } catch (error) {
      throw new Error(
        `Failed to create ISO with hdiutil: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Linux: Use genisoimage or xorriso
   */
  private async createIsoLinux(
    sourceDir: string,
    outputPath: string,
    onProgress: (progress: number) => void
  ): Promise<void> {
    onProgress(20);

    const volumeName = basename(outputPath, ".iso");

    // Count files in staging directory for verification
    const fileCount = await this.countFilesInDir(sourceDir);
    console.log(`Creating ISO from staging directory: ${sourceDir}`);
    console.log(`Files in staging directory: ${fileCount}`);

    // Try genisoimage first
    try {
      await Bun.$`which genisoimage`.quiet();
      console.log("Using genisoimage to create ISO...");

      const proc = Bun.spawn(
        ['genisoimage', '-r', '-J', '-f', '-iso-level', '3', '-udf', '-allow-limited-size', '-o', outputPath, '-V', volumeName, sourceDir],
        { stdout: 'pipe', stderr: 'pipe' }
      );

      const [exitCode, stdout, stderr] = await Promise.all([
        proc.exited,
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text()
      ]);

      if (stdout) console.log('genisoimage output:', stdout);
      if (stderr) console.log('genisoimage info:', stderr);

      if (exitCode !== 0) {
        throw new Error(`genisoimage exited with code ${exitCode}`);
      }

      await this.verifyIsoCreation(outputPath, fileCount);
      onProgress(100);
      return;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // genisoimage not available, try xorriso
      } else {
        throw error;
      }
    }

    // Try xorriso
    try {
      await Bun.$`which xorriso`.quiet();
      console.log("Using xorriso to create ISO...");

      const proc = Bun.spawn(
        ['xorriso', '-as', 'mkisofs', '-r', '-J', '-follow-links', '-iso-level', '3', '-udf', '-allow-limited-size', '-o', outputPath, '-V', volumeName, sourceDir],
        { stdout: 'pipe', stderr: 'pipe' }
      );

      const [exitCode, stdout, stderr] = await Promise.all([
        proc.exited,
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text()
      ]);

      if (stdout) console.log('xorriso output:', stdout);
      if (stderr) console.log('xorriso info:', stderr);

      if (exitCode !== 0) {
        throw new Error(`xorriso exited with code ${exitCode}`);
      }

      await this.verifyIsoCreation(outputPath, fileCount);
      onProgress(100);
      return;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // xorriso not available
        throw new Error(
          "No ISO creation tool found. Please install genisoimage or xorriso:\n" +
          "  Ubuntu/Debian: sudo apt install genisoimage\n" +
          "  Fedora: sudo dnf install genisoimage\n" +
          "  Arch: sudo pacman -S cdrtools"
        );
      } else {
        throw error;
      }
    }
  }

  /**
   * Windows: Use PowerShell with IMAPI2
   * Process files directly from original locations without staging directory
   */
  private async createIsoWindows(
    bundle: Bundle,
    sourcePath: string,
    outputPath: string,
    onProgress: (progress: number) => void
  ): Promise<void> {
    onProgress(20);

    const volumeName = basename(outputPath, ".iso");

    // Build file mapping with original paths and relative paths
    const fileMapping = bundle.files.map(file => ({
      path: file.path,
      relativePath: relative(sourcePath, file.path)
    }));

    // Write JSON to temp file to avoid command line escaping issues
    const tempJsonPath = join(dirname(outputPath), `.files-${Date.now()}.json`);
    await writeFile(tempJsonPath, JSON.stringify(fileMapping, null, 2), 'utf-8');

    // Write PowerShell script to temp file for better error handling
    const tempPsPath = join(dirname(outputPath), `.create-iso-${Date.now()}.ps1`);
    const psScript = `
$jsonPath = "${tempJsonPath.replace(/\\/g, "/")}"
$targetPath = "${outputPath.replace(/\\/g, "/")}"
$volumeName = "${volumeName}"

$ErrorActionPreference = "Stop"

# Add C# helpers: IStream wrapper for large files + IStream-to-file copier
Add-Type -TypeDefinition @"
using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;

public class IStreamHelper {
    public static void CopyStreamToFile(object comStream, string filePath) {
        IStream istream = (IStream)comStream;
        using (FileStream fileStream = new FileStream(filePath, FileMode.Create, FileAccess.Write, FileShare.None, 1048576)) {
            byte[] buffer = new byte[1048576];
            IntPtr bytesReadPtr = Marshal.AllocCoTaskMem(sizeof(int));
            try {
                while (true) {
                    istream.Read(buffer, buffer.Length, bytesReadPtr);
                    int bytesRead = Marshal.ReadInt32(bytesReadPtr);
                    if (bytesRead <= 0) break;
                    fileStream.Write(buffer, 0, bytesRead);
                }
                fileStream.Flush();
            } finally {
                Marshal.FreeCoTaskMem(bytesReadPtr);
            }
        }
    }
}

// Managed IStream implementation that wraps FileStream for large file support (>2GB)
// ADODB.Stream is limited to ~2GB; this has no such limitation.
public class ManagedIStream : IStream, IDisposable {
    private FileStream _stream;

    public ManagedIStream(string filePath) {
        _stream = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.Read, 1048576);
    }

    public void Read(byte[] pv, int cb, IntPtr pcbRead) {
        int bytesRead = _stream.Read(pv, 0, cb);
        if (pcbRead != IntPtr.Zero) Marshal.WriteInt32(pcbRead, bytesRead);
    }

    public void Write(byte[] pv, int cb, IntPtr pcbWritten) {
        throw new NotImplementedException();
    }

    public void Seek(long dlibMove, int dwOrigin, IntPtr plibNewPosition) {
        long pos = _stream.Seek(dlibMove, (SeekOrigin)dwOrigin);
        if (plibNewPosition != IntPtr.Zero) Marshal.WriteInt64(plibNewPosition, pos);
    }

    public void SetSize(long libNewSize) {
        _stream.SetLength(libNewSize);
    }

    public void CopyTo(IStream pstm, long cb, IntPtr pcbRead, IntPtr pcbWritten) {
        throw new NotImplementedException();
    }

    public void Commit(int grfCommitFlags) {
        _stream.Flush();
    }

    public void Revert() {
        throw new NotImplementedException();
    }

    public void LockRegion(long libOffset, long cb, int dwLockType) {
        throw new NotImplementedException();
    }

    public void UnlockRegion(long libOffset, long cb, int dwLockType) {
        throw new NotImplementedException();
    }

    public void Stat(out System.Runtime.InteropServices.ComTypes.STATSTG pstatstg, int grfStatFlag) {
        pstatstg = new System.Runtime.InteropServices.ComTypes.STATSTG();
        pstatstg.type = 2; // STGTY_STREAM
        pstatstg.cbSize = _stream.Length;
    }

    public void Clone(out IStream ppstm) {
        throw new NotImplementedException();
    }

    public void Dispose() {
        if (_stream != null) {
            _stream.Dispose();
            _stream = null;
        }
    }
}
"@

try {
    Write-Host "Reading file list from: $jsonPath"
    $files = Get-Content -Path $jsonPath -Raw | ConvertFrom-Json
    Write-Host "Processing $($files.Count) files"

    $fsi = New-Object -ComObject IMAPI2FS.MsftFileSystemImage
    $fsi.FileSystemsToCreate = 4  # UDF (supports files > 4GB)
    $fsi.VolumeName = $volumeName

    # Track created directories to avoid duplicates
    $createdDirs = @{}

    # Keep all streams open until ISO is created
    $openStreams = @()

    foreach ($file in $files) {
        # Normalize the relative path - convert forward slashes to backslashes, NO leading backslash
        $relativePath = $file.relativePath -replace '/', '\\\\'
        $relativePath = $relativePath -replace '^[\\\\/]+', ''

        Write-Host "Processing: $relativePath"

        # Get just the filename for files in root
        $fileName = Split-Path -Path $relativePath -Leaf
        $dirPath = Split-Path -Path $relativePath -Parent

        # Create parent directories if needed (only for files in subdirectories)
        if ($dirPath -and -not $createdDirs.ContainsKey($dirPath)) {
            # Create all parent directories recursively
            $dirs = $dirPath -split '\\\\'
            $currentPath = ""
            foreach ($dir in $dirs) {
                if ($dir) {
                    if ($currentPath) {
                        $currentPath = "$currentPath\\$dir"
                    } else {
                        $currentPath = $dir
                    }
                    if (-not $createdDirs.ContainsKey($currentPath)) {
                        Write-Host "Creating directory: $currentPath"
                        # Get the directory item to add to
                        $parentDir = $fsi.Root
                        $pathParts = $currentPath -split '\\\\'
                        $buildPath = ""
                        foreach ($part in $pathParts) {
                            if ($part) {
                                if ($buildPath) {
                                    $buildPath = "$buildPath\\$part"
                                } else {
                                    $buildPath = $part
                                }
                                try {
                                    $parentDir = $fsi.Root.Item($buildPath)
                                } catch {
                                    # Directory doesn't exist, create it
                                    $parentDir.AddDirectory($part)
                                    $parentDir = $fsi.Root.Item($buildPath)
                                }
                            }
                        }
                        $createdDirs[$currentPath] = $true
                    }
                }
            }
        }

        # Add file from original location to ISO location
        Write-Host "Adding file: $fileName to path: $relativePath from $($file.path)"

        # Verify file exists and get size
        if (-not (Test-Path $file.path)) {
            throw "File not found: $($file.path)"
        }

        $fileInfo = Get-Item $file.path
        $fileSizeMB = [math]::Round($fileInfo.Length / 1MB, 2)
        Write-Host "  File size: $fileSizeMB MB"

        try {
            Write-Host "  Opening file stream..."
            $stream = New-Object ManagedIStream($file.path)
            Write-Host "  File stream opened successfully"

            # Add to appropriate directory
            Write-Host "  Adding to ISO structure..."
            if ($dirPath) {
                $targetDir = $fsi.Root.Item($dirPath)
                $targetDir.AddFile($fileName, $stream)
            } else {
                # File in root
                $fsi.Root.AddFile($fileName, $stream)
            }
            Write-Host "  Added successfully"

            # Keep stream open - IMAPI2 needs to read from it later
            $openStreams += $stream
        } catch {
            Write-Host "  ERROR adding file: $_"
            Write-Host "  File: $($file.path)"
            Write-Host "  Size: $fileSizeMB MB"
            Write-Host "  FileName: $fileName"
            Write-Host "  DirPath: $dirPath"
            # Dispose stream on error
            if ($stream) { $stream.Dispose() }
            throw $_
        }
    }

    Write-Host "Creating ISO file..."
    $resultImage = $fsi.CreateResultImage()

    # Get block data for size info
    $totalBlocks = $resultImage.TotalBlocks
    $blockSize = $resultImage.BlockSize
    $totalSize = [int64]$totalBlocks * [int64]$blockSize

    Write-Host "ISO size: $([math]::Round($totalSize / 1MB, 2)) MB ($totalBlocks blocks x $blockSize bytes)"

    # Use C# helper to copy IStream to file
    $imageStream = $resultImage.ImageStream
    [IStreamHelper]::CopyStreamToFile($imageStream, $targetPath)

    # Now safe to dispose all streams
    Write-Host "Disposing $($openStreams.Count) file streams..."
    foreach ($stream in $openStreams) {
        try { $stream.Dispose() } catch { }
    }

    $actualSize = (Get-Item $targetPath).Length
    Write-Host "ISO created successfully: $targetPath"
    Write-Host "File size: $([math]::Round($actualSize / 1MB, 2)) MB"
} catch {
    Write-Error "Failed to create ISO: $_"
    Write-Error $_.Exception.Message
    Write-Error $_.ScriptStackTrace
    exit 1
}
`;

    await writeFile(tempPsPath, psScript, 'utf-8');

    try {
      const proc = Bun.spawn(['powershell', '-ExecutionPolicy', 'Bypass', '-File', tempPsPath], {
        stdout: 'pipe',
        stderr: 'pipe'
      });

      const [exitCode, stdout, stderr] = await Promise.all([
        proc.exited,
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text()
      ]);

      // Log output for debugging
      if (stdout) console.log('PowerShell output:', stdout);
      if (stderr) console.error('PowerShell errors:', stderr);

      if (exitCode !== 0) {
        throw new Error(`PowerShell exited with code ${exitCode}\nOutput: ${stdout}\nErrors: ${stderr}`);
      }

      onProgress(100);
    } catch (error: any) {
      throw new Error(
        `Failed to create ISO with PowerShell: ${error.message || String(error)}`
      );
    } finally {
      // Clean up temp files
      try {
        await unlink(tempJsonPath);
      } catch {}
      try {
        await unlink(tempPsPath);
      } catch {}
    }
  }

  /**
   * Check if ISO creation tools are available
   */
  async checkTools(): Promise<{ available: boolean; tool: string | null; message: string }> {
    const os = platform();

    if (os === "darwin") {
      try {
        await Bun.$`which hdiutil`.quiet();
        return { available: true, tool: "hdiutil", message: "Using hdiutil (macOS built-in)" };
      } catch {
        return { available: false, tool: null, message: "hdiutil not found" };
      }
    }

    if (os === "linux") {
      try {
        await Bun.$`which genisoimage`.quiet();
        return { available: true, tool: "genisoimage", message: "Using genisoimage" };
      } catch {
        // Try xorriso
      }

      try {
        await Bun.$`which xorriso`.quiet();
        return { available: true, tool: "xorriso", message: "Using xorriso" };
      } catch {
        return {
          available: false,
          tool: null,
          message: "No ISO tool found. Install genisoimage or xorriso.",
        };
      }
    }

    if (os === "win32") {
      // PowerShell IMAPI2 is always available on Windows 7+
      return { available: true, tool: "powershell", message: "Using PowerShell IMAPI2" };
    }

    return { available: false, tool: null, message: `Unsupported platform: ${os}` };
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export const isoBundler = new IsoBundler();
