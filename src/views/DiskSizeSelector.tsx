import React, { useState, useRef } from "react";
import { Box, Text, useInput } from "ink";
import { TextInput } from "@inkjs/ui";
import type { ScanResult, SavedSize } from "../models/types";
import { formatBytes, formatFileCount } from "../utils/formatters";

interface DiskSizeSelectorProps {
  scanResult: ScanResult;
  savedSizes: SavedSize[];
  onSelect: (sizeInput: string) => Promise<boolean>;
  onSelectSaved: (bytes: number, label: string) => Promise<boolean>;
  onBack: () => void;
  error: string | null;
}

export function DiskSizeSelector({
  scanResult,
  savedSizes,
  onSelect,
  onSelectSaved,
  onBack,
  error,
}: DiskSizeSelectorProps): React.ReactElement {
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef("");

  useInput((_input, key) => {
    if (isLoading) return;

    if (key.upArrow && savedSizes.length > 0) {
      setSelectedIndex((prev) => {
        if (prev <= 0) return savedSizes.length - 1;
        return prev - 1;
      });
    }

    if (key.downArrow && savedSizes.length > 0) {
      setSelectedIndex((prev) => {
        if (prev >= savedSizes.length - 1) return 0;
        return prev + 1;
      });
    }

    if (key.escape) {
      onBack();
    }
  });

  const handleSubmit = async (value: string) => {
    if (isLoading) return;
    setIsLoading(true);

    // If a saved size is selected, use that
    if (selectedIndex >= 0 && selectedIndex < savedSizes.length) {
      const saved = savedSizes[selectedIndex];
      if (saved) {
        await onSelectSaved(saved.bytes, saved.label);
      }
    } else {
      // Otherwise use the typed input
      await onSelect(value);
    }

    setIsLoading(false);
  };

  const handleChange = (value: string) => {
    inputRef.current = value;
    setSelectedIndex(-1); // Deselect saved size when typing
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          ISO Bundler - Step 2/4
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text>
          Found {formatFileCount(scanResult.fileCount)} ({formatBytes(scanResult.totalSize)})
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text>Enter disk size (e.g., 25GB, 4.7GB, 700MB):</Text>
      </Box>

      <Box marginBottom={1}>
        <Text>Size: </Text>
        <TextInput
          onChange={handleChange}
          onSubmit={handleSubmit}
          placeholder="e.g., 25GB"
        />
      </Box>

      {savedSizes.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text dimColor>Saved sizes (use arrow keys to select):</Text>
          {savedSizes.map((size, index) => (
            <Box key={size.bytes}>
              <Text color={selectedIndex === index ? "green" : undefined}>
                {selectedIndex === index ? "> " : "  "}
                {size.label}
                {index === 0 ? " (last used)" : ""}
              </Text>
            </Box>
          ))}
        </Box>
      )}

      {error && (
        <Box marginBottom={1}>
          <Text color="red">{error}</Text>
        </Box>
      )}

      {isLoading ? (
        <Box>
          <Text color="yellow">Planning bundles...</Text>
        </Box>
      ) : (
        <Box>
          <Text dimColor>
            Type custom size or use arrow keys to select, Enter to confirm, Esc to go back
          </Text>
        </Box>
      )}
    </Box>
  );
}
