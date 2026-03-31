import { Command } from "commander";
import { afterEach, describe, expect, it, vi } from "vitest";

const { runSetupFlow } = vi.hoisted(() => ({
  runSetupFlow: vi.fn(async () => undefined),
}));

vi.mock("../../src/cli/commands/setup.js", () => ({
  runSetupFlow,
}));

describe("quickstart command", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("maps the shortcut flags into the full setup flow", async () => {
    const { registerQuickstartCommand } = await import("../../src/cli/commands/quickstart.js");
    const program = new Command();
    registerQuickstartCommand(program);

    await program.parseAsync([
      "node",
      "singbox-iac",
      "quickstart",
      "--subscription-url",
      "https://example.com/subscription",
      "--prompt",
      "GitHub 走香港，Antigravity 进程级走美国",
      "--provider",
      "deterministic",
      "--author-timeout-ms",
      "1500",
      "--exec-command",
      "gemini",
      "--exec-arg",
      "--json",
      "--label",
      "org.singbox-iac.quickstart",
      "--no-run",
      "--no-browser",
      "--no-load",
    ]);

    expect(runSetupFlow).toHaveBeenCalledTimes(1);
    expect(runSetupFlow).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriptionUrl: "https://example.com/subscription",
        prompt: "GitHub 走香港，Antigravity 进程级走美国",
        provider: "deterministic",
        authorTimeoutMs: "1500",
        execCommand: "gemini",
        execArg: ["--json"],
        label: "org.singbox-iac.quickstart",
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
