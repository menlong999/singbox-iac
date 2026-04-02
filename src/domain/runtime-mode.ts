export type RuntimeMode = "browser-proxy" | "process-proxy" | "headless-daemon";

export interface RuntimeModeDefaults {
  readonly preferredListeners: readonly ("mixed" | "proxifier")[];
  readonly dnsMode: "real-ip" | "fake-ip";
  readonly openVisibleBrowserByDefault: boolean;
  readonly visibleBrowserScenarioLimit: number;
  readonly scheduleRecommended: boolean;
}
