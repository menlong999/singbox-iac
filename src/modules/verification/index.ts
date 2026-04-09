import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

import type { BuilderConfig } from "../../config/schema.js";
import type { DNSPlan } from "../../domain/dns-plan.js";
import type { VerificationPlan } from "../../domain/verification-plan.js";
import { checkConfig, resolveSingBoxBinary } from "../manager/index.js";
import { resolveChromeDependency } from "../runtime-dependencies/index.js";

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

export interface DnsVerificationResult {
  readonly domain: string;
  readonly passed: boolean;
  readonly expectedMode: "fake-ip" | "real-ip";
  readonly actualMode: "fake-ip" | "real-ip";
  readonly resolver: string;
}

export interface AppVerificationResult {
  readonly app: string;
  readonly passed: boolean;
  readonly expectedInbound: "in-proxifier" | "in-default";
  readonly expectedOutboundGroup: string;
  readonly details: string;
}

export interface ProtocolVerificationResult {
  readonly target: string;
  readonly passed: boolean;
  readonly expectTCPOnly: boolean;
  readonly details: string;
}

export interface EgressVerificationResult {
  readonly id: string;
  readonly target: string;
  readonly inbound: "in-mixed" | "in-proxifier";
  readonly expectedOutboundGroup: string;
  readonly passed: boolean;
  readonly ip?: string;
  readonly country?: string;
  readonly asn?: string;
  readonly details: string;
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

interface JsonRequestResult extends RequestRunResult {
  readonly body: string;
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
      results.push(await verifyRuntimeScenario(scenario, logBuffer, requestBinary));
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

export function verifyDnsPlan(
  plan: VerificationPlan,
  dnsPlan: DNSPlan,
): readonly DnsVerificationResult[] {
  return plan.dnsChecks.map((check) => ({
    domain: check.domain,
    passed: dnsPlan.mode === check.expectedMode,
    expectedMode: check.expectedMode,
    actualMode: dnsPlan.mode,
    resolver: check.expectedResolver ?? dnsPlan.defaultResolvers[0] ?? "unknown",
  }));
}

export function verifyAppPlan(
  plan: VerificationPlan,
  config: JsonObject,
): readonly AppVerificationResult[] {
  const route = asObject(config.route, "Config is missing route.");
  const rules = ensureArray<JsonObject>(route.rules, "Route is missing rules.");
  const proxifierProtected = rules.some(
    (rule) =>
      Array.isArray(rule.inbound) &&
      rule.inbound.includes("in-proxifier") &&
      rule.action === "route" &&
      rule.outbound === "Process-Proxy",
  );

  return plan.appChecks.map((check) => ({
    app: check.app,
    passed: check.expectedInbound === "in-proxifier" ? proxifierProtected : true,
    expectedInbound: check.expectedInbound,
    expectedOutboundGroup: check.expectedOutboundGroup,
    details:
      check.expectedInbound === "in-proxifier"
        ? "Protected in-proxifier route is present."
        : "No special app inbound is required.",
  }));
}

export function verifyProtocolPlan(
  plan: VerificationPlan,
  config: JsonObject,
): readonly ProtocolVerificationResult[] {
  const route = asObject(config.route, "Config is missing route.");
  const rules = ensureArray<JsonObject>(route.rules, "Route is missing rules.");
  const quicReject = rules.some(
    (rule) => rule.network === "udp" && rule.port === 443 && rule.action === "reject",
  );

  return plan.protocolChecks.map((check) => ({
    target: check.target,
    passed: check.expectTCPOnly ? quicReject : true,
    expectTCPOnly: check.expectTCPOnly === true,
    details:
      check.expectTCPOnly === true
        ? quicReject
          ? "UDP 443 reject is present, so TCP-only fallback is enforced."
          : "UDP 443 reject is missing."
        : "No protocol restriction requested.",
  }));
}

export async function verifyEgressPlan(input: {
  readonly configPath: string;
  readonly checks: VerificationPlan["egressChecks"];
  readonly singBoxBinary?: string;
  readonly requestBinary?: string;
}): Promise<readonly EgressVerificationResult[]> {
  if (input.checks.length === 0) {
    return [];
  }

  const singBoxBinary = await resolveSingBoxBinary(input.singBoxBinary);
  const requestBinary = input.requestBinary ?? (await resolveCurlBinary());
  const baseConfig = JSON.parse(await readFile(input.configPath, "utf8")) as JsonObject;
  const egressGeoServiceUrls = [
    "https://api.ip.sb/geoip",
    "https://ipinfo.io/json",
    "https://ifconfig.co/json",
  ];
  const egressIpServiceUrls = [
    "https://api.ipify.org?format=json",
    "https://api64.ipify.org?format=json",
    "https://ifconfig.me/all.json",
    "https://icanhazip.com/",
  ];
  const results: EgressVerificationResult[] = [];

  for (const check of input.checks) {
    const prepared = await prepareVerificationConfig(baseConfig);
    const route = asObject(prepared.config.route, "Config is missing route.");
    const rules = ensureArray<JsonObject>(route.rules, "Route is missing rules.");
    rules.unshift({
      domain_suffix: [...egressGeoServiceUrls, ...egressIpServiceUrls].map(
        (url) => new URL(url).hostname,
      ),
      action: "route",
      outbound: check.expectedOutboundGroup,
    });

    const runDir = await mkdtemp(path.join(tmpdir(), "singbox-iac-egress-"));
    const verifyConfigPath = path.join(runDir, "egress.config.json");
    const logPath = path.join(runDir, "egress.log");
    await writeFile(verifyConfigPath, `${JSON.stringify(prepared.config, null, 2)}\n`, "utf8");
    await checkConfig({ configPath: verifyConfigPath, singBoxBinary });

    const logBuffer = { text: "" };
    const appender = async (chunk: Buffer | string): Promise<void> => {
      const text = chunk.toString();
      logBuffer.text += text;
      await writeFile(logPath, text, { encoding: "utf8", flag: "a" });
    };

    const child = spawn(singBoxBinary, ["run", "-c", verifyConfigPath], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", (chunk) => void appender(chunk));
    child.stderr.on("data", (chunk) => void appender(chunk));
    const exitPromise = new Promise<number>((resolve, reject) => {
      child.on("error", reject);
      child.on("close", (code) => resolve(code ?? 0));
    });

    try {
      await waitForLog(
        logBuffer,
        /sing-box started/,
        15_000,
        "Timed out waiting for sing-box startup during egress verification.",
      );
      const proxyPort =
        check.inbound === "in-proxifier" ? prepared.proxifierPort : prepared.mixedPort;
      let payload = await probeEgressPayload({
        requestBinary,
        proxyPort,
        targets: [check.target, ...egressGeoServiceUrls.filter((url) => url !== check.target)],
      });
      let ip = extractIpAddress(payload);
      let country = normalizeCountryCode(payload);
      let asn = normalizeAsn(payload);

      if (!ip || !country || !asn) {
        const ipPayload = await probeEgressPayload({
          requestBinary,
          proxyPort,
          targets: egressIpServiceUrls,
        });
        payload = { ...payload, ...ipPayload };
        ip = extractIpAddress(payload);
        country = normalizeCountryCode(payload);
        asn = normalizeAsn(payload);
      }

      if (ip && (!country || !asn)) {
        const geoPayload = await probeEgressPayload({
          requestBinary,
          targets: [`https://api.ip.sb/geoip/${ip}`, `https://ipinfo.io/${ip}/json`],
        });
        payload = { ...payload, ...geoPayload, ip };
        country = normalizeCountryCode(payload);
        asn = normalizeAsn(payload);
      }

      const expectedCountrySatisfied =
        !check.expectedCountry || check.expectedCountry.length === 0
          ? true
          : country !== undefined && check.expectedCountry.includes(country);
      const expectedAsnSatisfied =
        !check.expectedASN || check.expectedASN.length === 0
          ? true
          : asn !== undefined && check.expectedASN.some((expected) => asn.includes(expected));
      results.push({
        id: check.id,
        target: check.target,
        inbound: check.inbound,
        expectedOutboundGroup: check.expectedOutboundGroup,
        passed: expectedCountrySatisfied && expectedAsnSatisfied,
        ...(ip ? { ip } : {}),
        ...(country ? { country } : {}),
        ...(asn ? { asn } : {}),
        details: `Exit via ${check.expectedOutboundGroup} returned ${JSON.stringify(payload)}`,
      });
    } catch (error) {
      results.push({
        id: check.id,
        target: check.target,
        inbound: check.inbound,
        expectedOutboundGroup: check.expectedOutboundGroup,
        passed: false,
        details: error instanceof Error ? error.message : String(error),
      });
    } finally {
      child.kill("SIGINT");
      await Promise.race([exitPromise, new Promise((resolve) => setTimeout(resolve, 2_000))]);
    }
  }

  return results;
}

async function verifyRuntimeScenario(
  scenario: RuntimeScenario,
  logBuffer: { text: string },
  requestBinary: string,
): Promise<VerificationScenarioResult> {
  const hostname = new URL(scenario.url).hostname;
  const expectedLog =
    scenario.expectedOutboundTag === "direct"
      ? new RegExp(
          `outbound/direct\\[direct\\]: outbound connection to ${escapeRegExp(hostname)}:443`,
        )
      : new RegExp(
          `outbound/trojan\\[${escapeRegExp(
            scenario.expectedOutboundTag,
          )}\\]: outbound connection to ${escapeRegExp(hostname)}:443`,
        );

  const inboundLog = new RegExp(
    `inbound/mixed\\[${escapeRegExp(scenario.inboundTag)}\\]: inbound connection to ${escapeRegExp(
      hostname,
    )}:443`,
  );

  let lastFailure = `Expected logs were not observed for ${hostname} within the timeout.`;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const offset = logBuffer.text.length;
    const requestResult = await runProxyRequestScenario({
      requestBinary,
      proxyPort: scenario.proxyPort,
      url: scenario.url,
    });
    const excerpt = await waitForScenarioLogs(logBuffer, offset, [inboundLog, expectedLog], 20_000);
    const requestFailure = detectRequestFailure(requestResult);

    const routeLevelProxySuccess = isRouteLevelProxySuccess(scenario, requestResult);

    if (excerpt !== undefined && (requestFailure === undefined || routeLevelProxySuccess)) {
      return {
        name: scenario.name,
        passed: true,
        details: routeLevelProxySuccess
          ? `${excerpt.trim()}\nRoute matched and proxy CONNECT succeeded; upstream TLS did not finish before curl timed out.`
          : excerpt.trim(),
        url: scenario.url,
        inboundTag: scenario.inboundTag,
        expectedOutboundTag: scenario.expectedOutboundTag,
      };
    }

    lastFailure =
      requestFailure ?? `Expected logs were not observed for ${hostname} within the timeout.`;

    if (attempt < 2) {
      await sleep(500);
    }
  }

  return {
    name: scenario.name,
    passed: false,
    details: lastFailure,
    url: scenario.url,
    inboundTag: scenario.inboundTag,
    expectedOutboundTag: scenario.expectedOutboundTag,
  };
}

export function isRouteLevelProxySuccess(
  scenario: Pick<RuntimeScenario, "inboundTag">,
  requestResult: RequestRunResult,
): boolean {
  if (scenario.inboundTag !== "in-proxifier") {
    return false;
  }

  return (
    requestResult.exitCode === 28 &&
    `${requestResult.stdout}\n${requestResult.stderr}`.includes(
      "HTTP/1.1 200 Connection established",
    )
  );
}

export async function resolveChromeBinary(
  explicitPath?: string,
  persistedPath?: string,
): Promise<string> {
  const resolved = await resolveChromeDependency({
    explicitPath,
    persistedPath,
  });
  return resolved.path;
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
  const tunPort = await findAvailablePort();

  const inbounds = ensureArray<JsonObject>(cloned.inbounds, "Config is missing inbounds.");
  const hasMixedInbound = inbounds.some((inbound) => inbound.tag === "in-mixed");
  for (const inbound of inbounds) {
    if (inbound.tag === "in-mixed") {
      inbound.listen_port = mixedPort;
    }
    if (inbound.tag === "in-proxifier") {
      inbound.listen_port = proxifierPort;
    }
    if (inbound.tag === "in-tun") {
      for (const key of Object.keys(inbound)) {
        inbound[key] = undefined;
      }
      Object.assign(inbound, {
        type: "mixed",
        tag: hasMixedInbound ? "in-tun" : "in-mixed",
        listen: "127.0.0.1",
        listen_port: hasMixedInbound ? tunPort : mixedPort,
      });
    }
  }

  cloned.log = { level: "debug" };

  const dns = asObject(cloned.dns, "Config is missing dns.");
  dns.servers = [
    {
      type: "local",
      tag: "dns-local-verify",
    },
  ];
  dns.rules = [];
  dns.final = "dns-local-verify";
  dns.reverse_mapping = false;

  const route = asObject(cloned.route, "Config is missing route.");
  route.default_domain_resolver = "dns-local-verify";

  if (typeof cloned.experimental === "object" && cloned.experimental !== null) {
    const experimental = asObject(cloned.experimental, "Config has an invalid experimental block.");
    const { cache_file: _cacheFile, ...remaining } = experimental;
    cloned.experimental = Object.keys(remaining).length === 0 ? undefined : remaining;
  }

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

async function runProxyJsonRequestScenario(input: {
  readonly requestBinary: string;
  readonly proxyPort: number;
  readonly url: string;
}): Promise<JsonRequestResult> {
  return runJsonRequestScenario(input);
}

async function runJsonRequestScenario(input: {
  readonly requestBinary: string;
  readonly url: string;
  readonly proxyPort?: number;
}): Promise<JsonRequestResult> {
  const args = [
    "--silent",
    "--show-error",
    "--location",
    "--max-time",
    "12",
    "--connect-timeout",
    "5",
    input.url,
  ];
  if (typeof input.proxyPort === "number") {
    args.splice(args.length - 1, 0, "--proxy", `http://127.0.0.1:${input.proxyPort}`);
  }

  return new Promise<JsonRequestResult>((resolve, reject) => {
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
        body: stdout,
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

function parseEgressPayload(body: string): Record<string, unknown> {
  const trimmed = body.trim();
  if (trimmed.length === 0) {
    throw new Error("Egress probe returned an empty body.");
  }

  if (isIpAddress(trimmed)) {
    return { ip: trimmed };
  }

  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    throw new Error(`Unable to parse egress response JSON:\n${trimmed}`);
  }
}

async function probeEgressPayload(input: {
  readonly requestBinary: string;
  readonly proxyPort?: number;
  readonly targets: readonly string[];
}): Promise<Record<string, unknown>> {
  const errors: string[] = [];

  for (const target of input.targets) {
    const result = await runJsonRequestScenario({
      requestBinary: input.requestBinary,
      url: target,
      ...(typeof input.proxyPort === "number" ? { proxyPort: input.proxyPort } : {}),
    });
    if (result.exitCode !== 0 || result.timedOut) {
      errors.push(`${target}: ${detectRequestFailure(result) ?? "request failed"}`);
      continue;
    }

    try {
      return parseEgressPayload(result.body);
    } catch (error) {
      errors.push(`${target}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(`All egress probes failed.\n${errors.join("\n")}`);
}

function extractIpAddress(payload: Record<string, unknown>): string | undefined {
  const candidates = [payload.ip, payload.query, payload.address];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && isIpAddress(candidate.trim())) {
      return candidate.trim();
    }
  }
  return undefined;
}

function normalizeCountryCode(payload: Record<string, unknown>): string | undefined {
  if (typeof payload.country_code === "string") {
    return payload.country_code.toUpperCase();
  }
  if (typeof payload.country === "string" && payload.country.length <= 3) {
    return payload.country.toUpperCase();
  }
  return undefined;
}

function isIpAddress(value: string): boolean {
  return /^[\dA-Fa-f:.]+$/.test(value);
}

function normalizeAsn(payload: Record<string, unknown>): string | undefined {
  if (typeof payload.asn === "number") {
    return `AS${payload.asn}`;
  }
  if (typeof payload.asn === "string") {
    return payload.asn.startsWith("AS") ? payload.asn : `AS${payload.asn}`;
  }
  if (typeof payload.org === "string" && payload.org.length > 0) {
    return payload.org;
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
