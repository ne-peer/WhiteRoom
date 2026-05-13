/**
 * Optional authoring script: run Python brush extractor on each `assets/asset-effect/<subdir>`
 * that contains at least one `.sut` file (non-recursive per folder, matching `wr_cspbrushextract.py`).
 *
 * Usage: node scripts/extract-sut-presets.cjs
 * Requires: Python 3 on PATH.
 */

const { readdirSync, statSync } = require('fs')
const { join } = require('path')
const { execFileSync } = require('child_process')

const root = join(__dirname, '..', 'assets', 'asset-effect')

function hasSut(dir) {
  return readdirSync(dir).some(name => name.toLowerCase().endsWith('.sut'))
}

let ran = 0
try {
  const entries = readdirSync(root, { withFileTypes: true })
  for (const e of entries) {
    if (!e.isDirectory()) continue
    const dir = join(root, e.name)
    if (!hasSut(dir)) continue
    console.log(`[extract-sut-presets] ${dir}`)
    execFileSync('python', ['lib/wr_cspbrushextract.py', dir], {
      cwd: join(__dirname, '..'),
      stdio: 'inherit',
    })
    ran++
  }
} catch (err) {
  console.error('[extract-sut-presets]', err.message)
  process.exitCode = 1
}

if (ran === 0) {
  console.log('[extract-sut-presets] No folders with .sut under assets/asset-effect')
}
