import { z } from "zod";

const listenerSchema = z.object({
  enabled: z.boolean(),
  listen: z.string(),
  port: z.number().int().positive(),
});

const ruleSetSchema = z.object({
  tag: z.string().min(1),
  format: z.literal("binary"),
  type: z.literal("local"),
  path: z.string().min(1),
});

const groupSchema = z.object({
  type: z.enum(["selector", "urltest"]),
  includes: z.array(z.string().min(1)).min(1),
  defaultTarget: z.string().min(1).optional(),
  defaultNodePattern: z.string().min(1).optional(),
});

const verificationScenarioSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  url: z.string().url(),
  inbound: z.enum(["in-mixed", "in-proxifier"]),
  expectedOutbound: z.string().min(1),
});

const authoringSchema = z
  .object({
    provider: z.enum(["deterministic", "auto", "claude", "exec"]).default("deterministic"),
    timeoutMs: z.number().int().positive().default(4000),
    exec: z
      .object({
        command: z.string().min(1),
        args: z.array(z.string()).default([]),
      })
      .optional(),
  })
  .default({
    provider: "deterministic",
    timeoutMs: 4000,
  });

export const builderConfigSchema = z.object({
  version: z.literal(1),
  subscription: z.object({
    url: z.string().url(),
    format: z.literal("base64-lines"),
    protocols: z.array(z.literal("trojan")).min(1),
  }),
  output: z.object({
    stagingPath: z.string().min(1),
    livePath: z.string().min(1),
    backupPath: z.string().min(1),
  }),
  runtime: z.object({
    checkCommand: z.string().min(1),
    reload: z.object({
      kind: z.enum(["signal", "command"]),
      processName: z.string().min(1).optional(),
      signal: z.string().min(1).optional(),
      command: z.string().min(1).optional(),
    }),
  }),
  listeners: z.object({
    mixed: listenerSchema,
    proxifier: listenerSchema,
  }),
  ruleSets: z.array(ruleSetSchema),
  groups: z.object({
    processProxy: groupSchema,
    aiOut: groupSchema,
    global: groupSchema,
    devCommonOut: groupSchema.default({
      type: "selector",
      includes: ["US", "SG", "JP", "HK"],
    }),
    stitchOut: groupSchema.default({
      type: "selector",
      includes: ["US", "SG", "JP"],
    }),
  }),
  rules: z.object({
    userRulesFile: z.string().min(1),
  }),
  verification: z.object({
    scenarios: z.array(verificationScenarioSchema).min(1),
  }),
  schedule: z.object({
    enabled: z.boolean(),
    intervalMinutes: z.number().int().positive(),
  }),
  authoring: authoringSchema,
});

export type BuilderConfig = z.infer<typeof builderConfigSchema>;
