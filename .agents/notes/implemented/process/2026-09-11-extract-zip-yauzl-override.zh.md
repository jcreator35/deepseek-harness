# Agent Note: 为 Node 24.16 streams 回归覆盖 extract-zip 的 yauzl

Status: implemented

[English](2026-09-11-extract-zip-yauzl-override.md) | 中文

## 问题

`pnpm run prepare:runtime`（每次 `package:desktop:win:x64` 的 Windows 环节）以退出码 13 中止——即 Node 的 "unsettled top-level await"——且没有任何错误输出。`apps/desktop/scripts/prepare-runtime.ts` 的 `prepareNode` 步骤通过 `extract-zip@2.0.1` 解压下载的 Node.js 归档，其依赖 `yauzl@2.10.0` 经由 `fd-slicer` 手写的 `Readable` 读取条目。Node 24.16 修改了 stream 内部实现，使 `pause()`/`resume()` 在流被标记 destroyed 后成为空操作（nodejs/node#62557，追踪于 nodejs/node#63487）：fd-slicer 在到达读取终点时先设置 `destroyed = true` 再 `push(null)`，于是超过单个 64 KiB chunk 的条目永远无法通过 `zlib.createInflateRaw` 冲刷尾部，`pipeline` 永不 settle，进程静默清空退出。在受影响的主机（Node v24.16.0）上，所有大于 65536 字节的条目——从 Node 发行包的 `LICENSE` 开始——都让解压挂死；VS Code、Playwright、Cypress 与 Electron Forge 报告过同样的静默挂起。`extract-zip` 本身未发布修复；`yauzl` 3.3.1 以规范的 `_destroy` 契约重写了内置 fd-slicer。

## 决策

`pnpm-workspace.yaml` 新增作用域覆盖 `extract-zip>yauzl: ^3.4.0`。覆盖只作用于 extract-zip 的依赖边，electron-builder 的 `@electron-internal/extract-zip` 及其他不经过 yauzl 的路径不受影响；yauzl 3 保留了 extract-zip 使用的回调式 API 面（`open`、`openReadStream`、`readEntry`、entry/close/error 事件），因此无需改动源码。`apps/desktop/tests/runtime-extraction-dependencies.spec.ts` 解析 extract-zip 的 yauzl 并要求主版本为 3，这样删除覆盖会让一个快速单元测试失败，而不是让受影响主机上的打包运行挂死。

## 已考虑的替代方案

**把构建主机固定在 Node 24.15。** 不采用：仓库支持的范围是 `^22.19 || >=24`，贡献者与 CI 主机自然会落在受影响版本上；主机侧固定无法在下次 Node 升级后幸存，而且只是隐藏而非修复缺陷。

**通过 `patchedDependencies` 给 fd-slicer 打补丁。** 不采用：这会复制一份仓库需要永久维护的上游修复，而 yauzl 3.x 已经携带该修复且与 extract-zip 的 API 用法兼容。

**用其他 zip 库替换 extract-zip。** 推迟：extract-zip 的 API 恰好贴合 `prepareNode`，且死锁位于传递依赖 yauzl 而非 extract-zip 自身的条目处理。

## 后果

`prepare:runtime` 在 Node 24.16+ 上完整通过（端到端验证：全部 1,942 个归档条目解出、`node.exe` 通过可执行验证、`versions.json` 写入成功）。lockfile 在该依赖边上新增 yauzl 3.4.0，移除 fd-slicer、pend 与 buffer-crc32。`apps/desktop` 的 runtime 准备仍是 extract-zip 唯一的 Windows 专属消费者；macOS 与 Linux 目标继续走 `tar` 包，不受影响。Node 22 或 ≤24.15 的主机从未受影响，现在也运行在修复后的依赖图上。
