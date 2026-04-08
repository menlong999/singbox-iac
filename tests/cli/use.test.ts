import { Command } from "commander";
import { afterEach, describe, expect, it, vi } from "vitest";

const { runAuthorFlow } = vi.hoisted(() => ({
  runAuthorFlow: vi.fn(async () => undefined),
}));

vi.mock("../../src/cli/commands/author.js", () => ({
  runAuthorFlow,
}));

describe("use command", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("applies a natural-language prompt through the author flow with update enabled", async () => {
    const { registerUseCommand } = await import("../../src/cli/commands/use.js");
    const program = new Command();
    registerUseCommand(program);

    await program.parseAsync([
      "node",
      "singbox-iac",
      "use",
      "GitHub 走香港，Gemini 走新加坡",
      "--preview",
      "--skip-verify",
    ]);

    expect(runAuthorFlow).toHaveBeenCalledTimes(1);
    expect(runAuthorFlow).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "GitHub 走香港，Gemini 走新加坡",
        authoringMode: "patch",
        preview: true,
        skipVerify: true,
        update: true,
      }),
    );
  });

  it("forwards strict/diff/emit-intent-ir flags to the author flow", async () => {
    const { registerUseCommand } = await import("../../src/cli/commands/use.js");
    const program = new Command();
    registerUseCommand(program);

    await program.parseAsync([
      "node",
      "singbox-iac",
      "use",
      "GitHub 走香港",
      "--diff",
      "--emit-intent-ir",
      "--strict",
    ]);

    expect(runAuthorFlow).toHaveBeenCalledTimes(1);
    expect(runAuthorFlow).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "GitHub 走香港",
        authoringMode: "patch",
        diff: true,
        emitIntentIr: true,
        strict: true,
        update: true,
      }),
    );
  });

  it("can request explicit replacement semantics", async () => {
    const { registerUseCommand } = await import("../../src/cli/commands/use.js");
    const program = new Command();
    registerUseCommand(program);

    await program.parseAsync(["node", "singbox-iac", "use", "OpenRouter 走香港", "--replace"]);

    expect(runAuthorFlow).toHaveBeenCalledTimes(1);
    expect(runAuthorFlow).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "OpenRouter 走香港",
        authoringMode: "replace",
        update: true,
      }),
    );
  });
});
