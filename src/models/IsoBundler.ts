import { platform } from "os";
import { join, basename, dirname, relative } from "path";
import { mkdir, symlink, rm } from "fs/promises";
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

    // Create a temporary staging directory with symlinks
    const stagingDir = join(dirname(outputPath), `.staging-${Date.now()}`);
    await mkdir(stagingDir, { recursive: true });

    try {
      // Create symlinks to preserve directory structure
      for (const file of bundle.files) {
        const relativePath = relative(sourcePath, file.path);
        const targetPath = join(stagingDir, relativePath);
        const targetDir = dirname(targetPath);

        await mkdir(targetDir, { recursive: true });
        await symlink(file.path, targetPath);
      }

      onProgress(10);

      // Generate ISO based on platform
      if (os === "darwin") {
        await this.createIsoMacOS(stagingDir, outputPath, onProgress);
      } else if (os === "linux") {
        await this.createIsoLinux(stagingDir, outputPath, onProgress);
      } else if (os === "win32") {
        await this.createIsoWindows(stagingDir, outputPath, onProgress);
      } else {
        throw new Error(`Unsupported platform: ${os}`);
      }
    } finally {
      // Clean up staging directory
      await rm(stagingDir, { recursive: true, force: true });
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

    try {
      await Bun.$`hdiutil makehybrid -iso -joliet -o ${outputPath} ${sourceDir} -default-volume-name ${volumeName}`.quiet();
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

    // Try genisoimage first
    try {
      await Bun.$`which genisoimage`.quiet();
      await Bun.$`genisoimage -r -J -o ${outputPath} -V ${volumeName} ${sourceDir}`.quiet();
      onProgress(100);
      return;
    } catch {
      // genisoimage not available
    }

    // Try xorriso
    try {
      await Bun.$`which xorriso`.quiet();
      await Bun.$`xorriso -as mkisofs -r -J -o ${outputPath} -V ${volumeName} ${sourceDir}`.quiet();
      onProgress(100);
      return;
    } catch {
      // xorriso not available
    }

    throw new Error(
      "No ISO creation tool found. Please install genisoimage or xorriso:\n" +
        "  Ubuntu/Debian: sudo apt install genisoimage\n" +
        "  Fedora: sudo dnf install genisoimage\n" +
        "  Arch: sudo pacman -S cdrtools"
    );
  }

  /**
   * Windows: Use PowerShell with IMAPI2
   */
  private async createIsoWindows(
    sourceDir: string,
    outputPath: string,
    onProgress: (progress: number) => void
  ): Promise<void> {
    onProgress(20);

    const volumeName = basename(outputPath, ".iso");

    // PowerShell script using IMAPI2 COM objects
    const psScript = `
$sourcePath = "${sourceDir.replace(/\\/g, "\\\\")}"
$targetPath = "${outputPath.replace(/\\/g, "\\\\")}"
$volumeName = "${volumeName}"

$fsi = New-Object -ComObject IMAPI2FS.MsftFileSystemImage
$fsi.FileSystemsToCreate = 4  # ISO9660 + Joliet
$fsi.VolumeName = $volumeName

$rootDir = $fsi.Root
Get-ChildItem -Path $sourcePath -Recurse | ForEach-Object {
    $relativePath = $_.FullName.Substring($sourcePath.Length)
    if ($_.PSIsContainer) {
        $rootDir.AddDirectory($relativePath)
    } else {
        $stream = New-Object -ComObject ADODB.Stream
        $stream.Open()
        $stream.Type = 1  # Binary
        $stream.LoadFromFile($_.FullName)
        $rootDir.AddFile($relativePath, $stream)
        $stream.Close()
    }
}

$resultImage = $fsi.CreateResultImage()
$imageStream = $resultImage.ImageStream

$fileStream = New-Object System.IO.FileStream($targetPath, [System.IO.FileMode]::Create)
$buffer = New-Object byte[] 65536
while (($bytesRead = $imageStream.Read($buffer, 0, $buffer.Length)) -gt 0) {
    $fileStream.Write($buffer, 0, $bytesRead)
}
$fileStream.Close()
`;

    try {
      await Bun.$`powershell -ExecutionPolicy Bypass -Command ${psScript}`.quiet();
      onProgress(100);
    } catch (error) {
      throw new Error(
        `Failed to create ISO with PowerShell: ${error instanceof Error ? error.message : String(error)}`
      );
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
