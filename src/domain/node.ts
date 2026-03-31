export type SupportedProtocol = "trojan";

export interface NormalizedNode {
  readonly protocol: SupportedProtocol;
  readonly tag: string;
  readonly server: string;
  readonly serverPort: number;
  readonly password: string;
  readonly sni?: string;
  readonly insecure?: boolean;
  readonly regionHint?: string;
}
