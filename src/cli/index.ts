#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { Command } from "commander";

import { registerApplyCommand } from "./commands/apply.js";
import { registerAuthorCommand } from "./commands/author.js";
import { registerBuildCommand } from "./commands/build.js";
import { registerCheckCommand } from "./commands/check.js";
import { registerDoctorCommand } from "./commands/doctor.js";
import { registerGoCommand } from "./commands/go.js";
import { registerHistoryCommand } from "./commands/history.js";
import { registerInitCommand } from "./commands/init.js";
import { registerProxifierCommand } from "./commands/proxifier.js";
import { registerQuickstartCommand } from "./commands/quickstart.js";
import { registerReloadCommand } from "./commands/reload.js";
import { registerRestartCommand } from "./commands/restart.js";
import { registerRollbackCommand } from "./commands/rollback.js";
import { registerRunCommand } from "./commands/run.js";
import { registerScheduleCommand } from "./commands/schedule.js";
import { registerSetupCommand } from "./commands/setup.js";
import { registerStartCommand } from "./commands/start.js";
import { registerStatusCommand } from "./commands/status.js";
import { registerStopCommand } from "./commands/stop.js";
import { registerTemplatesCommand } from "./commands/templates.js";
import { registerUpdateCommand } from "./commands/update.js";
import { registerUseCommand } from "./commands/use.js";
import { registerVerifyCommand } from "./commands/verify.js";

export function createProgram(): Command {
  const program = new Command();

  program
    .name("singbox-iac")
    .description("Policy-first subscription compiler for sing-box on macOS.")
    .version("0.1.9")
    .addHelpText(
      "after",
      [
        "",
        "Most users only need:",
        "  singbox-iac go <subscription-url> <一句话需求>",
        "  singbox-iac use <一句话需求>",
        "  singbox-iac update",
        "",
        "Health/debug:",
        "  singbox-iac status",
        "  singbox-iac start | stop | restart",
        "",
        "Advanced commands: quickstart, setup, author, build, verify, proxifier, schedule",
      ].join("\n"),
    );

  registerGoCommand(program);
  registerUseCommand(program);
  registerUpdateCommand(program);
  registerInitCommand(program);
  registerSetupCommand(program);
  registerStatusCommand(program);
  registerStartCommand(program);
  registerStopCommand(program);
  registerRestartCommand(program);
  registerQuickstartCommand(program);
  registerAuthorCommand(program);
  registerBuildCommand(program);
  registerCheckCommand(program);
  registerApplyCommand(program);
  registerHistoryCommand(program);
  registerRunCommand(program);
  registerRollbackCommand(program);
  registerVerifyCommand(program);
  registerDoctorCommand(program);
  registerProxifierCommand(program);
  registerReloadCommand(program);
  registerScheduleCommand(program);
  registerTemplatesCommand(program);
  hideAdvancedCommands(program);

  return program;
}

function hideAdvancedCommands(program: Command): void {
  for (const commandName of [
    "init",
    "setup",
    "status",
    "start",
    "stop",
    "restart",
    "quickstart",
    "author",
    "build",
    "check",
    "apply",
    "history",
    "run",
    "rollback",
    "verify",
    "doctor",
    "proxifier",
    "reload",
    "schedule",
    "templates",
  ]) {
    const command = program.commands.find((entry) => entry.name() === commandName);
    if (command) {
      (command as Command & { _hidden?: boolean })._hidden = true;
    }
  }
}

export async function run(argv: string[]): Promise<void> {
  await createProgram().parseAsync(argv);
}

export function isDirectCliInvocation(cliModuleUrl: string, argvPath: string | undefined): boolean {
  if (!argvPath) {
    return false;
  }

  const cliPath = fileURLToPath(cliModuleUrl);

  try {
    return realpathSync(cliPath) === realpathSync(argvPath);
  } catch {
    return cliPath === argvPath;
  }
}

if (isDirectCliInvocation(import.meta.url, process.argv[1])) {
  void run(process.argv);
}
