# Proxifier Onboarding

`Singbox IaC` treats process-aware routing as a first-class workflow. If an AI IDE, language server, or desktop app does not respect the normal system proxy path, send that process to `in-proxifier` instead of forcing all traffic through a global mode.

## Generated Helper Directory

The CLI can generate a helper directory under:

```text
~/.config/singbox-iac/proxifier/
```

Typical files:

- `README.md`
- `proxy-endpoint.txt`
- `custom-processes.txt`
- `bundles/antigravity.txt`
- `bundles/cursor.txt`
- `bundles/developer-ai-cli.txt`
- `bundle-specs/antigravity.yaml`
- `bundle-specs/cursor.yaml`
- `all-processes.txt`

## Fast Path

If your first-run prompt mentions `Proxifier`, `进程级`, `Antigravity`, `Cursor`, or similar process-aware intent, both `go` and `setup --ready` will generate the helper directory automatically.

```bash
singbox-iac go \
  '<url>' \
  'Antigravity 进程级走美国，GitHub 走香港，国内直连'
```

## Manual Regeneration

To regenerate only the Proxifier helper files:

```bash
singbox-iac proxifier scaffold --prompt 'Antigravity 进程级走美国，Cursor 也走独立入口'
```

To see the supported bundle presets:

```bash
singbox-iac proxifier bundles
```

To inspect one declarative bundle:

```bash
singbox-iac proxifier bundles show antigravity
```

To render one bundle spec as YAML:

```bash
singbox-iac proxifier bundles render antigravity
```

## Endpoint

By default the process-aware listener is:

```text
SOCKS5 127.0.0.1:39091
```

Always verify the generated `proxy-endpoint.txt`, because the actual host and port are read from your current builder config.

## Practical Flow

1. Generate or refresh the helper directory.
2. Open Proxifier and create a SOCKS5 proxy server using the generated endpoint.
3. Import one or more bundle files into your Proxifier rules.
4. Add project-specific process names to `custom-processes.txt`.
5. Keep browsers and normal system traffic on the regular mixed listener.

This keeps AI IDE traffic pinned to a dedicated ingress and egress path without forcing unrelated browsing into a heavy global mode.
