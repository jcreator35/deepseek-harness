# Agent Note: Desktop launchers adopt the shell-free pnpm re-entry

Status: implemented

English | [中文](2026-09-11-desktop-pnpm-reentry.zh.md)

## Problem

The Desktop packaging and development launchers re-executed pnpm by spawning `node <npm_execpath>` with no regard for the entry's file form. `npm_execpath` is a JavaScript entry only when pnpm is installed through npm or Corepack; the official standalone installer exposes `@pnpm/exe`'s native `pnpm.exe`. On a Windows x64 host with standalone pnpm 11.7.0, `pnpm run package:desktop:win:x64` aborted at its first child step (`build:official`) with `ERR_UNKNOWN_FILE_EXTENSION ".exe"`, because Node cannot load a PE executable as a module. `dev:desktop` and `start:desktop` carried the same defect in their `runPackageScript`. The [pnpm-over-yarn decision](2026-06-16-pnpm-over-yarn.md) already settled this mapping repository-wide through `scripts/pnpm-invocation.ts`; the Desktop scripts predated that mechanism and never adopted it.

## Decision

`apps/desktop/scripts/package-target.ts` and `apps/desktop/scripts/dev.ts` resolve their child pnpm commands through the existing `pnpmInvocation` helper: `.js`, `.cjs`, and `.mjs` entries run under the current Node executable, while native and shebang executables (including `pnpm.exe`) run directly, always shell-free. The Desktop package already imports repository-root scripts (`prepare-package-set.ts` reaches `scripts/release/`), so the cross-plane import adds no new layout. The unavailable-`npm_execpath` diagnostic now comes from the shared helper instead of per-launcher copies.

## Alternatives considered

**Teach each Desktop launcher about the `.exe` form locally.** Rejected: it duplicates the mapping the repository already owns and tests in `scripts/pnpm-invocation.ts`, and the two launchers would drift again.

**Require npm- or Corepack-installed pnpm for Desktop releases.** Rejected: the standalone installer is a supported pnpm distribution; the native Windows pull-request job provisions `@pnpm/exe` precisely to exercise the PE entry.

**Route re-entry through a shell.** Rejected for the reasons recorded in the pnpm-over-yarn note: quoting, metacharacter expansion, and signal behavior change for every child command.

## Consequences

`package:desktop:*`, `prepare:desktop`, `dev:desktop`, and `start:desktop` work under both pnpm installation forms on the same host. The mapping behavior stays covered by `scripts/pnpm-invocation.spec.ts` (JavaScript entries, native executables, and paths with spaces and non-ASCII segments); the Desktop specs keep covering target parsing and environment scrubbing. A host without `npm_execpath` set now fails with the shared `pnpm invocation: npm_execpath is unavailable` diagnostic.
