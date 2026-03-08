import { test, expect, describe } from "bun:test";
import { IsoBundler } from "../../src/models/IsoBundler";
import type { FileInfo } from "../../src/models/types";
import { platform } from "os";
import { mkdir, writeFile, rm, stat } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

const bundler = new IsoBundler();

describe("IsoBundler", () => {
  describe("planBundles", () => {
    test("creates single bundle when files fit", () => {
      const files: FileInfo[] = [
        { path: "/test/file1.txt", name: "file1.txt", size: 100 },
        { path: "/test/file2.txt", name: "file2.txt", size: 200 },
      ];

      const plan = bundler.planBundles(files, 500, "500 B", "/test");

      expect(plan.bundles.length).toBe(1);
      expect(plan.bundles[0]!.name).toBe("test.iso");
      expect(plan.bundles[0]!.totalSize).toBe(300);
      expect(plan.bundles[0]!.files.length).toBe(2);
    });

    test("creates multiple bundles when exceeding disk size", () => {
      const files: FileInfo[] = [
        { path: "/test/file1.txt", name: "file1.txt", size: 300 },
        { path: "/test/file2.txt", name: "file2.txt", size: 300 },
        { path: "/test/file3.txt", name: "file3.txt", size: 200 },
      ];

      const plan = bundler.planBundles(files, 500, "500 B", "/test");

      // 300 + 200 = 500 fits in first bundle, 300 goes to second
      expect(plan.bundles.length).toBe(2);
      expect(plan.bundles[0]!.name).toBe("test-1.iso");
      expect(plan.bundles[1]!.name).toBe("test-2.iso");
    });

    test("uses First-Fit Decreasing algorithm", () => {
      // With FFD, larger files are placed first
      const files: FileInfo[] = [
        { path: "/test/small.txt", name: "small.txt", size: 10 },
        { path: "/test/large.txt", name: "large.txt", size: 90 },
        { path: "/test/medium.txt", name: "medium.txt", size: 50 },
      ];

      const plan = bundler.planBundles(files, 100, "100 B", "/test");

      // FFD should put large (90) first, then try to fit medium (50) - doesn't fit
      // Then fit small (10) with large
      // Medium goes to second bundle
      expect(plan.bundles.length).toBe(2);

      // First bundle: large (90) + small (10) = 100
      const firstBundle = plan.bundles[0]!;
      expect(firstBundle.totalSize).toBe(100);

      // Second bundle: medium (50)
      const secondBundle = plan.bundles[1]!;
      expect(secondBundle.totalSize).toBe(50);
    });

    test("throws error for oversized files", () => {
      const files: FileInfo[] = [
        { path: "/test/huge.txt", name: "huge.txt", size: 1000 },
      ];

      expect(() => {
        bundler.planBundles(files, 500, "500 B", "/test");
      }).toThrow(/larger than the disk size/);
    });

    test("handles empty file list", () => {
      const files: FileInfo[] = [];
      const plan = bundler.planBundles(files, 500, "500 B", "/test");

      expect(plan.bundles.length).toBe(0);
    });

    test("preserves source path and disk info in plan", () => {
      const files: FileInfo[] = [
        { path: "/test/file.txt", name: "file.txt", size: 100 },
      ];

      const plan = bundler.planBundles(files, 25 * 1024 * 1024 * 1024, "25 GB", "/Movies");

      expect(plan.sourcePath).toBe("/Movies");
      expect(plan.diskSizeBytes).toBe(25 * 1024 * 1024 * 1024);
      expect(plan.diskSizeLabel).toBe("25 GB");
    });

    test("names single ISO without suffix", () => {
      const files: FileInfo[] = [
        { path: "/Movies/video.mp4", name: "video.mp4", size: 100 },
      ];

      const plan = bundler.planBundles(files, 500, "500 B", "/Movies");

      expect(plan.bundles[0]!.name).toBe("Movies.iso");
    });

    test("names multiple ISOs with suffix", () => {
      const files: FileInfo[] = [
        { path: "/Movies/a.mp4", name: "a.mp4", size: 300 },
        { path: "/Movies/b.mp4", name: "b.mp4", size: 300 },
      ];

      const plan = bundler.planBundles(files, 400, "400 B", "/Movies");

      expect(plan.bundles[0]!.name).toBe("Movies-1.iso");
      expect(plan.bundles[1]!.name).toBe("Movies-2.iso");
    });
  });

  describe("checkTools", () => {
    test("returns tool availability info", async () => {
      const result = await bundler.checkTools();

      expect(result).toHaveProperty("available");
      expect(result).toHaveProperty("tool");
      expect(result).toHaveProperty("message");
      expect(typeof result.available).toBe("boolean");
    });
  });

  describe("Windows ISO Generation", () => {
    const isWindows = platform() === "win32";

    test.skipIf(!isWindows)("creates non-empty ISO from real files", async () => {
      // Create temp directories
      const testDir = join(tmpdir(), `iso-test-${Date.now()}`);
      const outputDir = join(tmpdir(), `iso-output-${Date.now()}`);

      try {
        // Setup: Create test files with real content
        await mkdir(testDir, { recursive: true });
        await mkdir(join(testDir, "subfolder"), { recursive: true });
        await mkdir(outputDir, { recursive: true });

        // Create test files
        const file1Path = join(testDir, "test1.txt");
        const file2Path = join(testDir, "subfolder", "test2.txt");

        await writeFile(file1Path, "Hello World - Test File 1\n".repeat(100), "utf-8");
        await writeFile(file2Path, "Hello World - Test File 2\n".repeat(100), "utf-8");

        // Get file stats for sizes
        const stat1 = await stat(file1Path);
        const stat2 = await stat(file2Path);

        // Create file info objects
        const files: FileInfo[] = [
          { path: file1Path, name: "test1.txt", size: stat1.size },
          { path: file2Path, name: "test2.txt", size: stat2.size },
        ];

        // Plan bundles
        const plan = bundler.planBundles(files, 10 * 1024 * 1024, "10 MB", testDir);

        expect(plan.bundles.length).toBe(1);

        // Generate ISO
        let progressCalled = false;
        const createdIsos = await bundler.generateIsos(plan, outputDir, (progress) => {
          progressCalled = true;
          expect(progress.currentBundle).toBeGreaterThanOrEqual(1);
          expect(progress.totalBundles).toBe(1);
          expect(progress.progress).toBeGreaterThanOrEqual(0);
          expect(progress.progress).toBeLessThanOrEqual(100);
        });

        // Verify ISO was created
        expect(createdIsos.length).toBe(1);
        expect(progressCalled).toBe(true);

        const isoPath = createdIsos[0];
        expect(isoPath).toBeDefined();

        // Verify ISO file exists and is not empty
        const isoStat = await stat(isoPath!);
        expect(isoStat.size).toBeGreaterThan(0);

        console.log(`✓ ISO created successfully: ${isoPath}`);
        console.log(`✓ ISO size: ${(isoStat.size / 1024).toFixed(2)} KB`);

      } finally {
        // Cleanup
        await rm(testDir, { recursive: true, force: true });
        await rm(outputDir, { recursive: true, force: true });
      }
    }, 30000); // 30 second timeout for ISO generation

    test.skipIf(!isWindows)("creates ISO with nested directory structure", async () => {
      // Create temp directories
      const testDir = join(tmpdir(), `iso-test-nested-${Date.now()}`);
      const outputDir = join(tmpdir(), `iso-output-nested-${Date.now()}`);

      try {
        // Setup: Create nested directory structure
        await mkdir(testDir, { recursive: true });
        await mkdir(join(testDir, "level1"), { recursive: true });
        await mkdir(join(testDir, "level1", "level2"), { recursive: true });
        await mkdir(join(testDir, "level1", "level2", "level3"), { recursive: true });
        await mkdir(outputDir, { recursive: true });

        // Create test files in different levels
        const file1Path = join(testDir, "root.txt");
        const file2Path = join(testDir, "level1", "file1.txt");
        const file3Path = join(testDir, "level1", "level2", "file2.txt");
        const file4Path = join(testDir, "level1", "level2", "level3", "deep.txt");

        await writeFile(file1Path, "Root file content", "utf-8");
        await writeFile(file2Path, "Level 1 file content", "utf-8");
        await writeFile(file3Path, "Level 2 file content", "utf-8");
        await writeFile(file4Path, "Level 3 deep file content", "utf-8");

        // Get file stats
        const files: FileInfo[] = await Promise.all([
          stat(file1Path).then(s => ({ path: file1Path, name: "root.txt", size: s.size })),
          stat(file2Path).then(s => ({ path: file2Path, name: "file1.txt", size: s.size })),
          stat(file3Path).then(s => ({ path: file3Path, name: "file2.txt", size: s.size })),
          stat(file4Path).then(s => ({ path: file4Path, name: "deep.txt", size: s.size })),
        ]);

        // Plan and generate ISO
        const plan = bundler.planBundles(files, 10 * 1024 * 1024, "10 MB", testDir);
        const createdIsos = await bundler.generateIsos(plan, outputDir, () => {});

        // Verify
        expect(createdIsos.length).toBe(1);
        const isoStat = await stat(createdIsos[0]!);
        expect(isoStat.size).toBeGreaterThan(0);

        console.log(`✓ ISO with nested structure created: ${createdIsos[0]}`);
        console.log(`✓ ISO size: ${(isoStat.size / 1024).toFixed(2)} KB`);

      } finally {
        // Cleanup
        await rm(testDir, { recursive: true, force: true });
        await rm(outputDir, { recursive: true, force: true });
      }
    }, 30000);

    test.skipIf(!isWindows)("creates ISO with large file (simulating video)", async () => {
      // Create temp directories
      const testDir = join(tmpdir(), `iso-test-large-${Date.now()}`);
      const outputDir = join(tmpdir(), `iso-output-large-${Date.now()}`);

      try {
        await mkdir(testDir, { recursive: true });
        await mkdir(outputDir, { recursive: true });

        // Create a larger file to simulate video (10MB)
        const largeFilePath = join(testDir, "test-video.mp4");
        const size = 10 * 1024 * 1024; // 10MB
        const buffer = Buffer.alloc(size, 'A');
        await writeFile(largeFilePath, buffer);

        const fileStat = await stat(largeFilePath);

        const files: FileInfo[] = [
          { path: largeFilePath, name: "test-video.mp4", size: fileStat.size },
        ];

        console.log(`Created test file: ${largeFilePath}`);
        console.log(`File size: ${(fileStat.size / 1024 / 1024).toFixed(2)} MB`);

        // Plan and generate ISO
        const plan = bundler.planBundles(files, 100 * 1024 * 1024, "100 MB", testDir);
        const createdIsos = await bundler.generateIsos(plan, outputDir, (progress) => {
          console.log(`Progress: ${progress.progress}% - ${progress.currentBundleName}`);
        });

        // Verify
        expect(createdIsos.length).toBe(1);
        const isoStat = await stat(createdIsos[0]!);
        expect(isoStat.size).toBeGreaterThan(0);

        console.log(`✓ ISO with large file created: ${createdIsos[0]}`);
        console.log(`✓ ISO size: ${(isoStat.size / 1024 / 1024).toFixed(2)} MB`);

      } finally {
        // Cleanup
        await rm(testDir, { recursive: true, force: true });
        await rm(outputDir, { recursive: true, force: true });
      }
    }, 60000); // 60 second timeout
  });
});
