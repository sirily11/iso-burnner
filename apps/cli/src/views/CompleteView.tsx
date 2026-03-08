import React from "react";
import { Box, Text, useApp, useInput } from "ink";
import type { BundlePlan } from "@iso-bundler/core";

interface CompleteViewProps {
  bundlePlan: BundlePlan;
  onRestart: () => void;
}

export function CompleteView({ bundlePlan, onRestart }: CompleteViewProps): React.ReactElement {
  const { exit } = useApp();

  useInput((input) => {
    if (input.toLowerCase() === "q") {
      exit();
    } else if (input.toLowerCase() === "r") {
      onRestart();
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="green">
          ISO Bundler - Complete!
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text bold color="green">
          ISO generation complete!
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text>
          Created {bundlePlan.bundles.length} ISO file{bundlePlan.bundles.length !== 1 ? "s" : ""}
        </Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        {bundlePlan.bundles.map((bundle) => (
          <Text key={bundle.name} color="cyan">
            - {bundle.name}
          </Text>
        ))}
      </Box>

      <Box>
        <Text dimColor>Press </Text>
        <Text color="yellow">q</Text>
        <Text dimColor> to exit or </Text>
        <Text color="cyan">r</Text>
        <Text dimColor> to start over</Text>
      </Box>
    </Box>
  );
}
