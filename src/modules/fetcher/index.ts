export interface FetchSubscriptionInput {
  readonly url: string;
  readonly retryAttempts?: number;
}

export async function fetchSubscription(input: FetchSubscriptionInput): Promise<string> {
  const userAgents = ["subconverter/1.0", "curl/8.7.1", "singbox-iac/0.1"];
  const retryAttempts = Math.max(1, input.retryAttempts ?? 3);
  let fallbackContent = "";
  let lastError: Error | undefined;

  for (const userAgent of userAgents) {
    for (let attempt = 1; attempt <= retryAttempts; attempt += 1) {
      try {
        const response = await fetch(input.url, {
          headers: {
            accept: "text/plain,*/*",
            "user-agent": userAgent,
          },
        });

        if (!response.ok) {
          const statusError = new Error(
            `Failed to fetch subscription: ${response.status} ${response.statusText}`,
          );

          if (shouldRetryStatus(response.status) && attempt < retryAttempts) {
            lastError = statusError;
            await delay(getRetryDelayMs(attempt));
            continue;
          }

          throw statusError;
        }

        const content = await response.text();
        if (content.trim().length === 0) {
          break;
        }

        if (looksLikeSubscriptionPayload(content)) {
          return content;
        }

        if (fallbackContent.length === 0) {
          fallbackContent = content;
        }
        break;
      } catch (error) {
        const normalizedError = normalizeFetchError(error);
        lastError = normalizedError;
        if (attempt >= retryAttempts || !isRetryableFetchError(normalizedError)) {
          break;
        }
        await delay(getRetryDelayMs(attempt));
      }
    }
  }

  if (fallbackContent.length > 0) {
    return fallbackContent;
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error("Fetched subscription is empty.");
}

function looksLikeSubscriptionPayload(content: string): boolean {
  const trimmed = content.trim();
  if (trimmed.includes("://")) {
    return true;
  }

  const sanitized = trimmed.replace(/\s+/gu, "").replace(/-/gu, "+").replace(/_/gu, "/");
  const paddingLength = (4 - (sanitized.length % 4)) % 4;
  const decoded = Buffer.from(`${sanitized}${"=".repeat(paddingLength)}`, "base64")
    .toString("utf8")
    .trim();

  return decoded.includes("://");
}

function shouldRetryStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function getRetryDelayMs(attempt: number): number {
  return 250 * attempt;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeFetchError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function isRetryableFetchError(error: Error): boolean {
  const cause = error.cause;
  const code =
    typeof cause === "object" && cause !== null && "code" in cause ? String(cause.code) : undefined;

  return (
    code === "ECONNRESET" ||
    code === "ETIMEDOUT" ||
    code === "ECONNREFUSED" ||
    code === "EHOSTUNREACH" ||
    code === "ENETUNREACH" ||
    error.name === "AbortError" ||
    /fetch failed/i.test(error.message)
  );
}
