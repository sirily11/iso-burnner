import { test, expect, beforeAll, afterAll, beforeEach, describe } from "bun:test";
import { MainController } from "../../src/controllers/MainController";
import { mkdir, writeFile, rm } from "fs/promises";
import { join } from "path";

const TEST_DIR = join(import.meta.dir, "test-folder");

describe("MainController", () => {
  let controller: MainController;

  beforeAll(async () => {
    // Create test directory structure
    await mkdir(TEST_DIR, { recursive: true });
    await writeFile(join(TEST_DIR, "file1.txt"), "Hello World");
    await writeFile(join(TEST_DIR, "file2.txt"), "Test content here");
  });

  afterAll(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  beforeEach(async () => {
    controller = new MainController();
    await controller.init();
  });

  test("initial state has folder step", () => {
    const state = controller.getState();
    expect(state.step).toBe("folder");
    expect(state.folderPath).toBe("");
    expect(state.scanResult).toBeNull();
  });

  test("setFolderPath fails with invalid path", async () => {
    const result = await controller.setFolderPath("/non/existent/path");

    expect(result).toBe(false);
    expect(controller.getState().error).toBe("Invalid directory path");
  });

  test("setFolderPath fails with empty path", async () => {
    const result = await controller.setFolderPath("");

    expect(result).toBe(false);
    expect(controller.getState().error).toBe("Please enter a folder path");
  });

  test("setFolderPath succeeds with valid path", async () => {
    const result = await controller.setFolderPath(TEST_DIR);

    expect(result).toBe(true);
    expect(controller.getState().step).toBe("diskSize");
    expect(controller.getState().folderPath).toBe(TEST_DIR);
    expect(controller.getState().scanResult).not.toBeNull();
    expect(controller.getState().scanResult?.fileCount).toBe(2);
  });

  test("setDiskSize fails without folder scanned", async () => {
    const result = await controller.setDiskSize("25GB");

    expect(result).toBe(false);
    expect(controller.getState().error).toBe("No folder scanned yet");
  });

  test("setDiskSize fails with invalid format", async () => {
    await controller.setFolderPath(TEST_DIR);
    const result = await controller.setDiskSize("invalid");

    expect(result).toBe(false);
    expect(controller.getState().error).toContain("Invalid size format");
  });

  test("setDiskSize succeeds with valid size", async () => {
    await controller.setFolderPath(TEST_DIR);
    const result = await controller.setDiskSize("25GB");

    expect(result).toBe(true);
    expect(controller.getState().step).toBe("summary");
    expect(controller.getState().bundlePlan).not.toBeNull();
  });

  test("goBack navigates from summary to diskSize", async () => {
    await controller.setFolderPath(TEST_DIR);
    await controller.setDiskSize("25GB");

    expect(controller.getState().step).toBe("summary");

    controller.goBack();

    expect(controller.getState().step).toBe("diskSize");
  });

  test("goBack navigates from diskSize to folder", async () => {
    await controller.setFolderPath(TEST_DIR);

    expect(controller.getState().step).toBe("diskSize");

    controller.goBack();

    expect(controller.getState().step).toBe("folder");
  });

  test("reset restores initial state", async () => {
    await controller.setFolderPath(TEST_DIR);
    await controller.setDiskSize("25GB");

    controller.reset();

    const state = controller.getState();
    expect(state.step).toBe("folder");
    expect(state.folderPath).toBe("");
    expect(state.scanResult).toBeNull();
    expect(state.bundlePlan).toBeNull();
  });

  test("subscribe receives state updates", async () => {
    const states: any[] = [];

    controller.subscribe((state) => {
      states.push({ ...state });
    });

    await controller.setFolderPath(TEST_DIR);

    expect(states.length).toBeGreaterThan(0);
    expect(states[states.length - 1].step).toBe("diskSize");
  });

  test("unsubscribe stops receiving updates", async () => {
    const states: any[] = [];

    const unsubscribe = controller.subscribe((state) => {
      states.push({ ...state });
    });

    await controller.setFolderPath(TEST_DIR);
    const countAfterFirst = states.length;

    unsubscribe();

    await controller.setDiskSize("25GB");

    expect(states.length).toBe(countAfterFirst);
  });
});
