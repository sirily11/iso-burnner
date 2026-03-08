import { dirname } from "path";
import type { AppState, Step, BundlePlan, GenerationProgress, SavedSize } from "@iso-bundler/core";
import { configStore, fileScanner, isoBundler, parseSize } from "@iso-bundler/core";

export type StateListener = (state: AppState) => void;

export class MainController {
  private state: AppState = {
    step: "folder",
    folderPath: "",
    scanResult: null,
    diskSizeBytes: 0,
    diskSizeLabel: "",
    bundlePlan: null,
    generationProgress: null,
    error: null,
    outputDir: "",
  };

  private listeners: StateListener[] = [];

  /**
   * Initialize the controller
   */
  async init(): Promise<void> {
    await configStore.load();

    // Check if ISO tools are available
    const toolCheck = await isoBundler.checkTools();
    if (!toolCheck.available) {
      this.setState({ error: toolCheck.message });
    }
  }

  /**
   * Get current state
   */
  getState(): AppState {
    return { ...this.state };
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: StateListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /**
   * Update state and notify listeners
   */
  private setState(partial: Partial<AppState>): void {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach((listener) => listener(this.state));
  }

  /**
   * Get saved disk sizes
   */
  getSavedSizes(): SavedSize[] {
    return configStore.getSavedSizes();
  }

  /**
   * Set folder path and scan it
   */
  async setFolderPath(path: string): Promise<boolean> {
    this.setState({ error: null });

    const trimmedPath = path.trim();
    if (!trimmedPath) {
      this.setState({ error: "Please enter a folder path" });
      return false;
    }

    const isValid = await fileScanner.validateDirectory(trimmedPath);
    if (!isValid) {
      this.setState({ error: "Invalid directory path" });
      return false;
    }

    try {
      const scanResult = await fileScanner.scan(trimmedPath);

      if (scanResult.fileCount === 0) {
        this.setState({ error: "No files found in the directory" });
        return false;
      }

      this.setState({
        folderPath: trimmedPath,
        scanResult,
        outputDir: dirname(trimmedPath),
        step: "diskSize",
      });

      return true;
    } catch (error) {
      this.setState({
        error: error instanceof Error ? error.message : "Failed to scan directory",
      });
      return false;
    }
  }

  /**
   * Set disk size from string input
   */
  async setDiskSize(sizeInput: string): Promise<boolean> {
    this.setState({ error: null });

    const parsed = parseSize(sizeInput);
    if (!parsed) {
      this.setState({ error: "Invalid size format. Examples: 25GB, 4.7GB, 700MB" });
      return false;
    }

    return this.setDiskSizeBytes(parsed.bytes, parsed.label);
  }

  /**
   * Set disk size from bytes (for saved sizes)
   */
  async setDiskSizeBytes(bytes: number, label: string): Promise<boolean> {
    this.setState({ error: null });

    if (!this.state.scanResult) {
      this.setState({ error: "No folder scanned yet" });
      return false;
    }

    try {
      const plan = isoBundler.planBundles(
        this.state.scanResult.files,
        bytes,
        label,
        this.state.folderPath
      );

      // Save this size for future use
      await configStore.addSize(bytes, label);

      this.setState({
        diskSizeBytes: bytes,
        diskSizeLabel: label,
        bundlePlan: plan,
        step: "summary",
      });

      return true;
    } catch (error) {
      this.setState({
        error: error instanceof Error ? error.message : "Failed to plan bundles",
      });
      return false;
    }
  }

  /**
   * Go back to disk size selection
   */
  goBack(): void {
    if (this.state.step === "summary") {
      this.setState({ step: "diskSize", error: null });
    } else if (this.state.step === "diskSize") {
      this.setState({ step: "folder", error: null });
    }
  }

  /**
   * Start ISO generation
   */
  async startGeneration(): Promise<boolean> {
    if (!this.state.bundlePlan) {
      this.setState({ error: "No bundle plan available" });
      return false;
    }

    this.setState({ step: "progress", error: null });

    try {
      await isoBundler.generateIsos(
        this.state.bundlePlan,
        this.state.outputDir,
        (progress: GenerationProgress) => {
          this.setState({ generationProgress: progress });
        }
      );

      this.setState({ step: "complete" });
      return true;
    } catch (error) {
      this.setState({
        error: error instanceof Error ? error.message : "Failed to generate ISOs",
        step: "summary",
      });
      return false;
    }
  }

  /**
   * Reset to start over
   */
  reset(): void {
    this.setState({
      step: "folder",
      folderPath: "",
      scanResult: null,
      diskSizeBytes: 0,
      diskSizeLabel: "",
      bundlePlan: null,
      generationProgress: null,
      error: null,
      outputDir: "",
    });
  }

  /**
   * Set step directly (for navigation)
   */
  setStep(step: Step): void {
    this.setState({ step, error: null });
  }
}

// Singleton instance
export const mainController = new MainController();
