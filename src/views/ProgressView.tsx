import React from "react";
import { Box, Text } from "ink";
import type { GenerationProgress, BundlePlan } from "../models/types";

interface ProgressViewProps {
  bundlePlan: BundlePlan;
  progress: GenerationProgress | null;
  error: string | null;
}

export function ProgressView({
  bundlePlan,
  progress,
  error,
}: ProgressViewProps): React.ReactElement {
  const currentProgress = progress?.progress ?? 0;
  const progressBarWidth = 30;
  const filledWidth = Math.round((currentProgress / 100) * progressBarWidth);
  const emptyWidth = progressBarWidth - filledWidth;

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          ISO Bundler - Step 4/4
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text bold>Generating ISO files...</Text>
      </Box>

      {progress && (
        <>
          <Box marginBottom={1}>
            <Text>
              Bundle {progress.currentBundle} of {progress.totalBundles}
            </Text>
          </Box>

          <Box marginBottom={1}>
            <Text>
              Current: <Text color="cyan">{progress.currentBundleName}</Text>
            </Text>
          </Box>

          <Box marginBottom={1}>
            <Text color="green">{"█".repeat(filledWidth)}</Text>
            <Text color="gray">{"░".repeat(emptyWidth)}</Text>
            <Text> {currentProgress}%</Text>
          </Box>

          <Box flexDirection="column" marginBottom={1}>
            {bundlePlan.bundles.map((bundle, index) => {
              const isCompleted = progress.completedBundles.includes(bundle.name);
              const isCurrent = bundle.name === progress.currentBundleName;

              let prefix = "[ ]";
              let color: string | undefined = undefined;

              if (isCompleted) {
                prefix = "[x]";
                color = "green";
              } else if (isCurrent) {
                prefix = "[>]";
                color = "yellow";
              }

              return (
                <Text key={bundle.name} color={color}>
                  {prefix} {bundle.name}
                </Text>
              );
            })}
          </Box>
        </>
      )}

      {!progress && !error && (
        <Box>
          <Text color="yellow">Starting...</Text>
        </Box>
      )}

      {error && (
        <Box>
          <Text color="red">{error}</Text>
        </Box>
      )}
    </Box>
  );
}
