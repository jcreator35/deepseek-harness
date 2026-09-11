# Agent Note: Desktop 启动器采用无 shell 的 pnpm 再入

Status: implemented

[English](2026-09-11-desktop-pnpm-reentry.md) | 中文

## 问题

Desktop 打包与开发启动器在再入 pnpm 时不分文件形式，一律以 `node <npm_execpath>` 启动子进程。只有通过 npm 或 Corepack 安装的 pnpm 才让 `npm_execpath` 指向 JavaScript 入口；官方独立安装器暴露的是 `@pnpm/exe` 的原生 `pnpm.exe`。在装有独立安装版 pnpm 11.7.0 的 Windows x64 主机上，`pnpm run package:desktop:win:x64` 在第一个子步骤(`build:official`)即以 `ERR_UNKNOWN_FILE_EXTENSION ".exe"` 中止，因为 Node 无法把 PE 可执行文件当模块加载。`dev:desktop` 与 `start:desktop` 的 `runPackageScript` 带有同一缺陷。[pnpm-over-yarn 决策](2026-06-16-pnpm-over-yarn.zh.md)早已通过 `scripts/pnpm-invocation.ts` 在全仓 settles 该映射；Desktop 脚本早于该机制，从未采纳。

## 决策

`apps/desktop/scripts/package-target.ts` 与 `apps/desktop/scripts/dev.ts` 改用既有的 `pnpmInvocation` 辅助函数解析子 pnpm 命令:`.js`、`.cjs`、`.mjs` 入口在当前 Node 可执行文件下运行，原生及 shebang 可执行文件(含 `pnpm.exe`)直接运行，全程无 shell。Desktop 包已有导入仓库根 scripts 的先例(`prepare-package-set.ts` 引用 `scripts/release/`),因此该跨面导入不引入新的布局。`npm_execpath` 缺失的诊断现在来自共享辅助函数，而不是各启动器的副本。

## 已考虑的替代方案

**让每个 Desktop 启动器各自识别 `.exe` 形式。** 不采用:这会复制仓库已在 `scripts/pnpm-invocation.ts` 拥有并测试的映射，且两个启动器会再次漂移。

**要求 Desktop 发布必须使用 npm 或 Corepack 安装的 pnpm。** 不采用:独立安装器是受支持的 pnpm 分发方式;原生 Windows pull-request 作业配置 `@pnpm/exe` 正是为了检验 PE 入口。

**通过 shell 进行再入。** 因 pnpm-over-yarn note 记录的理由不采用:引号、元字符展开与信号行为会为每条子命令改变。

## 后果

`package:desktop:*`、`prepare:desktop`、`dev:desktop`、`start:desktop` 在同一主机上对两种 pnpm 安装形式均可工作。映射行为继续由 `scripts/pnpm-invocation.spec.ts` 覆盖(JavaScript 入口、原生可执行文件、含空格与非 ASCII 段的路径);Desktop 规格继续覆盖目标解析与环境清洗。未设置 `npm_execpath` 的主机现在以共享的 `pnpm invocation: npm_execpath is unavailable` 诊断失败。
