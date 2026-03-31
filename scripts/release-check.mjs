import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

function run(command, args, options = {}) {
  const label = `${command} ${args.join(" ")}`.trim();
  console.log(`\n$ ${label}`);

  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
    encoding: "utf8",
    ...options,
  });

  if (result.status !== 0) {
    throw new Error(`Command failed: ${label}`);
  }

  return result;
}

function runCapture(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
    ...options,
  });

  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    throw new Error(
      stderr ? `${command} ${args.join(" ")}\n${stderr}` : `Command failed: ${command}`,
    );
  }

  return result.stdout ?? "";
}

function main() {
  let tarballPath;
  let tempDir;

  try {
    run("npm", ["run", "typecheck"]);
    run("npm", ["run", "lint"]);
    run("npm", ["test"]);
    run("npm", ["run", "build"]);

    const packJson = runCapture("npm", ["pack", "--json"]);
    const packResult = JSON.parse(packJson);
    tarballPath = path.resolve(repoRoot, packResult[0].filename);
    console.log(`\nPacked tarball: ${tarballPath}`);

    tempDir = mkdtempSync(path.join(tmpdir(), "singbox-iac-release-check-"));
    console.log(`Install smoke dir: ${tempDir}`);

    run("npm", ["init", "-y"], { cwd: tempDir });
    run("npm", ["install", tarballPath], { cwd: tempDir });

    const helpOutput = runCapture(
      path.join(tempDir, "node_modules", ".bin", "singbox-iac"),
      ["--help"],
      {
        cwd: tempDir,
      },
    );

    if (!helpOutput.includes("Usage: singbox-iac")) {
      throw new Error("Installed CLI did not print expected help output.");
    }

    console.log("\nInstalled CLI help:");
    process.stdout.write(helpOutput.split("\n").slice(0, 12).join("\n"));
    process.stdout.write("\n");

    rmSync(tempDir, { recursive: true, force: true });
    rmSync(tarballPath, { force: true });

    console.log("\nrelease:check passed");
  } catch (error) {
    console.error("\nrelease:check failed");
    if (tarballPath) {
      console.error(`Tarball kept at: ${tarballPath}`);
    }
    if (tempDir) {
      console.error(`Install smoke dir kept at: ${tempDir}`);
    }
    throw error;
  }
}

main();
