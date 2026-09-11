# Agent Note: 从 Desktop 打包中退役过时的 fs-ext 检查

Status: implemented

[English](2026-09-11-desktop-fs-ext-retirement.md) | 中文

## 问题

`pnpm run package:desktop:win:x64` 在 `prepare:dsh` 处中止，runtime payload smoke 报 `Cannot find module 'fs-ext'`。[预构建 flock 变更](d927cbff99) 已于 2026-09-07 把 `fs-ext` 从 `@deepseek-ai/dsh-session-persistence-jsonl` 移除，替换为 `@deepseek-ai/node-addon-system`，因此 fs-ext 在打包后的生产闭包中已无法解析（通过解析 package set 的 lockfile 证实：fs-ext 全程缺席）。四处 Desktop 引用未同步更新：runtime payload smoke fixture 要求 `requireRuntime('fs-ext')`（在移除两天后才加入，生来即过时）、runtime file policy 携带两条 fs-ext 产物过滤规则、生成的 runtime 项目 `allowBuilds` 保留 `fs-ext: true`、policy spec 固化了过时的过滤行为。此后每次 Windows 打包都在同一处 smoke 失败。

## 决策

移除全部四处过时引用，使 Desktop 的 fs-ext 面与实际发布的闭包一致：`checkFsExt` 从 `runtime-payload-smoke.mjs` 消失（其余检查——koffi、sharp、turndown/domino、node-pty——继续覆盖过滤后的 native 与 HTML payload）、`desktopRuntimeFileExclusion` 的两条 fs-ext 构建产物规则消失、生成的 `pnpm-workspace.yaml` 不再允许 fs-ext 构建、policy spec 改为断言 `fs-ext/...` 路径完全没有特例排除。被退役的 native flock/lease 路径本身不受影响：它经由 package set 中已有的预构建 `@deepseek-ai/node-addon-system` 包运行。

## 已考虑的替代方案

**把 fs-ext 重新加回闭包让 smoke 通过。** 不采用：这会重新引入预构建 flock 变更刻意删除的 node-gyp 构建依赖，与已发布决策相悖，并再次拉长 Windows 安装。

**用 node-addon-system flock 探针替换该检查。** 推迟：smoke 仍在捆绑 Node 下检验四个打包的 native 模块；flock 探针需要自己的 API 契约工作，应归属 native 包自身的覆盖，而不是用来解除打包阻塞。

**保留惰性的 policy 规则与 allowBuilds 条目。** 不采用：为不可能再出现在闭包中的包保留规则属于死配置，未来的读者必须重新调查。

## 后果

`prepare:dsh` 的 payload smoke、file-policy 拷贝过滤与生成的 runtime 项目对同一份包清单达成一致。移除 fs-ext 的 allowBuilds 条目对真实安装没有影响，因为该包不在解析后的 lockfile 中；smoke 的汇总输出去掉 `fsExt` 字段。任何 Node 版本上的打包主机都不再在这一步失败。
