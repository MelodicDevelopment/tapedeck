import { copyFileSync, mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

if (process.platform !== 'darwin') {
  console.log('Skipping the macOS icon catalog on this platform.')
  process.exit(0)
}

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const iconSource = join(projectRoot, 'src-tauri/macos/AppIcon.icon')
const generatedDir = join(projectRoot, 'src-tauri/macos/generated')
const compileDir = mkdtempSync(join(tmpdir(), 'tapedeck-icon-'))
const partialInfo = join(compileDir, 'partial.plist')

const result = spawnSync(
  'xcrun',
  [
    'actool',
    '--output-format=human-readable-text',
    '--notices',
    '--warnings',
    '--errors',
    '--platform=macosx',
    '--target-device=mac',
    '--lightweight-asset-runtime-mode=enabled',
    '--app-icon=AppIcon',
    '--minimum-deployment-target=10.13',
    `--output-partial-info-plist=${partialInfo}`,
    `--compile=${compileDir}`,
    iconSource,
  ],
  { encoding: 'utf8' },
)

if (result.stdout) process.stdout.write(result.stdout)
if (result.stderr) process.stderr.write(result.stderr)

if (result.status !== 0) {
  throw new Error(
    'Could not compile the macOS 26 icon. Tapedeck macOS builds require Xcode 26 or newer.',
  )
}

mkdirSync(generatedDir, { recursive: true })
copyFileSync(join(compileDir, 'Assets.car'), join(generatedDir, 'Assets.car'))
copyFileSync(join(compileDir, 'AppIcon.icns'), join(generatedDir, 'AppIcon.icns'))

console.log('Compiled the macOS Default, Dark, and Mono app icon catalog.')
