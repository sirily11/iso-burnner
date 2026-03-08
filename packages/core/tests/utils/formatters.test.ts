import { test, expect, describe } from "bun:test";
import { formatBytes, parseSize, formatFileCount, truncatePath } from "../../src/utils/formatters";

describe("formatters", () => {
  describe("formatBytes", () => {
    test("formats bytes", () => {
      expect(formatBytes(100)).toBe("100 B");
      expect(formatBytes(512)).toBe("512 B");
    });

    test("formats kilobytes", () => {
      expect(formatBytes(1024)).toBe("1.0 KB");
      expect(formatBytes(2048)).toBe("2.0 KB");
      expect(formatBytes(1536)).toBe("1.5 KB");
    });

    test("formats megabytes", () => {
      expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
      expect(formatBytes(1024 * 1024 * 1.5)).toBe("1.5 MB");
    });

    test("formats gigabytes", () => {
      expect(formatBytes(1024 * 1024 * 1024)).toBe("1.00 GB");
      expect(formatBytes(1024 * 1024 * 1024 * 25)).toBe("25.00 GB");
      expect(formatBytes(1024 * 1024 * 1024 * 4.7)).toBe("4.70 GB");
    });
  });

  describe("parseSize", () => {
    test("parses GB sizes", () => {
      const result = parseSize("25GB");
      expect(result).not.toBeNull();
      expect(result?.bytes).toBe(25 * 1024 * 1024 * 1024);
      expect(result?.label).toBe("25 GB");
    });

    test("parses GB with space", () => {
      const result = parseSize("4.7 GB");
      expect(result).not.toBeNull();
      expect(result?.bytes).toBe(Math.floor(4.7 * 1024 * 1024 * 1024));
    });

    test("parses MB sizes", () => {
      const result = parseSize("700MB");
      expect(result).not.toBeNull();
      expect(result?.bytes).toBe(700 * 1024 * 1024);
    });

    test("parses KB sizes", () => {
      const result = parseSize("500KB");
      expect(result).not.toBeNull();
      expect(result?.bytes).toBe(500 * 1024);
    });

    test("parses TB sizes", () => {
      const result = parseSize("1TB");
      expect(result).not.toBeNull();
      expect(result?.bytes).toBe(1 * 1024 * 1024 * 1024 * 1024);
    });

    test("parses case insensitive", () => {
      expect(parseSize("25gb")?.bytes).toBe(25 * 1024 * 1024 * 1024);
      expect(parseSize("25Gb")?.bytes).toBe(25 * 1024 * 1024 * 1024);
      expect(parseSize("700mb")?.bytes).toBe(700 * 1024 * 1024);
    });

    test("parses decimal values", () => {
      const result = parseSize("23.3GB");
      expect(result).not.toBeNull();
      expect(result?.bytes).toBe(Math.floor(23.3 * 1024 * 1024 * 1024));
      expect(result?.label).toBe("23.3 GB");
    });

    test("returns null for invalid format", () => {
      expect(parseSize("invalid")).toBeNull();
      expect(parseSize("abc GB")).toBeNull();
      expect(parseSize("")).toBeNull();
    });

    test("returns null for zero or negative", () => {
      expect(parseSize("0GB")).toBeNull();
      expect(parseSize("-5GB")).toBeNull();
    });
  });

  describe("formatFileCount", () => {
    test("formats singular", () => {
      expect(formatFileCount(1)).toBe("1 file");
    });

    test("formats plural", () => {
      expect(formatFileCount(0)).toBe("0 files");
      expect(formatFileCount(2)).toBe("2 files");
      expect(formatFileCount(100)).toBe("100 files");
    });
  });

  describe("truncatePath", () => {
    test("returns short paths unchanged", () => {
      expect(truncatePath("/short/path")).toBe("/short/path");
    });

    test("truncates long paths", () => {
      const longPath = "/very/long/path/that/exceeds/the/maximum/length/allowed";
      const result = truncatePath(longPath, 30);
      expect(result.length).toBeLessThanOrEqual(30);
      expect(result.startsWith("...")).toBe(true);
    });

    test("preserves path segments", () => {
      const path = "/Users/john/Documents/Movies/Videos";
      const result = truncatePath(path, 25);
      expect(result).toContain("Videos");
    });
  });
});
