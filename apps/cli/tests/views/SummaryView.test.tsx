import { test, expect, describe } from "bun:test";
import React from "react";
import { render } from "ink-testing-library";
import { SummaryView } from "../../src/views/SummaryView";
import type { ScanResult, BundlePlan } from "@iso-bundler/core";

describe("SummaryView", () => {
  const mockScanResult: ScanResult = {
    files: [
      { path: "/test/file1.txt", name: "file1.txt", size: 1024 * 1024 * 100 },
      { path: "/test/file2.txt", name: "file2.txt", size: 1024 * 1024 * 200 },
    ],
    totalSize: 1024 * 1024 * 300,
    fileCount: 2,
  };

  const mockBundlePlan: BundlePlan = {
    bundles: [
      {
        files: mockScanResult.files,
        totalSize: 1024 * 1024 * 300,
        name: "test.iso",
      },
    ],
    sourcePath: "/test",
    diskSizeBytes: 1024 * 1024 * 1024,
    diskSizeLabel: "1 GB",
  };

  const noop = () => {};

  test("renders step indicator", () => {
    const { lastFrame } = render(
      <SummaryView
        scanResult={mockScanResult}
        bundlePlan={mockBundlePlan}
        onConfirm={noop}
        onBack={noop}
        error={null}
      />
    );

    expect(lastFrame()).toContain("Step 3/4");
  });

  test("renders summary header", () => {
    const { lastFrame } = render(
      <SummaryView
        scanResult={mockScanResult}
        bundlePlan={mockBundlePlan}
        onConfirm={noop}
        onBack={noop}
        error={null}
      />
    );

    expect(lastFrame()).toContain("Summary");
  });

  test("renders source path", () => {
    const { lastFrame } = render(
      <SummaryView
        scanResult={mockScanResult}
        bundlePlan={mockBundlePlan}
        onConfirm={noop}
        onBack={noop}
        error={null}
      />
    );

    expect(lastFrame()).toContain("/test");
  });

  test("renders file count", () => {
    const { lastFrame } = render(
      <SummaryView
        scanResult={mockScanResult}
        bundlePlan={mockBundlePlan}
        onConfirm={noop}
        onBack={noop}
        error={null}
      />
    );

    expect(lastFrame()).toContain("2 files");
  });

  test("renders disk size", () => {
    const { lastFrame } = render(
      <SummaryView
        scanResult={mockScanResult}
        bundlePlan={mockBundlePlan}
        onConfirm={noop}
        onBack={noop}
        error={null}
      />
    );

    expect(lastFrame()).toContain("1 GB");
  });

  test("renders ISO names", () => {
    const { lastFrame } = render(
      <SummaryView
        scanResult={mockScanResult}
        bundlePlan={mockBundlePlan}
        onConfirm={noop}
        onBack={noop}
        error={null}
      />
    );

    expect(lastFrame()).toContain("test.iso");
  });

  test("renders multiple ISOs", () => {
    const multiIsoPlan: BundlePlan = {
      ...mockBundlePlan,
      bundles: [
        { files: [], totalSize: 100, name: "test-1.iso" },
        { files: [], totalSize: 100, name: "test-2.iso" },
      ],
    };

    const { lastFrame } = render(
      <SummaryView
        scanResult={mockScanResult}
        bundlePlan={multiIsoPlan}
        onConfirm={noop}
        onBack={noop}
        error={null}
      />
    );

    expect(lastFrame()).toContain("test-1.iso");
    expect(lastFrame()).toContain("test-2.iso");
    expect(lastFrame()).toContain("2");
  });

  test("renders error when present", () => {
    const { lastFrame } = render(
      <SummaryView
        scanResult={mockScanResult}
        bundlePlan={mockBundlePlan}
        onConfirm={noop}
        onBack={noop}
        error="Something went wrong"
      />
    );

    expect(lastFrame()).toContain("Something went wrong");
  });

  test("renders instructions", () => {
    const { lastFrame } = render(
      <SummaryView
        scanResult={mockScanResult}
        bundlePlan={mockBundlePlan}
        onConfirm={noop}
        onBack={noop}
        error={null}
      />
    );

    expect(lastFrame()).toContain("Y");
    expect(lastFrame()).toContain("N");
  });
});
