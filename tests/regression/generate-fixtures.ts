import { execFileSync } from "node:child_process";
import path from "node:path";

import {
  buildRegressionFixtureArtifacts,
  listRegressionFixtures,
  writeRegressionFixtureSnapshots,
} from "./fixture-library.js";

const filesToFormat: string[] = [];
for (const fixture of listRegressionFixtures()) {
  const artifacts = buildRegressionFixtureArtifacts(fixture);

  try {
    writeRegressionFixtureSnapshots(fixture, artifacts);
    filesToFormat.push(fixture.compiledConfigPath, fixture.verificationPlanPath);
    process.stdout.write(`Updated regression fixture snapshots: ${fixture.id}\n`);
  } finally {
    artifacts.cleanup();
  }
}

if (filesToFormat.length > 0) {
  execFileSync(
    path.resolve(process.cwd(), "node_modules/.bin/biome"),
    ["format", "--write", ...filesToFormat],
    {
      cwd: process.cwd(),
      stdio: "inherit",
    },
  );
}
