# Design

## Runtime Profiles

Add an explicit desktop runtime profile:

```ts
type DesktopRuntimeProfile =
  | {
      kind: "system-proxy";
      setSystemProxy: true;
    }
  | {
      kind: "tun";
      autoRoute: true;
      strictRoute: boolean;
      interfaceName?: string;
    };
```

This profile is internal configuration derived from runtime mode and user intent. It determines how
the compiler emits desktop-oriented inbounds and runtime metadata.

## sing-box Config Integration

### System Proxy Profile

- continue to use `mixed` inbound
- emit `set_system_proxy: true`
- rely on `sing-box` startup and shutdown to set and clean system proxy state

### TUN Profile

- emit a `tun` inbound for macOS desktop mode
- enable `auto_route`
- start with safe defaults for `strict_route`
- keep existing policy compiler behavior for route rules and DNS planning

The intent is convenience parity with GUI clients, not a custom packet tunnel implementation.

## Runtime Lifecycle

Add lightweight runtime management commands:

- `singbox-iac start`
- `singbox-iac stop`
- `singbox-iac restart`

These commands manage a dedicated per-user runtime LaunchAgent, for example
`org.singbox-iac.runtime`, distinct from the update scheduler LaunchAgent.

The runtime LaunchAgent should:

- run `sing-box run -c <live-config>`
- inherit persisted `SING_BOX_BIN`
- stop cleanly so system proxy or TUN resources are released by `sing-box`

## Safety

- runtime commands must refuse to start if no valid live config is present
- TUN mode must surface privilege and platform warnings clearly during onboarding and status checks
- update scheduling remains independent of runtime start/stop

## CLI UX

The first implementation should keep user-facing choices minimal:

- `go` and `setup` can infer whether desktop convenience is desired from runtime mode and prompt
- `status` should show whether the runtime is stopped, running in system-proxy mode, or running in
  TUN mode
- advanced users may later get explicit flags to choose desktop runtime profile during onboarding
