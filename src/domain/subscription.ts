export type SubscriptionFormat = "base64-lines";

export interface SubscriptionSource {
  readonly url: string;
  readonly format: SubscriptionFormat;
  readonly protocols: readonly string[];
}
