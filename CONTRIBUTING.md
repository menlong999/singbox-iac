# Contributing

## English

Thanks for contributing to `Singbox IaC`.

Recommended workflow:

1. Open or discuss an issue first for non-trivial changes.
2. Keep changes aligned with the OpenSpec flow in [`openspec/`](./openspec/).
3. Prefer small, reviewable pull requests.
4. Add or update tests for behavior changes.
5. Run the validation commands before opening a PR:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

For packaging and distribution changes, also run:

```bash
npm run release:check
```

## 中文

感谢参与 `Singbox IaC` 的开发。

建议流程：

1. 非小改动先提 issue 或先沟通设计。
2. 尽量遵循 [`openspec/`](./openspec/) 中已有的规格和 change 结构。
3. 优先提交小而清晰、容易 review 的 PR。
4. 如果行为发生变化，请补测试或更新测试。
5. 提交 PR 前至少执行：

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

如果改动涉及打包、安装或发布，还应执行：

```bash
npm run release:check
```

## Scope

Good contribution areas:

- new route verification scenarios
- more natural-language intent coverage
- more subscription compatibility fixtures
- more developer or video-site templates
- macOS operational improvements
