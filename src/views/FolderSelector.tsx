import React, { useState, useRef } from "react";
import { Box, Text } from "ink";
import { TextInput } from "@inkjs/ui";

interface FolderSelectorProps {
  onSelect: (path: string) => Promise<boolean>;
  error: string | null;
}

export function FolderSelector({ onSelect, error }: FolderSelectorProps): React.ReactElement {
  const [isLoading, setIsLoading] = useState(false);
  const pathRef = useRef("");

  const handleChange = (value: string) => {
    pathRef.current = value;
  };

  const handleSubmit = async (value: string) => {
    if (isLoading) return;
    setIsLoading(true);
    await onSelect(value);
    setIsLoading(false);
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          ISO Bundler - Step 1/4
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text>Select folder to burn:</Text>
      </Box>

      <Box marginBottom={1}>
        <Text>Path: </Text>
        <TextInput
          onChange={handleChange}
          onSubmit={handleSubmit}
          placeholder="/path/to/folder"
        />
      </Box>

      {error && (
        <Box marginBottom={1}>
          <Text color="red">{error}</Text>
        </Box>
      )}

      {isLoading ? (
        <Box>
          <Text color="yellow">Scanning folder...</Text>
        </Box>
      ) : (
        <Box>
          <Text dimColor>Press Enter to continue</Text>
        </Box>
      )}
    </Box>
  );
}
