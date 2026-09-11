import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

// prepare-runtime extracts the Windows Node.js archive through extract-zip, whose
// pinned yauzl 2.x deadlocks on Node >= 24.16 for entries larger than one 64 KiB
// stream chunk (nodejs/node#63487). The workspace override resolves extract-zip
// against yauzl 3, whose rewritten fd-slicer emits 'end' again; this spec pins that
// resolution so removing the override fails before a packaging run hangs.
describe('desktop runtime extraction dependencies', () => {
  it('resolves extract-zip against the deadlock-free yauzl major', () => {
    const localRequire = createRequire(import.meta.url)
    const extractZipRequire = createRequire(localRequire.resolve('extract-zip'))
    const manifest = extractZipRequire('yauzl/package.json') as { version?: unknown }
    expect(manifest.version).toMatch(/^3\./u)
  })
})
