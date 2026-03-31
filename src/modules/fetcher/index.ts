export interface FetchSubscriptionInput {
  readonly url: string;
}

export async function fetchSubscription(input: FetchSubscriptionInput): Promise<string> {
  const userAgents = ["subconverter/1.0", "curl/8.7.1", "singbox-iac/0.1.0"];
  let fallbackContent = "";

  for (const userAgent of userAgents) {
    const response = await fetch(input.url, {
      headers: {
        accept: "text/plain,*/*",
        "user-agent": userAgent,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch subscription: ${response.status} ${response.statusText}`);
    }

    const content = await response.text();
    if (content.trim().length === 0) {
      continue;
    }

    if (looksLikeSubscriptionPayload(content)) {
      return content;
    }

    if (fallbackContent.length === 0) {
      fallbackContent = content;
    }
  }

  if (fallbackContent.length > 0) {
    return fallbackContent;
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
