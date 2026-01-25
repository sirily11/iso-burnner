import { join, dirname } from "path";
import { homedir } from "os";
import type { UserConfig, SavedSize } from "./types";

const DEFAULT_CONFIG_DIR = join(homedir(), ".config", "iso-bundler");
const DEFAULT_CONFIG_FILE = join(DEFAULT_CONFIG_DIR, "config.json");
const MAX_SAVED_SIZES = 5;

export class ConfigStore {
  private config: UserConfig = { savedSizes: [] };
  private configFile: string;
  private configDir: string;

  constructor(configFile?: string) {
    this.configFile = configFile ?? DEFAULT_CONFIG_FILE;
    this.configDir = dirname(this.configFile);
  }

  async load(): Promise<void> {
    try {
      const file = Bun.file(this.configFile);
      if (await file.exists()) {
        const content = await file.text();
        this.config = JSON.parse(content) as UserConfig;
      }
    } catch {
      // If file doesn't exist or is invalid, use defaults
      this.config = { savedSizes: [] };
    }
  }

  async save(): Promise<void> {
    try {
      // Ensure directory exists
      await Bun.$`mkdir -p ${this.configDir}`.quiet();
      await Bun.write(this.configFile, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error("Failed to save config:", error);
    }
  }

  getSavedSizes(): SavedSize[] {
    // Return sorted by lastUsed (most recent first)
    return [...this.config.savedSizes].sort(
      (a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime()
    );
  }

  async addSize(bytes: number, label: string): Promise<void> {
    const now = new Date().toISOString();

    // Check if this size already exists (by bytes)
    const existingIndex = this.config.savedSizes.findIndex(
      (s) => s.bytes === bytes
    );

    if (existingIndex !== -1) {
      // Update existing entry
      const existing = this.config.savedSizes[existingIndex];
      if (existing) {
        existing.lastUsed = now;
        existing.label = label;
      }
    } else {
      // Add new entry
      this.config.savedSizes.push({ bytes, label, lastUsed: now });
    }

    // Keep only the most recent MAX_SAVED_SIZES entries
    this.config.savedSizes = this.config.savedSizes
      .sort(
        (a, b) =>
          new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime()
      )
      .slice(0, MAX_SAVED_SIZES);

    await this.save();
  }

  async removeSize(bytes: number): Promise<void> {
    this.config.savedSizes = this.config.savedSizes.filter(
      (s) => s.bytes !== bytes
    );
    await this.save();
  }
}

// Singleton instance
export const configStore = new ConfigStore();
