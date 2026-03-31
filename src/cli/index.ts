#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { Command } from "commander";

import { registerApplyCommand } from "./commands/apply.js";
import { registerAuthorCommand } from "./commands/author.js";
import { registerBuildCommand } from "./commands/build.js";
import { registerCheckCommand } from "./commands/check.js";
import { registerDoctorCommand } from "./commands/doctor.js";
import { registerInitCommand } from "./commands/init.js";
import { registerReloadCommand } from "./commands/reload.js";
import { registerRunCommand } from "./commands/run.js";
import { registerScheduleCommand } from "./commands/schedule.js";
import { registerSetupCommand } from "./commands/setup.js";
import { registerTemplatesCommand } from "./commands/templates.js";
import { registerUpdateCommand } from "./commands/update.js";
import { registerVerifyCommand } from "./commands/verify.js";

export function createProgram(): Command {
  const program = new Command();

  program
    .name("singbox-iac")
    .description("Policy-first subscription compiler for sing-box on macOS.")
    .version("0.1.3");

  registerInitCommand(program);
  registerSetupCommand(program);
  registerAuthorCommand(program);
  registerBuildCommand(program);
  registerCheckCommand(program);
  registerApplyCommand(program);
  registerRunCommand(program);
  registerVerifyCommand(program);
  registerUpdateCommand(program);
  registerDoctorCommand(program);
  registerReloadCommand(program);
  registerScheduleCommand(program);
  registerTemplatesCommand(program);

  return program;
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
