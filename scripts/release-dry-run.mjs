import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
}

function main() {
  let stageDir;

  try {
    run("npm", ["run", "release:check"]);

    const packageJsonPath = path.join(repoRoot, "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    const publishName = process.env.SINGBOX_IAC_PACKAGE_NAME?.trim() || packageJson.name;

    stageDir = mkdtempSync(path.join(tmpdir(), "singbox-iac-publish-dry-run-"));
    console.log(`\nPublish dry-run dir: ${stageDir}`);

    cpSync(path.join(repoRoot, "dist"), path.join(stageDir, "dist"), { recursive: true });
    cpSync(path.join(repoRoot, "docs"), path.join(stageDir, "docs"), { recursive: true });
    cpSync(path.join(repoRoot, "examples"), path.join(stageDir, "examples"), { recursive: true });
    cpSync(path.join(repoRoot, "README.md"), path.join(stageDir, "README.md"));
    cpSync(path.join(repoRoot, "LICENSE"), path.join(stageDir, "LICENSE"));

    const stagedPackageJson = {
      ...packageJson,
      name: publishName,
      private: false,
      scripts: {
        ...packageJson.scripts,
        prepare: 'node -e "process.exit(0)"',
        prepack: 'node -e "process.exit(0)"',
      },
    };

    writeFileSync(
      path.join(stageDir, "package.json"),
      `${JSON.stringify(stagedPackageJson, null, 2)}\n`,
      "utf8",
    );

    const publishArgs = ["publish", "--dry-run"];
    if (publishName.startsWith("@")) {
      publishArgs.push("--access", "public");
    }

    run("npm", publishArgs, { cwd: stageDir });

    rmSync(stageDir, { recursive: true, force: true });
    console.log("\nrelease:dry-run passed");
  } catch (error) {
    console.error("\nrelease:dry-run failed");
    if (stageDir) {
      console.error(`Publish dry-run dir kept at: ${stageDir}`);
    }
    throw error;
  }
}

main();
