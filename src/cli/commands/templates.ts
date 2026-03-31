import type { Command } from "commander";

import { getRuleTemplate, listRuleTemplates } from "../../modules/rule-templates/index.js";

export function registerTemplatesCommand(program: Command): void {
  const templates = program.command("templates").description("Browse built-in rule templates.");

  templates
    .command("list")
    .description("List available templates.")
    .action(() => {
      process.stdout.write(
        `${listRuleTemplates()
          .map((template) => `${template.id}: ${template.summary}`)
          .join("\n")}\n`,
      );
    });

  templates
    .command("show")
    .description("Show one template in YAML-like form.")
    .argument("<id>", "template identifier")
    .action((id: string) => {
      const template = getRuleTemplate(id);
      if (!template) {
        throw new Error(`Unknown template "${id}".`);
      }

      const lines = [
        `id: ${template.id}`,
        `title: ${template.title}`,
        `summary: ${template.summary}`,
        `tags: ${template.tags.join(", ")}`,
        "beforeBuiltins:",
        ...template.beforeBuiltins.map((rule) => `  - ${JSON.stringify(rule)}`),
        "afterBuiltins:",
        ...template.afterBuiltins.map((rule) => `  - ${JSON.stringify(rule)}`),
      ];
      process.stdout.write(`${lines.join("\n")}\n`);
    });
}
