import { constants } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export interface InitWorkspaceInput {
  readonly configOutPath: string;
  readonly rulesOutPath: string;
  readonly examplesDir: string;
  readonly subscriptionUrl?: string;
  readonly force?: boolean;
  readonly preserveExistingRules?: boolean;
}

export interface InitWorkspaceResult {
  readonly configPath: string;
  readonly rulesPath: string;
  readonly reusedExistingRules: boolean;
}

export async function initWorkspace(input: InitWorkspaceInput): Promise<InitWorkspaceResult> {
  const configTemplatePath = path.join(input.examplesDir, "builder.config.yaml");
  const rulesTemplatePath = path.join(input.examplesDir, "custom.rules.yaml");

  const [configTemplate, rulesTemplate] = await Promise.all([
    readFile(configTemplatePath, "utf8"),
    readFile(rulesTemplatePath, "utf8"),
  ]);

  const renderedConfig = input.subscriptionUrl
    ? configTemplate.replace(
        'url: "https://example.com/subscription"',
        `url: "${escapeYamlDoubleQuotedString(input.subscriptionUrl)}"`,
      )
    : configTemplate;
  const configWithRulesPath = renderedConfig.replace(
    'userRulesFile: "~/.config/singbox-iac/rules/custom.rules.yaml"',
    `userRulesFile: "${escapeYamlDoubleQuotedString(input.rulesOutPath)}"`,
  );

  await writeIfAllowed(input.configOutPath, configWithRulesPath, input.force === true);
  const reusedExistingRules = await writeIfAllowed(
    input.rulesOutPath,
    rulesTemplate,
    input.force === true,
    input.preserveExistingRules === true,
  );

  return {
    configPath: input.configOutPath,
    rulesPath: input.rulesOutPath,
    reusedExistingRules,
  };
}

async function writeIfAllowed(
  filePath: string,
  content: string,
  force: boolean,
  preserveExisting = false,
): Promise<boolean> {
  if (!force && (await pathExists(filePath))) {
    if (preserveExisting) {
      return true;
    }
    throw new Error(`Refusing to overwrite existing file: ${filePath}`);
  }

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
  return false;
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function escapeYamlDoubleQuotedString(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}
