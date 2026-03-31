import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

import type { BuilderConfig } from "../../config/schema.js";
import { checkConfig, resolveSingBoxBinary } from "../manager/index.js";

type JsonObject = Record<string, unknown>;

export interface VerifyConfigRoutesInput {
  readonly configPath: string;
  readonly singBoxBinary?: string;
  readonly chromeBinary?: string;
  readonly configuredScenarios?: readonly ConfiguredVerificationScenario[];
}

export interface VerificationCheckResult {
  readonly name: string;
  readonly passed: boolean;
  readonly details: string;
}

export interface VerificationScenarioResult {
  readonly name: string;
  readonly passed: boolean;
  readonly details: string;
  readonly url: string;
  readonly inboundTag: string;
  readonly expectedOutboundTag: string;
}

export interface VerificationReport {
  readonly configPath: string;
  readonly verifyConfigPath: string;
  readonly logPath: string;
  readonly singBoxBinary: string;
  readonly requestBinary: string;
  readonly checks: readonly VerificationCheckResult[];
  readonly scenarios: readonly VerificationScenarioResult[];
}

export interface VisibleVerificationScenario {
  readonly id: string;
  readonly name: string;
  readonly url: string;
  readonly inbound: "in-mixed" | "in-proxifier";
}

export interface VisibleChromeLaunch {
  readonly inbound: "in-mixed" | "in-proxifier";
  readonly proxyPort: number;
  readonly urls: readonly string[];
  readonly userDataDir: string;
}

export function assertVerificationReportPassed(report: VerificationReport): void {
  const failures = report.scenarios.filter((scenario) => !scenario.passed);
  if (failures.length === 0) {
    return;
  }

  throw new Error(
    `Runtime verification failed:\n${failures
      .map(
        (scenario) => `- ${scenario.name}\n  url: ${scenario.url}\n  details: ${scenario.details}`,
      )
      .join("\n")}`,
  );
}

interface PreparedVerificationConfig {
  readonly config: JsonObject;
  readonly mixedPort: number;
  readonly proxifierPort: number;
}

interface RuntimeScenario {
  readonly id: string;
  readonly name: string;
  readonly url: string;
  readonly inboundTag: "in-mixed" | "in-proxifier";
  readonly proxyPort: number;
  readonly expectedOutboundTag: string;
}

export interface ConfiguredVerificationScenario {
  readonly id: BuilderConfig["verification"]["scenarios"][number]["id"];
  readonly name: BuilderConfig["verification"]["scenarios"][number]["name"];
  readonly url: BuilderConfig["verification"]["scenarios"][number]["url"];
  readonly inbound: BuilderConfig["verification"]["scenarios"][number]["inbound"];
  readonly expectedOutbound: BuilderConfig["verification"]["scenarios"][number]["expectedOutbound"];
}

interface RequestRunResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly timedOut: boolean;
}

export async function verifyConfigRoutes(
  input: VerifyConfigRoutesInput,
): Promise<VerificationReport> {
  const singBoxBinary = await resolveSingBoxBinary(input.singBoxBinary);
  const requestBinary = await resolveCurlBinary();
  const rawConfig = JSON.parse(await readFile(input.configPath, "utf8")) as JsonObject;

  const checks = validateConfigInvariants(rawConfig);
  const failedChecks = checks.filter((check) => !check.passed);
  if (failedChecks.length > 0) {
    throw new Error(
      `Static verification failed:\n${failedChecks
        .map((check) => `- ${check.name}: ${check.details}`)
        .join("\n")}`,
    );
  }

  const runDir = await mkdtemp(path.join(tmpdir(), "singbox-iac-verify-"));
  const logPath = path.join(runDir, "sing-box.log");
  const verifyConfigPath = path.join(runDir, "verify.config.json");
  const prepared = await prepareVerificationConfig(rawConfig);

  await mkdir(path.dirname(verifyConfigPath), { recursive: true });
  await writeFile(verifyConfigPath, `${JSON.stringify(prepared.config, null, 2)}\n`, "utf8");

  await checkConfig({
    configPath: verifyConfigPath,
    singBoxBinary,
  });

  const scenarios = buildRuntimeScenarios(
    prepared.config,
    prepared.mixedPort,
    prepared.proxifierPort,
    input.configuredScenarios,
  );
  const logBuffer = { text: "" };
  const logAppender = async (chunk: Buffer | string): Promise<void> => {
    const text = chunk.toString();
    logBuffer.text += text;
    await writeFile(logPath, text, { encoding: "utf8", flag: "a" });
  };

  const singBoxProcess = spawn(singBoxBinary, ["run", "-c", verifyConfigPath], {
    stdio: ["ignore", "pipe", "pipe"],
  });

  singBoxProcess.stdout.on("data", (chunk) => {
    void logAppender(chunk);
  });
  singBoxProcess.stderr.on("data", (chunk) => {
    void logAppender(chunk);
  });

  const exitPromise = new Promise<number>((resolve, reject) => {
    singBoxProcess.on("error", reject);
    singBoxProcess.on("close", (code) => resolve(code ?? 0));
  });

  try {
    await waitForLog(
      logBuffer,
      /sing-box started/,
      15_000,
      "Timed out waiting for sing-box startup during verification.",
    );

    const results: VerificationScenarioResult[] = [];
    for (const scenario of scenarios) {
      const offset = logBuffer.text.length;
      const requestResult = await runProxyRequestScenario({
        requestBinary,
        proxyPort: scenario.proxyPort,
        url: scenario.url,
      });

      const expectedLog =
        scenario.expectedOutboundTag === "direct"
          ? new RegExp(
              `outbound/direct\\[direct\\]: outbound connection to ${escapeRegExp(
                new URL(scenario.url).hostname,
              )}:443`,
            )
          : new RegExp(
              `outbound/trojan\\[${escapeRegExp(
                scenario.expectedOutboundTag,
              )}\\]: outbound connection to ${escapeRegExp(new URL(scenario.url).hostname)}:443`,
            );

      const inboundLog = new RegExp(
        `inbound/mixed\\[${escapeRegExp(
          scenario.inboundTag,
        )}\\]: inbound connection to ${escapeRegExp(new URL(scenario.url).hostname)}:443`,
      );

      const excerpt = await waitForScenarioLogs(
        logBuffer,
        offset,
        [inboundLog, expectedLog],
        20_000,
      );
      const requestFailure = detectRequestFailure(requestResult);

      results.push({
        name: scenario.name,
        passed: excerpt !== undefined && requestFailure === undefined,
        details:
          excerpt !== undefined && requestFailure === undefined
            ? excerpt.trim()
            : (requestFailure ??
              `Expected logs were not observed for ${new URL(scenario.url).hostname} within the timeout.`),
        url: scenario.url,
        inboundTag: scenario.inboundTag,
        expectedOutboundTag: scenario.expectedOutboundTag,
      });
    }

    return {
      configPath: input.configPath,
      verifyConfigPath,
      logPath,
      singBoxBinary,
      requestBinary,
      checks,
      scenarios: results,
    };
  } finally {
    singBoxProcess.kill("SIGINT");
    await Promise.race([exitPromise, new Promise((resolve) => setTimeout(resolve, 2_000))]);
  }
}

export async function resolveChromeBinary(explicitPath?: string): Promise<string> {
  const candidates = [
    explicitPath,
    process.env.CHROME_BIN,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
  ].filter(
    (candidate): candidate is string => typeof candidate === "string" && candidate.length > 0,
  );

  for (const candidate of candidates) {
    if (await isExecutable(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    "Unable to find a usable Chrome binary. Set CHROME_BIN or install Google Chrome.",
  );
}

export async function openVisibleChromeWindows(input: {
  readonly scenarios: readonly VisibleVerificationScenario[];
  readonly mixedPort: number;
  readonly proxifierPort: number;
  readonly chromeBinary?: string;
}): Promise<readonly VisibleChromeLaunch[]> {
  const chromeBinary = await resolveChromeBinary(input.chromeBinary);
  const byInbound = new Map<"in-mixed" | "in-proxifier", VisibleVerificationScenario[]>();

  for (const scenario of input.scenarios) {
    const current = byInbound.get(scenario.inbound) ?? [];
    current.push(scenario);
    byInbound.set(scenario.inbound, current);
  }

  const launches: VisibleChromeLaunch[] = [];

  for (const [inbound, scenarios] of byInbound) {
    const profileDir = await mkdtemp(path.join(tmpdir(), "singbox-iac-visible-"));
    const proxyPort = inbound === "in-proxifier" ? input.proxifierPort : input.mixedPort;
    const urls = [...new Set(scenarios.map((scenario) => scenario.url))];
    const args = [
      "--new-window",
      "--disable-background-networking",
      "--disable-default-apps",
      "--disable-sync",
      "--no-first-run",
      "--no-default-browser-check",
      `--user-data-dir=${profileDir}`,
      `--proxy-server=http://127.0.0.1:${proxyPort}`,
      ...urls,
    ];

    const child = spawn(chromeBinary, args, {
      detached: true,
      stdio: "ignore",
    });
    child.unref();

    launches.push({
      inbound,
      proxyPort,
      urls,
      userDataDir: profileDir,
    });
  }

  return launches;
}

export async function resolveCurlBinary(explicitPath?: string): Promise<string> {
  const candidates = [
    explicitPath,
    process.env.CURL_BIN,
    "/usr/bin/curl",
    "/bin/curl",
    ...resolvePathCandidates("curl"),
  ].filter(
    (candidate): candidate is string => typeof candidate === "string" && candidate.length > 0,
  );

  for (const candidate of candidates) {
    if (await isExecutable(candidate)) {
      return candidate;
    }
  }

  throw new Error("Unable to find a usable curl binary for route verification.");
}

export async function prepareVerificationConfig(
  config: JsonObject,
): Promise<PreparedVerificationConfig> {
  const cloned = structuredClone(config) as JsonObject;
  const mixedPort = await findAvailablePort();
  const proxifierPort = await findAvailablePort();

  const inbounds = ensureArray<JsonObject>(cloned.inbounds, "Config is missing inbounds.");
  for (const inbound of inbounds) {
    if (inbound.tag === "in-mixed") {
      inbound.listen_port = mixedPort;
    }
    if (inbound.tag === "in-proxifier") {
      inbound.listen_port = proxifierPort;
    }
  }

  cloned.log = { level: "debug" };

  const dns = asObject(cloned.dns, "Config is missing dns.");
  dns.servers = [
    {
      type: "local",
      tag: "dns-local-verify",
      prefer_go: true,
    },
  ];
  dns.final = "dns-local-verify";

  const route = asObject(cloned.route, "Config is missing route.");
  route.default_domain_resolver = "dns-local-verify";

  const outbounds = ensureArray<JsonObject>(cloned.outbounds, "Config is missing outbounds.");
  const globalIndex = outbounds.findIndex((outbound) => outbound.tag === "Global");
  if (globalIndex >= 0) {
    const current = outbounds[globalIndex];
    if (!current) {
      throw new Error('Unable to resolve the "Global" outbound for verification.');
    }
    const targets = ensureArray<string>(
      current.outbounds,
      "Global outbound is missing outbounds for verification.",
    );
    outbounds[globalIndex] = {
      type: "selector",
      tag: "Global",
      outbounds: targets,
      default: targets[0],
    };
  }

  return {
    config: cloned,
    mixedPort,
    proxifierPort,
  };
}

export function validateConfigInvariants(config: JsonObject): VerificationCheckResult[] {
  const route = asObject(config.route, "Config is missing route.");
  const rules = ensureArray<JsonObject>(route.rules, "Route is missing rules.");
  const dns = asObject(config.dns, "Config is missing dns.");
  const dnsServers = ensureArray<JsonObject>(dns.servers, "DNS servers are missing.");

  const checks: VerificationCheckResult[] = [];
  const quicIndex = rules.findIndex(
    (rule) => rule.network === "udp" && rule.port === 443 && rule.action === "reject",
  );
  const dnsIndex = rules.findIndex(
    (rule) => rule.protocol === "dns" && rule.action === "hijack-dns",
  );
  const proxifierIndex = rules.findIndex(
    (rule) =>
      Array.isArray(rule.inbound) &&
      rule.inbound.includes("in-proxifier") &&
      rule.outbound === "Process-Proxy",
  );
  const stitchIndex = rules.findIndex(
    (rule) =>
      Array.isArray(rule.domain_suffix) &&
      rule.domain_suffix.includes("stitch.withgoogle.com") &&
      rule.outbound === "Stitch-Out",
  );
  const explicitAiIndex = rules.findIndex(
    (rule) =>
      Array.isArray(rule.domain_suffix) &&
      rule.domain_suffix.includes("chatgpt.com") &&
      rule.outbound === "AI-Out",
  );
  const aiRuleSetIndex = rules.findIndex(
    (rule) =>
      Array.isArray(rule.rule_set) &&
      rule.rule_set.includes("geosite-google-gemini") &&
      rule.outbound === "AI-Out",
  );
  const devRuleSetIndex = rules.findIndex(
    (rule) =>
      Array.isArray(rule.rule_set) &&
      rule.rule_set.includes("geosite-github") &&
      rule.outbound === "Dev-Common-Out",
  );
  const chinaIndex = rules.findIndex(
    (rule) =>
      Array.isArray(rule.rule_set) &&
      rule.rule_set.includes("geosite-cn") &&
      rule.outbound === "direct",
  );
  const priorityOrder = [
    { name: "quic", index: quicIndex, required: true },
    { name: "dns", index: dnsIndex, required: true },
    { name: "proxifier", index: proxifierIndex, required: true },
    { name: "stitch", index: stitchIndex, required: true },
    { name: "explicitAi", index: explicitAiIndex, required: true },
    { name: "aiRuleSet", index: aiRuleSetIndex, required: false },
    { name: "devRuleSet", index: devRuleSetIndex, required: false },
    { name: "china", index: chinaIndex, required: false },
  ];
  const routePriorityPassed =
    priorityOrder.every((entry) => !entry.required || entry.index >= 0) &&
    priorityOrder
      .filter((entry) => entry.index >= 0)
      .every((entry, index, entries) => {
        if (index === 0) {
          return true;
        }

        const previous = entries[index - 1];
        return previous !== undefined && previous.index < entry.index;
      });

  checks.push(
    makeCheck(
      "route-priority",
      routePriorityPassed,
      `Rule order indices: quic=${quicIndex}, dns=${dnsIndex}, proxifier=${proxifierIndex}, stitch=${stitchIndex}, explicitAi=${explicitAiIndex}, aiRuleSet=${aiRuleSetIndex}, devRuleSet=${devRuleSetIndex}, china=${chinaIndex}`,
    ),
  );

  checks.push(
    makeCheck(
      "default-domain-resolver",
      typeof route.default_domain_resolver === "string" &&
        dnsServers.some((server) => server.tag === route.default_domain_resolver),
      `default_domain_resolver=${String(route.default_domain_resolver)}`,
    ),
  );

  checks.push(
    makeCheck(
      "dns-shape",
      dnsServers.some((server) => server.type === "local" && server.tag === "dns-local-default") &&
        dnsServers.some(
          (server) =>
            (server.type === "tcp" || server.type === "udp") && server.server === "1.1.1.1",
        ) &&
        dnsServers.some(
          (server) =>
            (server.type === "tcp" || server.type === "udp") && server.server === "223.5.5.5",
        ),
      `dns servers=${dnsServers
        .map((server) => `${String(server.tag)}:${String(server.server)}`)
        .join(", ")}`,
    ),
  );

  return checks;
}

export function resolveDefaultLeafOutboundTag(config: JsonObject, tag: string): string {
  const outbounds = ensureArray<JsonObject>(config.outbounds, "Config is missing outbounds.");
  const byTag = new Map<string, JsonObject>();
  for (const outbound of outbounds) {
    if (typeof outbound.tag === "string") {
      byTag.set(outbound.tag, outbound);
    }
  }

  const visited = new Set<string>();
  let currentTag = tag;
  while (true) {
    if (currentTag === "direct" || currentTag === "block") {
      return currentTag;
    }
    if (visited.has(currentTag)) {
      throw new Error(`Detected selector cycle while resolving outbound tag "${tag}".`);
    }
    visited.add(currentTag);

    const current = byTag.get(currentTag);
    if (!current) {
      return currentTag;
    }

    if (current.type === "selector" || current.type === "urltest") {
      const next =
        typeof current.default === "string"
          ? current.default
          : ensureArray<string>(
              current.outbounds,
              `Selector/urltest "${currentTag}" is missing outbounds.`,
            )[0];
      if (!next) {
        throw new Error(`Selector/urltest "${currentTag}" has no default outbound target.`);
      }
      currentTag = next;
      continue;
    }

    return currentTag;
  }
}

function buildRuntimeScenarios(
  config: JsonObject,
  mixedPort: number,
  proxifierPort: number,
  configuredScenarios?: readonly ConfiguredVerificationScenario[],
): RuntimeScenario[] {
  const sourceScenarios =
    configuredScenarios && configuredScenarios.length > 0
      ? configuredScenarios
      : defaultConfiguredScenarios;

  return sourceScenarios.map((scenario) => ({
    id: scenario.id,
    name: scenario.name,
    url: scenario.url,
    inboundTag: scenario.inbound,
    proxyPort: scenario.inbound === "in-proxifier" ? proxifierPort : mixedPort,
    expectedOutboundTag:
      scenario.expectedOutbound === "direct" || scenario.expectedOutbound === "block"
        ? scenario.expectedOutbound
        : resolveDefaultLeafOutboundTag(config, scenario.expectedOutbound),
  }));
}

const defaultConfiguredScenarios: readonly ConfiguredVerificationScenario[] = [
  {
    id: "stitch",
    name: "Google Stitch routes via Stitch-Out default",
    url: "https://stitch.withgoogle.com/favicon.ico",
    inbound: "in-mixed",
    expectedOutbound: "Stitch-Out",
  },
  {
    id: "chatgpt",
    name: "ChatGPT routes via AI-Out explicit domain rule",
    url: "https://chatgpt.com/favicon.ico",
    inbound: "in-mixed",
    expectedOutbound: "AI-Out",
  },
  {
    id: "gemini",
    name: "Gemini routes via AI-Out ruleset",
    url: "https://gemini.google.com/favicon.ico",
    inbound: "in-mixed",
    expectedOutbound: "AI-Out",
  },
  {
    id: "github",
    name: "GitHub routes via Dev-Common-Out",
    url: "https://github.com/favicon.ico",
    inbound: "in-mixed",
    expectedOutbound: "Dev-Common-Out",
  },
  {
    id: "cn-direct",
    name: "China traffic routes direct on mixed inbound",
    url: "https://www.qq.com/favicon.ico",
    inbound: "in-mixed",
    expectedOutbound: "direct",
  },
  {
    id: "proxifier-precedence",
    name: "Proxifier inbound overrides CN direct rule",
    url: "https://www.qq.com/favicon.ico",
    inbound: "in-proxifier",
    expectedOutbound: "Process-Proxy",
  },
];

async function runProxyRequestScenario(input: {
  readonly requestBinary: string;
  readonly proxyPort: number;
  readonly url: string;
}): Promise<RequestRunResult> {
  const args = [
    "--silent",
    "--show-error",
    "--location",
    "--head",
    "--max-time",
    "12",
    "--connect-timeout",
    "5",
    "--proxy",
    `http://127.0.0.1:${input.proxyPort}`,
    input.url,
  ];

  return new Promise<RequestRunResult>((resolve, reject) => {
    const child = spawn(input.requestBinary, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, 12_000);

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve({
        exitCode: code ?? 0,
        stdout,
        stderr,
        timedOut,
      });
    });
  });
}

function detectRequestFailure(result: RequestRunResult): string | undefined {
  if (result.exitCode !== 0 && !result.timedOut) {
    return `Proxy request exited with code ${result.exitCode}.\n${`${result.stdout}\n${result.stderr}`.trim()}`;
  }

  if (result.timedOut) {
    return "Proxy request timed out.";
  }

  return undefined;
}

async function waitForScenarioLogs(
  buffer: { text: string },
  offset: number,
  patterns: readonly RegExp[],
  timeoutMs: number,
): Promise<string | undefined> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const excerpt = buffer.text.slice(offset);
    if (patterns.every((pattern) => pattern.test(excerpt))) {
      return excerpt;
    }
    await sleep(250);
  }
  return undefined;
}

async function waitForLog(
  buffer: { text: string },
  pattern: RegExp,
  timeoutMs: number,
  errorMessage: string,
): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (pattern.test(buffer.text)) {
      return;
    }
    await sleep(250);
  }

  throw new Error(`${errorMessage}\nRecent log output:\n${buffer.text.slice(-2000)}`);
}

async function findAvailablePort(): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Failed to allocate a local port for verification."));
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}

function ensureArray<T>(value: unknown, message: string): T[] {
  if (!Array.isArray(value)) {
    throw new Error(message);
  }
  return value as T[];
}

function asObject(value: unknown, message: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(message);
  }
  return value as JsonObject;
}

function makeCheck(name: string, passed: boolean, details: string): VerificationCheckResult {
  return { name, passed, details };
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function isExecutable(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function resolvePathCandidates(commandName: string): string[] {
  return (process.env.PATH ?? "")
    .split(path.delimiter)
    .filter((entry) => entry.length > 0)
    .map((entry) => path.join(entry, commandName))
    .filter((candidate, index, items) => items.indexOf(candidate) === index);
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
