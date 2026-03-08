import { test, expect, beforeEach, afterAll, describe } from "bun:test";
import { ConfigStore } from "../../src/models/ConfigStore";
import { rm } from "fs/promises";
import { join } from "path";

// Use a test-specific config directory
const TEST_CONFIG_DIR = join(import.meta.dir, ".test-config");
const TEST_CONFIG_FILE = join(TEST_CONFIG_DIR, "config.json");

describe("ConfigStore", () => {
  let store: ConfigStore;

  beforeEach(async () => {
    // Clear any existing test config first
    try {
      await rm(TEST_CONFIG_DIR, { recursive: true, force: true });
    } catch {
      // Ignore if doesn't exist
    }

    // Create a fresh store for each test with a test-specific config file
    store = new ConfigStore(TEST_CONFIG_FILE);
  });

  afterAll(async () => {
    // Clean up test config directory
    try {
      await rm(TEST_CONFIG_DIR, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  test("getSavedSizes returns empty array initially", async () => {
    await store.load();
    const sizes = store.getSavedSizes();
    expect(sizes).toEqual([]);
  });

  test("addSize adds a new size", async () => {
    await store.load();
    await store.addSize(25 * 1024 * 1024 * 1024, "25 GB");

    const sizes = store.getSavedSizes();
    expect(sizes.length).toBe(1);
    expect(sizes[0]!.bytes).toBe(25 * 1024 * 1024 * 1024);
    expect(sizes[0]!.label).toBe("25 GB");
  });

  test("addSize updates existing size", async () => {
    await store.load();
    await store.addSize(25 * 1024 * 1024 * 1024, "25 GB");

    // Wait a bit to ensure different timestamp
    await new Promise((resolve) => setTimeout(resolve, 10));

    await store.addSize(25 * 1024 * 1024 * 1024, "25GB");

    const sizes = store.getSavedSizes();
    expect(sizes.length).toBe(1);
    expect(sizes[0]!.label).toBe("25GB"); // Updated label
  });

  test("getSavedSizes returns sorted by lastUsed", async () => {
    await store.load();

    await store.addSize(1000, "Size 1");
    await new Promise((resolve) => setTimeout(resolve, 10));
    await store.addSize(2000, "Size 2");
    await new Promise((resolve) => setTimeout(resolve, 10));
    await store.addSize(3000, "Size 3");

    const sizes = store.getSavedSizes();

    // Most recently used first
    expect(sizes[0]!.bytes).toBe(3000);
    expect(sizes[1]!.bytes).toBe(2000);
    expect(sizes[2]!.bytes).toBe(1000);
  });

  test("addSize limits to 5 entries", async () => {
    await store.load();

    for (let i = 1; i <= 7; i++) {
      await store.addSize(i * 1000, `Size ${i}`);
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    const sizes = store.getSavedSizes();
    expect(sizes.length).toBe(5);

    // Should have the 5 most recent (3, 4, 5, 6, 7)
    const bytes = sizes.map((s) => s.bytes);
    expect(bytes).not.toContain(1000);
    expect(bytes).not.toContain(2000);
    expect(bytes).toContain(7000);
  });

  test("removeSize removes a size", async () => {
    await store.load();

    await store.addSize(1000, "Size 1");
    await store.addSize(2000, "Size 2");

    await store.removeSize(1000);

    const sizes = store.getSavedSizes();
    expect(sizes.length).toBe(1);
    expect(sizes[0]!.bytes).toBe(2000);
  });
});
