import type { Command } from "commander";

import {
  listBuiltInPreferredSiteRuleSetTags,
  listSiteBundles,
} from "../../modules/bundle-registry/index.js";
import {
  defaultOfficialRuleSetCatalogCachePath,
  loadOfficialRuleSetCatalog,
} from "../../modules/rule-set-catalog/index.js";
import { findDefaultConfigPath, resolveBuilderConfig } from "../command-helpers.js";

export function registerRuleSetsCommand(program: Command): void {
  const root = program
    .command("rulesets")
    .description("Inspect configured and official sing-box rule-set tags.");

  root
    .command("list")
    .description("Show configured rule sets and refreshable official upstream tags.")
    .option("-c, --config <path>", "path to builder config YAML")
    .option("--refresh", "refresh the official upstream catalog before printing")
    .option("--filter <text>", "only show official tags containing this text")
    .option("--kind <kind>", "filter official tags by kind: geosite, geoip, or all", "all")
    .option("--all", "print all matching official tags in human-readable output")
    .option("--json", "print the full machine-readable report")
    .action(async (options: RuleSetsListOptions) => {
      const configPath = options.config ?? (await findDefaultConfigPath());
      const config = configPath ? await resolveBuilderConfig({ config: configPath }) : undefined;
      const catalog = await loadOfficialRuleSetCatalog({
        refresh: options.refresh === true,
        cachePath: defaultOfficialRuleSetCatalogCachePath(),
      });
      const configuredTags = [...(config?.ruleSets.map((ruleSet) => ruleSet.tag) ?? [])].sort();
      const configuredTagSet = new Set(configuredTags);
      const filter = options.filter?.toLowerCase().trim();
      const selectedKinds = normalizeKinds(options.kind);
      const geositeTags = filterOfficialTags(
        catalog.geositeTags,
        selectedKinds.has("geosite"),
        filter,
      );
      const geoipTags = filterOfficialTags(catalog.geoipTags, selectedKinds.has("geoip"), filter);
      const builtInBundleCoverage = listSiteBundles()
        .map((bundle) => {
          const preferredRuleSetTags = [...(bundle.preferredRuleSetTags ?? [])];
          return {
            id: bundle.id,
            name: bundle.name,
            preferredRuleSetTags,
            activeRuleSetTags: preferredRuleSetTags.filter((tag) => configuredTagSet.has(tag)),
            usingFallback: preferredRuleSetTags.every((tag) => !configuredTagSet.has(tag)),
          };
        })
        .filter(
          (bundle) =>
            bundle.preferredRuleSetTags.length > 0 ||
            (filter
              ? bundle.id.includes(filter) || bundle.name.toLowerCase().includes(filter)
              : true),
        );

      if (options.json === true) {
        process.stdout.write(
          `${JSON.stringify(
            {
              configPath: configPath ?? null,
              configuredTags,
              officialCatalog: {
                cachePath: catalog.cachePath,
                source: catalog.source,
                refreshedAt: catalog.refreshedAt,
                geositeRef: catalog.geositeRef,
                geoipRef: catalog.geoipRef,
                geositeTags,
                geoipTags,
              },
              builtInSiteBundleCoverage: builtInBundleCoverage,
              builtInPreferredRuleSetTags: listBuiltInPreferredSiteRuleSetTags(),
            },
            null,
            2,
          )}\n`,
        );
        return;
      }

      const lines = [
        "Rule-set inventory: configured tags plus official upstream geosite/geoip catalog.",
        "",
        "Context",
        `- builder-config: ${configPath ?? "(none)"}`,
        `- cache: ${catalog.cachePath}`,
        `- catalog-source: ${catalog.source}`,
        `- refreshed-at: ${catalog.refreshedAt}`,
        `- upstream-geosite-ref: ${catalog.geositeRef}`,
        `- upstream-geoip-ref: ${catalog.geoipRef}`,
        "",
        "Configured",
        `- count: ${configuredTags.length}`,
        `- tags: ${configuredTags.length > 0 ? configuredTags.join(", ") : "(none)"}`,
        "",
        "Built-In Site Bundle Coverage",
      ];

      if (builtInBundleCoverage.length === 0) {
        lines.push("- bundles: (none)");
      } else {
        for (const bundle of builtInBundleCoverage) {
          lines.push(
            `- ${bundle.name}: preferred=${bundle.preferredRuleSetTags.join(", ")}; active=${
              bundle.activeRuleSetTags.length > 0 ? bundle.activeRuleSetTags.join(", ") : "(none)"
            }; mode=${bundle.usingFallback ? "fallback" : "rule-set"}`,
          );
        }
      }

      lines.push(
        "",
        "Official Catalog",
        `- geosite-count: ${geositeTags.length}`,
        `- geoip-count: ${geoipTags.length}`,
      );

      if (filter) {
        lines.push(`- filter: ${filter}`);
      }

      if (options.all === true || filter) {
        if (geositeTags.length > 0) {
          lines.push(`- geosite-tags: ${geositeTags.join(", ")}`);
        }
        if (geoipTags.length > 0) {
          lines.push(`- geoip-tags: ${geoipTags.join(", ")}`);
        }
      } else {
        lines.push(
          "- official-tags: use --all or --filter <text> to inspect individual upstream tags",
        );
      }

      process.stdout.write(`${lines.join("\n")}\n`);
    });
}

interface RuleSetsListOptions {
  readonly all?: boolean;
  readonly config?: string;
  readonly filter?: string;
  readonly json?: boolean;
  readonly kind: string;
  readonly refresh?: boolean;
}

function normalizeKinds(kind: string): ReadonlySet<"geosite" | "geoip"> {
  const normalized = kind.toLowerCase();
  if (normalized === "geosite") {
    return new Set(["geosite"]);
  }
  if (normalized === "geoip") {
    return new Set(["geoip"]);
  }
  return new Set(["geosite", "geoip"]);
}

function filterOfficialTags(
  tags: readonly string[],
  enabled: boolean,
  filter: string | undefined,
): readonly string[] {
  if (!enabled) {
    return [];
  }
  if (!filter) {
    return tags;
  }
  return tags.filter((tag) => tag.toLowerCase().includes(filter));
}
