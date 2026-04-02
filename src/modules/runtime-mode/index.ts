import type { BuilderConfig } from "../../config/schema.js";
import type { IntentIR } from "../../domain/intent.js";
import type {
  DesktopRuntimeProfileKind,
  RuntimeMode,
  RuntimeModeDefaults,
} from "../../domain/runtime-mode.js";

interface RuntimeModeInferenceInput {
  readonly phase: "onboarding" | "update";
  readonly prompt?: string;
  readonly intent?: IntentIR;
  readonly config?: BuilderConfig;
  readonly proxifierBundleIds?: readonly string[];
  readonly runInForeground?: boolean;
}

interface RuntimeModeScenario {
  readonly inbound: "in-mixed" | "in-proxifier";
}

const processKeywords = [
  "proxifier",
  "进程级",
  "process-level",
  "process proxy",
  "独立入口",
  "独立的入口",
];

const tunKeywords = ["tun", "全局代理", "全局模式", "系统全局", "utun", "全局接管"];

export function inferRuntimeMode(input: RuntimeModeInferenceInput): RuntimeMode {
  if (input.phase === "update") {
    return "headless-daemon";
  }

  const prompt = input.prompt?.toLowerCase() ?? "";
  const hasProcessPrompt = processKeywords.some((keyword) => prompt.includes(keyword));
  const hasProcessIntent = (input.intent?.processPolicies.length ?? 0) > 0;
  const hasProxifierBundles = (input.proxifierBundleIds?.length ?? 0) > 0;
  const hasProxifierScenarios =
    input.config?.verification.scenarios.some((scenario) => scenario.inbound === "in-proxifier") ??
    false;

  if (hasProcessPrompt || hasProcessIntent || hasProxifierBundles || hasProxifierScenarios) {
    return "process-proxy";
  }

  if (input.runInForeground === false) {
    return "headless-daemon";
  }

  return "browser-proxy";
}

export function getRuntimeModeDefaults(mode: RuntimeMode): RuntimeModeDefaults {
  switch (mode) {
    case "process-proxy":
      return {
        preferredListeners: ["proxifier", "mixed"],
        dnsMode: "real-ip",
        openVisibleBrowserByDefault: true,
        visibleBrowserScenarioLimit: 4,
        scheduleRecommended: true,
        desktopProfile: "system-proxy",
      };

    case "headless-daemon":
      return {
        preferredListeners: ["mixed"],
        dnsMode: "real-ip",
        openVisibleBrowserByDefault: false,
        visibleBrowserScenarioLimit: 0,
        scheduleRecommended: true,
        desktopProfile: "none",
      };

    default:
      return {
        preferredListeners: ["mixed"],
        dnsMode: "real-ip",
        openVisibleBrowserByDefault: true,
        visibleBrowserScenarioLimit: 3,
        scheduleRecommended: false,
        desktopProfile: "system-proxy",
      };
  }
}

export function inferDesktopRuntimeProfile(input: {
  readonly mode: RuntimeMode;
  readonly prompt?: string;
  readonly config?: BuilderConfig;
}): DesktopRuntimeProfileKind {
  const prompt = input.prompt?.toLowerCase() ?? "";
  if (tunKeywords.some((keyword) => prompt.includes(keyword))) {
    return "tun";
  }

  if (input.config?.runtime.desktop.profile) {
    return input.config.runtime.desktop.profile;
  }

  return getRuntimeModeDefaults(input.mode).desktopProfile;
}

export function selectVerificationScenariosForRuntimeMode<T extends RuntimeModeScenario>(
  mode: RuntimeMode,
  scenarios: readonly T[],
): readonly T[] {
  switch (mode) {
    case "process-proxy":
      return sortScenariosByInbound(scenarios, ["in-proxifier", "in-mixed"]);

    case "headless-daemon":
    case "browser-proxy": {
      const mixedOnly = scenarios.filter((scenario) => scenario.inbound === "in-mixed");
      return mixedOnly.length > 0 ? mixedOnly : sortScenariosByInbound(scenarios, ["in-mixed"]);
    }

    default:
      return scenarios;
  }
}

function sortScenariosByInbound<T extends RuntimeModeScenario>(
  scenarios: readonly T[],
  priority: readonly RuntimeModeScenario["inbound"][],
): readonly T[] {
  const rank = new Map(priority.map((value, index) => [value, index]));
  return [...scenarios].sort(
    (left, right) =>
      (rank.get(left.inbound) ?? priority.length) - (rank.get(right.inbound) ?? priority.length),
  );
}
