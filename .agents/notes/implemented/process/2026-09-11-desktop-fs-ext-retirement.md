# Agent Note: Retire the stale fs-ext checks from Desktop packaging

Status: implemented

English | [中文](2026-09-11-desktop-fs-ext-retirement.zh.md)

## Problem

`pnpm run package:desktop:win:x64` aborted at `prepare:dsh` when the runtime payload smoke failed with `Cannot find module 'fs-ext'`. The [prebuilt flock change](d927cbff99) removed `fs-ext` from `@deepseek-ai/dsh-session-persistence-jsonl` on 2026-09-07 and replaced it with `@deepseek-ai/node-addon-system`, so fs-ext no longer resolves inside the packaged production closure (confirmed by resolving the package set's lockfile: fs-ext is absent everywhere). Four Desktop references were not updated: the runtime payload smoke fixture demanded `requireRuntime('fs-ext')` (added two days after the removal, born stale), the runtime file policy carried two fs-ext artifact-filter rules, the generated runtime project's `allowBuilds` kept `fs-ext: true`, and the policy spec pinned the obsolete filter behavior. Every Windows packaging run since then failed at the same smoke.

## Decision

Remove all four stale references so Desktop's fs-ext surface matches the closure that actually ships: `checkFsExt` disappears from `runtime-payload-smoke.mjs` (the remaining checks — koffi, sharp, turndown/domino, node-pty — keep covering the filtered native and HTML payload), the two `desktopRuntimeFileExclusion` rules for fs-ext build artifacts disappear, the generated `pnpm-workspace.yaml` no longer allowlists fs-ext builds, and the policy spec now asserts that an `fs-ext/...` path has no special-case exclusion at all. The retired native flock/lease path itself is unaffected: it runs through the prebuilt `@deepseek-ai/node-addon-system` packages already inside the package set.

## Alternatives considered

**Re-add fs-ext to the closure so the smoke passes.** Rejected: it reintroduces a node-gyp-built dependency that the prebuilt flock change deliberately deleted, contradicting the shipped decision and re-lengthening the Windows install.

**Replace the check with a node-addon-system flock probe.** Deferred: the smoke still exercises four packaged native modules under the bundled Node; a flock probe needs its own API contract work and belongs with the native package's own coverage, not with unblocking packaging.

**Keep the inert policy rules and allowBuilds entry.** Rejected: rules for a package that can no longer appear in the closure are dead configuration that future readers must re-investigate.

## Consequences

The `prepare:dsh` payload smoke, the file-policy copy filter, and the generated runtime projects agree on one package inventory. Removing the fs-ext allowBuilds entry changes nothing for real installs because the package is not in the resolved lockfile; the smoke's summary line drops the `fsExt` field. Packaging hosts on any Node version stop failing at this step.
