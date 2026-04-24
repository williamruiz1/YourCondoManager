/**
 * macOS compatibility guard for script/dev.ts.
 *
 * /proc/net/tcp and /proc/<pid>/* are Linux-only. On darwin (macOS)
 * the function must short-circuit before touching fs. This test
 * stubs process.platform to "darwin" and fails if any /proc read
 * happens.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import child_process from "child_process";

describe("script/dev.ts: killExistingLocalDevServer on non-Linux", () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    Object.defineProperty(process, "platform", { value: "darwin", configurable: true });
    // Any /proc read from inside the function fails the test.
    vi.spyOn(fs, "readFileSync").mockImplementation(() => {
      const err = new Error("ENOENT: /proc is not available on this platform");
      (err as NodeJS.ErrnoException).code = "ENOENT";
      throw err;
    });
    vi.spyOn(fs, "readdirSync").mockImplementation(() => {
      const err = new Error("ENOENT: /proc is not available on this platform");
      (err as NodeJS.ErrnoException).code = "ENOENT";
      throw err;
    });
    // Prevent the module's top-level startWatcher() call from spawning tsx.
    vi.spyOn(child_process, "spawn").mockImplementation((() => {
      const fakeChild = { on: vi.fn() } as unknown as child_process.ChildProcess;
      return fakeChild;
    }) as typeof child_process.spawn);
  });

  afterEach(() => {
    Object.defineProperty(process, "platform", { value: originalPlatform, configurable: true });
    vi.restoreAllMocks();
  });

  it("returns without reading /proc on darwin", async () => {
    const mod = await import("../../script/dev");
    await expect(mod.killExistingLocalDevServer(5000)).resolves.toBeUndefined();
    expect(fs.readFileSync).not.toHaveBeenCalled();
    expect(fs.readdirSync).not.toHaveBeenCalled();
  });
});
