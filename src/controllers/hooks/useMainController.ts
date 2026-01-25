import { useState, useEffect, useCallback } from "react";
import type { AppState, SavedSize } from "../../models/types";
import { mainController } from "../MainController";

export interface UseMainControllerReturn {
  state: AppState;
  savedSizes: SavedSize[];
  setFolderPath: (path: string) => Promise<boolean>;
  setDiskSize: (sizeInput: string) => Promise<boolean>;
  setDiskSizeBytes: (bytes: number, label: string) => Promise<boolean>;
  goBack: () => void;
  startGeneration: () => Promise<boolean>;
  reset: () => void;
}

export function useMainController(): UseMainControllerReturn {
  const [state, setState] = useState<AppState>(mainController.getState());
  const [savedSizes, setSavedSizes] = useState<SavedSize[]>([]);

  useEffect(() => {
    // Initialize controller
    mainController.init().then(() => {
      setState(mainController.getState());
      setSavedSizes(mainController.getSavedSizes());
    });

    // Subscribe to state changes
    const unsubscribe = mainController.subscribe((newState) => {
      setState(newState);
      setSavedSizes(mainController.getSavedSizes());
    });

    return unsubscribe;
  }, []);

  const setFolderPath = useCallback(async (path: string): Promise<boolean> => {
    const result = await mainController.setFolderPath(path);
    setSavedSizes(mainController.getSavedSizes());
    return result;
  }, []);

  const setDiskSize = useCallback(async (sizeInput: string): Promise<boolean> => {
    const result = await mainController.setDiskSize(sizeInput);
    setSavedSizes(mainController.getSavedSizes());
    return result;
  }, []);

  const setDiskSizeBytes = useCallback(async (bytes: number, label: string): Promise<boolean> => {
    const result = await mainController.setDiskSizeBytes(bytes, label);
    setSavedSizes(mainController.getSavedSizes());
    return result;
  }, []);

  const goBack = useCallback(() => {
    mainController.goBack();
  }, []);

  const startGeneration = useCallback(async (): Promise<boolean> => {
    return mainController.startGeneration();
  }, []);

  const reset = useCallback(() => {
    mainController.reset();
  }, []);

  return {
    state,
    savedSizes,
    setFolderPath,
    setDiskSize,
    setDiskSizeBytes,
    goBack,
    startGeneration,
    reset,
  };
}
