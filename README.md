# Singbox IaC

[![CI](https://github.com/menlong999/singbox-iac/actions/workflows/ci.yml/badge.svg)](https://github.com/menlong999/singbox-iac/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/%40singbox-iac%2Fcli)](https://www.npmjs.com/package/@singbox-iac/cli)
[![license](https://img.shields.io/npm/l/%40singbox-iac%2Fcli)](https://github.com/menlong999/singbox-iac/blob/main/LICENSE)

Policy-first subscription compiler for `sing-box` on macOS.

面向 macOS 无头场景的 `sing-box` 订阅编译器。它把机场订阅当作节点输入，而不是最终配置本身，再结合固定路由策略、规则集和用户意图，生成可验证、可发布、可定时更新的 `sing-box` 配置。

## Overview / 项目简介

**English**

`Singbox IaC` is a CLI for developers who have outgrown GUI proxy clients and fragile template patching. It fetches a provider subscription, parses share links, compiles a deterministic `sing-box` config, validates the result, and can publish or schedule updates safely.

This project is built around a simple idea:

- subscriptions provide nodes
- policy defines routing
- generated configs must be verifiable
- process-aware routing should be a first-class workflow

**中文**

`Singbox IaC` 是一个面向开发者的代理基础设施 CLI。它解决的不是“导入订阅”这个单点问题，而是把订阅、规则、验证、发布和定时更新串成一条可控链路。

核心理念：

- 订阅只负责提供节点
- 路由策略由你掌控
- 配置生成后必须可验证
- 进程级分流和站点级分流都应该是一等能力

## Why / 为什么要做这个项目

很多用户在 macOS 上会使用 Clash Verge 一类 GUI 客户端，再配合机场订阅、全局 JS merge 脚本、Proxifier、规则分组做复杂定制。这个方案能用，但常见问题也很明显：

- 订阅分组粗糙，无法直接表达开发者真实需求
- GUI 内部合并和脚本 patch 过于黑盒
- 规则优先级容易被上游订阅变化破坏
- 某些 AI IDE 或桌面应用不走系统代理，必须依赖 Proxifier
- 开启 TUN 或全局代理后，本地其他访问可能明显变慢
- GUI 壳本身资源占用高，不适合长期无头运行

`Singbox IaC` 的目标就是把这些需求收敛成：

`subscription -> parse -> compile -> verify -> apply -> schedule`

## What It Does / 项目能做什么

- Fetch Base64 Trojan subscriptions and parse share links
- Compile deterministic `sing-box` configs with fixed route priority
- Provide separate listeners for regular proxy traffic and Proxifier traffic
- Support route verification with real `sing-box` and headless Chrome
- Generate rules from a simple intent sentence instead of forcing users to edit raw JSON
- Sync local `.srs` rule sets automatically
- Publish validated configs to `~/.config/sing-box/config.json`
- Install `launchd` schedules for recurring updates on macOS

对应中文能力：

- 拉取和解析常见 Trojan 订阅
- 编译固定优先级的 `sing-box` 路由配置
- 提供普通代理入口和 Proxifier 专用入口
- 用真实 `sing-box` 和无头 Chrome 做闭环验证
- 支持“一句话规则生成”，不要求用户理解 DSL 或手写 JSON
- 自动同步本地 `.srs` 规则集
- 发布配置到 `~/.config/sing-box/config.json`
- 通过 `launchd` 做定时更新

## Typical Developer Scenarios / 典型开发者场景

- `Antigravity`、Cursor、IDE 或其他不走系统代理的应用，通过 Proxifier 进入独立入口，再固定走美国出口
- `GitHub`、Google 服务、常见开发类网站走香港或新加坡
- `Gemini`、`OpenAI`、`Anthropic` 等 AI 服务走不同出口组
- `Google Stitch` 这类必须走特定国家出口的站点走专门分组
- 中国大陆域名和 IP 直连，避免无意义地走代理
- 视频站点如 `Netflix`、`YouTube`、`Amazon Prime`、`Apple TV` 按地区分流

## Install / 安装

Install `sing-box` first so the `sing-box` binary is available in your `PATH`.

先安装 `sing-box`，确保终端里可以直接执行 `sing-box`。

官方文档：

- [sing-box package manager docs](https://sing-box.sagernet.org/installation/package-manager/)

Then install this CLI:

```bash
npm install -g @singbox-iac/cli
singbox-iac --help
```

## Quick Start / 快速开始

### One-step onboarding / 一步完成初始化

```bash
singbox-iac setup \
  --subscription-url '你的机场订阅地址' \
  --prompt 'GitHub 这类开发类走香港，Antigravity 进程级走美国，Gemini 走新加坡，每30分钟自动更新'
```

What `setup` does:

- creates `~/.config/singbox-iac/builder.config.yaml`
- creates `~/.config/singbox-iac/rules/custom.rules.yaml`
- downloads the default local `.srs` rule sets
- turns one sentence into routing rules
- builds `~/.config/singbox-iac/generated/config.staging.json`

`setup` 会自动：

- 生成 `~/.config/singbox-iac/builder.config.yaml`
- 生成 `~/.config/singbox-iac/rules/custom.rules.yaml`
- 下载默认本地 `.srs` 规则集
- 把一句自然语言转成路由规则
- 构建 `~/.config/singbox-iac/generated/config.staging.json`

### Run for manual testing / 前台运行测试

```bash
singbox-iac run
```

默认监听端口：

- `127.0.0.1:39097` for regular browser/system proxy traffic
- `127.0.0.1:39091` for Proxifier process traffic

### Day-to-day usage / 日常使用

```bash
singbox-iac update --reload
```

这条命令会执行：

- fetch
- build
- verify
- apply
- optional reload

### Background schedule / 定时更新

```bash
singbox-iac schedule install
```

## Natural-Language Authoring / 自然语言规则编写

You do not need to learn raw `sing-box` JSON for common cases.

对于大多数场景，不需要手写 `sing-box` JSON，也不需要理解 DSL。

Examples:

```bash
singbox-iac author \
  --prompt 'GitHub 这类开发类都走香港出口，Antigravity 进程级都走独立入口并路由到美国节点，Gemini 都出口到新加坡'
```

```bash
singbox-iac author \
  --prompt 'Google 服务和 GitHub 走香港，Amazon Prime 和 Apple TV 走新加坡，国内直连，每45分钟自动更新' \
  --update
```

The authoring layer supports:

- deterministic local intent parsing by default
- optional local AI CLI integration
- preview before writing
- closed-loop update after rule generation

## Commands / 命令

```bash
singbox-iac init
singbox-iac setup
singbox-iac author
singbox-iac build
singbox-iac check
singbox-iac apply
singbox-iac run
singbox-iac verify
singbox-iac update
singbox-iac doctor
singbox-iac schedule install
singbox-iac schedule remove
singbox-iac templates list
```

## How It Works With sing-box / 它和 sing-box 是怎么配合的

This project does not replace the `sing-box` core binary.

它不会替代 `sing-box` 内核本身，而是负责生成和维护 `sing-box` 配置。

Typical flow:

1. fetch subscription
2. parse nodes
3. compile staging config
4. validate the config
5. verify critical routes
6. publish to the live config path
7. reload or restart `sing-box`

默认 live 配置路径：

```text
~/.config/sing-box/config.json
```

## Project Structure / 项目结构

- [docs/rules-dsl.md](./docs/rules-dsl.md)
- [docs/rule-templates.md](./docs/rule-templates.md)
- [docs/natural-language-authoring.md](./docs/natural-language-authoring.md)
- [docs/runtime-on-macos.md](./docs/runtime-on-macos.md)
- [openspec/project.md](./openspec/project.md)

## Status / 当前状态

The project is already usable as an MVP-plus CLI:

- real subscription ingestion works
- real route verification works
- real publish flow works
- natural-language authoring works
- npm package is published
- macOS `launchd` integration is available

当前仍然最值得继续推进的方向：

- support more protocols beyond Trojan
- richer natural-language coverage
- more provider presets for local AI CLIs

## Contributing / 参与贡献

Contributions are welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md).

欢迎提交 issue、PR 和场景反馈，尤其是：

- 新的开发者场景模板
- 不同机场订阅的兼容性样本
- 自然语言规则表达改进
- 新的验证用例

## License / 许可证

[MIT](./LICENSE)
