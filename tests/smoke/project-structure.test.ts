import { describe, expect, it } from "vitest";

import { builderConfigSchema } from "../../src/config/schema.js";

describe("phase 0 baseline", () => {
  it("exposes a builder config schema", () => {
    expect(builderConfigSchema).toBeDefined();
  });
});
