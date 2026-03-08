import { test, expect, beforeAll, afterAll, describe } from "bun:test";
import { FileScanner } from "../../src/models/FileScanner";
import { mkdir, writeFile, rm } from "fs/promises";
import { join } from "path";

const TEST_DIR = join(import.meta.dir, "test-folder");
const scanner = new FileScanner();

describe("FileScanner", () => {
  beforeAll(async () => {
    // Create test directory structure
    await mkdir(TEST_DIR, { recursive: true });
    await mkdir(join(TEST_DIR, "subdir"), { recursive: true });

    // Create test files
    await writeFile(join(TEST_DIR, "file1.txt"), "Hello World");
    await writeFile(join(TEST_DIR, "file2.txt"), "Test content here");
    await writeFile(join(TEST_DIR, "subdir", "file3.txt"), "Nested file");
    await writeFile(join(TEST_DIR, ".hidden"), "Hidden file");
  });

  afterAll(async () => {
    // Clean up test directory
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  test("scan returns correct file count", async () => {
    const result = await scanner.scan(TEST_DIR);
    // Should find 3 files (excluding hidden)
    expect(result.fileCount).toBe(3);
  });

  test("scan calculates total size correctly", async () => {
    const result = await scanner.scan(TEST_DIR);
    // "Hello World" (11) + "Test content here" (17) + "Nested file" (11) = 39
    expect(result.totalSize).toBe(39);
  });

  test("scan returns file info with paths", async () => {
    const result = await scanner.scan(TEST_DIR);
    const fileNames = result.files.map((f) => f.name);

    expect(fileNames).toContain("file1.txt");
    expect(fileNames).toContain("file2.txt");
    expect(fileNames).toContain("file3.txt");
  });

  test("scan excludes hidden files", async () => {
    const result = await scanner.scan(TEST_DIR);
    const fileNames = result.files.map((f) => f.name);

    expect(fileNames).not.toContain(".hidden");
  });

  test("validateDirectory returns true for valid directory", async () => {
    const isValid = await scanner.validateDirectory(TEST_DIR);
    expect(isValid).toBe(true);
  });

  test("validateDirectory returns false for non-existent path", async () => {
    const isValid = await scanner.validateDirectory("/non/existent/path");
    expect(isValid).toBe(false);
  });

  test("validateDirectory returns false for file path", async () => {
    const isValid = await scanner.validateDirectory(join(TEST_DIR, "file1.txt"));
    expect(isValid).toBe(false);
  });

  test("getFolderName returns correct folder name", () => {
    expect(scanner.getFolderName("/path/to/Movies")).toBe("Movies");
    expect(scanner.getFolderName("/Users/john/Documents")).toBe("Documents");
  });
});
