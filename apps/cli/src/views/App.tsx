import React from "react";
import { Box, Text } from "ink";
import { useMainController } from "../controllers/hooks/useMainController";
import { FolderSelector } from "./FolderSelector.tsx";
import { DiskSizeSelector } from "./DiskSizeSelector.tsx";
import { SummaryView } from "./SummaryView.tsx";
import { ProgressView } from "./ProgressView.tsx";
import { CompleteView } from "./CompleteView.tsx";

export function App(): React.ReactElement {
  const {
    state,
    savedSizes,
    setFolderPath,
    setDiskSize,
    setDiskSizeBytes,
    goBack,
    startGeneration,
    reset,
  } = useMainController();

  // Show fatal error if ISO tools are not available
  if (state.step === "folder" && state.error && !state.folderPath) {
    // Check if it's a tool availability error
    const isToolError =
      state.error.includes("No ISO tool found") ||
      state.error.includes("not found") ||
      state.error.includes("Unsupported platform");

    if (isToolError) {
      return (
        <Box flexDirection="column" padding={1}>
          <Box marginBottom={1}>
            <Text bold color="red">
              ISO Bundler - Setup Error
            </Text>
          </Box>
          <Box>
            <Text color="red">{state.error}</Text>
          </Box>
        </Box>
      );
    }
  }

  switch (state.step) {
    case "folder":
      return <FolderSelector onSelect={setFolderPath} error={state.error} />;

    case "diskSize":
      if (!state.scanResult) {
        return (
          <Box padding={1}>
            <Text color="red">Error: No scan result available</Text>
          </Box>
        );
      }
      return (
        <DiskSizeSelector
          scanResult={state.scanResult}
          savedSizes={savedSizes}
          onSelect={setDiskSize}
          onSelectSaved={setDiskSizeBytes}
          onBack={goBack}
          error={state.error}
        />
      );

    case "summary":
      if (!state.scanResult || !state.bundlePlan) {
        return (
          <Box padding={1}>
            <Text color="red">Error: No bundle plan available</Text>
          </Box>
        );
      }
      return (
        <SummaryView
          scanResult={state.scanResult}
          bundlePlan={state.bundlePlan}
          onConfirm={startGeneration}
          onBack={goBack}
          error={state.error}
        />
      );

    case "progress":
      if (!state.bundlePlan) {
        return (
          <Box padding={1}>
            <Text color="red">Error: No bundle plan available</Text>
          </Box>
        );
      }
      return (
        <ProgressView
          bundlePlan={state.bundlePlan}
          progress={state.generationProgress}
          error={state.error}
        />
      );

    case "complete":
      if (!state.bundlePlan) {
        return (
          <Box padding={1}>
            <Text color="red">Error: No bundle plan available</Text>
          </Box>
        );
      }
      return <CompleteView bundlePlan={state.bundlePlan} onRestart={reset} />;

    default:
      return (
        <Box padding={1}>
          <Text color="red">Unknown step</Text>
        </Box>
      );
  }
}
