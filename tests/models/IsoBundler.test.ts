import { test, expect, describe } from "bun:test";
import { IsoBundler } from "../../src/models/IsoBundler";
import type { FileInfo } from "../../src/models/types";

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
});
