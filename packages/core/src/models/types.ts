// Step states for the CLI wizard
export type Step = "folder" | "diskSize" | "summary" | "progress" | "complete";

// File information from scanning
export interface FileInfo {
  path: string;
  name: string;
  size: number; // bytes
}

// Scanned folder result
export interface ScanResult {
  files: FileInfo[];
  totalSize: number;
  fileCount: number;
}

// Saved disk size configuration
export interface SavedSize {
  bytes: number;
  label: string;
  lastUsed: string; // ISO date string
}

// User configuration stored in ~/.config/iso-bundler/config.json
export interface UserConfig {
  savedSizes: SavedSize[];
}

// A bundle represents one ISO to be created
export interface Bundle {
  files: FileInfo[];
  totalSize: number;
  name: string; // e.g., "Movies-1.iso"
}

// Bundle plan for the summary view
export interface BundlePlan {
  bundles: Bundle[];
  sourcePath: string;
  diskSizeBytes: number;
  diskSizeLabel: string;
}

// Progress information during ISO generation
export interface GenerationProgress {
  currentBundle: number;
  totalBundles: number;
  currentBundleName: string;
  progress: number; // 0-100
  completedBundles: string[];
}

// Application state
export interface AppState {
  step: Step;
  folderPath: string;
  scanResult: ScanResult | null;
  diskSizeBytes: number;
  diskSizeLabel: string;
  bundlePlan: BundlePlan | null;
  generationProgress: GenerationProgress | null;
  error: string | null;
  outputDir: string;
}
