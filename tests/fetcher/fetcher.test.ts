import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchSubscription } from "../../src/modules/fetcher/index.js";

describe("fetchSubscription", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("retries retryable network errors and returns the subscription payload", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(
        Object.assign(new Error("fetch failed"), {
          cause: { code: "ECONNRESET" },
        }),
      )
      .mockResolvedValueOnce(
        new Response("dHJvamFuOi8vZXhhbXBsZQ==", {
          status: 200,
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchSubscription({
        url: "https://example.com/subscription",
        retryAttempts: 2,
      }),
    ).resolves.toBe("dHJvamFuOi8vZXhhbXBsZQ==");

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries transient HTTP responses before succeeding", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("upstream busy", { status: 503, statusText: "Busy" }))
      .mockResolvedValueOnce(new Response("trojan://password@example.com:443?sni=example.com"));

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchSubscription({
        url: "https://example.com/subscription",
        retryAttempts: 2,
      }),
    ).resolves.toContain("trojan://");

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("continues trying later user agents when an earlier response is not a line-based subscription", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('{"outbounds":[]}', { status: 200 }))
      .mockResolvedValueOnce(new Response("trojan://password@example.com:443?sni=example.com"));

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchSubscription({
        url: "https://example.com/subscription",
        retryAttempts: 1,
      }),
    ).resolves.toContain("trojan://");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      headers: expect.objectContaining({
        "user-agent": "subconverter/1.0",
      }),
    });
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      headers: expect.objectContaining({
        "user-agent": "curl/8.7.1",
      }),
    });
  });
});
