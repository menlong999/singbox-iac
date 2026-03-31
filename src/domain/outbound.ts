export interface Outbound {
  readonly type: string;
  readonly tag: string;
}

export interface TrojanOutbound extends Outbound {
  readonly type: "trojan";
  readonly server: string;
  readonly server_port: number;
  readonly password: string;
  readonly tls: {
    readonly enabled: true;
    readonly server_name?: string;
    readonly insecure?: boolean;
  };
}
