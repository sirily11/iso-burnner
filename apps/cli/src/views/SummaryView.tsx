import React from "react";
import { Box, Text, useInput } from "ink";
import type { ScanResult, BundlePlan } from "@iso-bundler/core";
import { formatBytes, formatFileCount, truncatePath } from "@iso-bundler/core";

interface SummaryViewProps {
  scanResult: ScanResult;
  bundlePlan: BundlePlan;
  onConfirm: () => void;
  onBack: () => void;
  error: string | null;
}

export function SummaryView({
  scanResult,
  bundlePlan,
  onConfirm,
  onBack,
  error,
}: SummaryViewProps): React.ReactElement {
  useInput((input, key) => {
    if (input.toLowerCase() === "y") {
      onConfirm();
    } else if (input.toLowerCase() === "n" || key.escape) {
      onBack();
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          ISO Bundler - Step 3/4
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text bold>Summary</Text>
      </Box>

      <Box marginBottom={1}>
        <Text dimColor>───────</Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text>
          Source: <Text color="blue">{truncatePath(bundlePlan.sourcePath, 50)}</Text>
        </Text>
        <Text>Total files: {formatFileCount(scanResult.fileCount)}</Text>
        <Text>Total size: {formatBytes(scanResult.totalSize)}</Text>
      </Box>

      <Box marginBottom={1}>
        <Text>
          Disk size: <Text color="yellow">{bundlePlan.diskSizeLabel}</Text>
        </Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text>
          ISOs to be created: <Text bold color="green">{bundlePlan.bundles.length}</Text>
        </Text>
        {bundlePlan.bundles.map((bundle) => (
          <Text key={bundle.name}>
            {"  "}
            <Text color="cyan">{bundle.name}</Text>
            {": "}
            {formatFileCount(bundle.files.length)} ({formatBytes(bundle.totalSize)})
          </Text>
        ))}
      </Box>

      {error && (
        <Box marginBottom={1}>
          <Text color="red">{error}</Text>
        </Box>
      )}

      <Box>
        <Text dimColor>Press </Text>
        <Text color="green">Y</Text>
        <Text dimColor> to generate ISOs or </Text>
        <Text color="red">N</Text>
        <Text dimColor> to go back</Text>
      </Box>
    </Box>
  );
}
