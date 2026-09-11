# Agent Note: Override extract-zip's yauzl for the Node 24.16 streams regression

Status: implemented

English | [中文](2026-09-11-extract-zip-yauzl-override.zh.md)

## Problem

`pnpm run prepare:runtime` (the Windows leg of every `package:desktop:win:x64` run) aborted with exit code 13 — Node's "unsettled top-level await" — with no error output. The `prepareNode` step in `apps/desktop/scripts/prepare-runtime.ts` extracts the downloaded Node.js zip through `extract-zip@2.0.1`, whose `yauzl@2.10.0` dependency reads entries through `fd-slicer`'s hand-rolled `Readable`. Node 24.16 changed stream internals so `pause()`/`resume()` are no-ops once a stream is marked destroyed (nodejs/node#62557, tracked as nodejs/node#63487): fd-slicer sets `destroyed = true` before `push(null)` at end-of-range, so entries larger than one 64 KiB chunk never flush their tail through `zlib.createInflateRaw`, `pipeline` never settles, and the process drains silently. On the affected host (Node v24.16.0), every entry above 65536 bytes — starting with the Node distribution's `LICENSE` — hung the extraction; VS Code, Playwright, Cypress, and Electron Forge reported the identical silent hang. `extract-zip` itself has not shipped a fix; `yauzl` 3.3.1 rewrote its vendored fd-slicer with the proper `_destroy` contract.

## Decision

`pnpm-workspace.yaml` adds the scoped override `extract-zip>yauzl: ^3.4.0`. The override is scoped to extract-zip's dependency edge so electron-builder's `@electron-internal/extract-zip` and every other yauzl-free path stay untouched; yauzl 3 keeps the callback API surface extract-zip uses (`open`, `openReadStream`, `readEntry`, entry/close/error events), so no source change was needed. `apps/desktop/tests/runtime-extraction-dependencies.spec.ts` resolves extract-zip's yauzl and requires major 3, so deleting the override fails a fast unit test instead of hanging a packaging run on an affected host.

## Alternatives considered

**Pin the build host to Node 24.15.** Rejected: the repository's supported range is `^22.19 || >=24`, so contributors and CI hosts land on affected versions naturally; a host-side pin does not survive the next Node bump and hides the defect rather than fixing it.

**Patch fd-slicer through `patchedDependencies`.** Rejected: it duplicates the upstream fix the repository would then own forever, while yauzl 3.x already carries it and extract-zip's API usage is compatible.

**Replace extract-zip with another zip library.** Deferred: extract-zip's API fits `prepareNode` exactly, and the deadlock sits in the transitive yauzl, not in extract-zip's own entry handling.

## Consequences

`prepare:runtime` completes on Node 24.16+ (verified end to end: all 1,942 archive entries extract, `node.exe` passes its executable verification, and `versions.json` is written). The lockfile gains yauzl 3.4.0 and drops fd-slicer, pend, and buffer-crc32 from that edge. `apps/desktop`'s runtime preparation stays a Windows-only consumer of extract-zip; macOS and Linux targets continue through the `tar` package and are unaffected. Hosts on Node 22 or ≤24.15 were never broken and now run the fixed dependency graph as well.
