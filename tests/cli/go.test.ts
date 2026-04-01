import { Command } from "commander";
import { afterEach, describe, expect, it, vi } from "vitest";

const { runSetupFlow } = vi.hoisted(() => ({
  runSetupFlow: vi.fn(async () => undefined),
}));

vi.mock("../../src/cli/commands/setup.js", () => ({
  runSetupFlow,
}));

describe("go command", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("maps positional onboarding input into the ready setup flow", async () => {
    const { registerGoCommand } = await import("../../src/cli/commands/go.js");
    const program = new Command();
    registerGoCommand(program);

    await program.parseAsync([
      "node",
      "singbox-iac",
      "go",
      "https://example.com/subscription",
      "GitHub 走香港，Antigravity 进程级走美国",
      "--no-run",
      "--no-browser",
      "--no-load",
    ]);

    expect(runSetupFlow).toHaveBeenCalledTimes(1);
    expect(runSetupFlow).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriptionUrl: "https://example.com/subscription",
        prompt: "GitHub 走香港，Antigravity 进程级走美国",
        doctor: true,
        verify: true,
        apply: true,
        ready: true,
        installSchedule: true,
        run: false,
        openBrowser: false,
        load: false,
      }),
    );
  });
});
