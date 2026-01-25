import { test, expect, describe } from "bun:test";
import React from "react";
import { render } from "ink-testing-library";
import { ProgressView } from "../../src/views/ProgressView";
import type { BundlePlan, GenerationProgress } from "../../src/models/types";

describe("ProgressView", () => {
  const mockBundlePlan: BundlePlan = {
    bundles: [
      { files: [], totalSize: 100, name: "test-1.iso" },
      { files: [], totalSize: 100, name: "test-2.iso" },
    ],
    sourcePath: "/test",
    diskSizeBytes: 500,
    diskSizeLabel: "500 B",
  };

  test("renders step indicator", () => {
    const { lastFrame } = render(
      <ProgressView bundlePlan={mockBundlePlan} progress={null} error={null} />
    );

    expect(lastFrame()).toContain("Step 4/4");
  });

  test("renders generating message", () => {
    const { lastFrame } = render(
      <ProgressView bundlePlan={mockBundlePlan} progress={null} error={null} />
    );

    expect(lastFrame()).toContain("Generating ISO files");
  });

  test("renders starting message when no progress", () => {
    const { lastFrame } = render(
      <ProgressView bundlePlan={mockBundlePlan} progress={null} error={null} />
    );

    expect(lastFrame()).toContain("Starting");
  });

  test("renders current bundle info when progress available", () => {
    const progress: GenerationProgress = {
      currentBundle: 1,
      totalBundles: 2,
      currentBundleName: "test-1.iso",
      progress: 50,
      completedBundles: [],
    };

    const { lastFrame } = render(
      <ProgressView bundlePlan={mockBundlePlan} progress={progress} error={null} />
    );

    expect(lastFrame()).toContain("Bundle 1 of 2");
    expect(lastFrame()).toContain("test-1.iso");
    expect(lastFrame()).toContain("50%");
  });

  test("renders progress bar", () => {
    const progress: GenerationProgress = {
      currentBundle: 1,
      totalBundles: 2,
      currentBundleName: "test-1.iso",
      progress: 50,
      completedBundles: [],
    };

    const { lastFrame } = render(
      <ProgressView bundlePlan={mockBundlePlan} progress={progress} error={null} />
    );

    // Should contain progress bar characters
    expect(lastFrame()).toContain("█");
    expect(lastFrame()).toContain("░");
  });

  test("renders completed bundles with checkmark", () => {
    const progress: GenerationProgress = {
      currentBundle: 2,
      totalBundles: 2,
      currentBundleName: "test-2.iso",
      progress: 25,
      completedBundles: ["test-1.iso"],
    };

    const { lastFrame } = render(
      <ProgressView bundlePlan={mockBundlePlan} progress={progress} error={null} />
    );

    expect(lastFrame()).toContain("[x]");
    expect(lastFrame()).toContain("[>]");
  });

  test("renders error when present", () => {
    const { lastFrame } = render(
      <ProgressView bundlePlan={mockBundlePlan} progress={null} error="ISO creation failed" />
    );

    expect(lastFrame()).toContain("ISO creation failed");
  });
});
