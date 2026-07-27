import { relaunch } from '@tauri-apps/plugin-process'
import { check, type Update } from '@tauri-apps/plugin-updater'

export type StagedUpdate = {
  currentVersion: string
  version: string
}

/** The downloaded-but-not-installed update, kept so restartToUpdate() can
 *  finish the job without re-checking or re-downloading. */
let staged: Update | null = null

/**
 * Checks the release manifest and, when a newer version exists, downloads it
 * in the background so it's ready to install. Resolves to null when already
 * current or on any check/download failure — this is a background
 * convenience, not something that should ever block or error out app
 * startup.
 */
export async function stageUpdate(): Promise<StagedUpdate | null> {
  let update: Update | null
  try {
    update = await check()
    if (!update) return null
    await update.download()
  } catch {
    return null
  }
  staged = update
  return { currentVersion: update.currentVersion, version: update.version }
}

/**
 * Installs the staged update and relaunches into the new version. On
 * Windows the installer quits the app itself, so relaunch() may never run
 * there — that's the documented flow, not an error.
 */
export async function restartToUpdate(): Promise<void> {
  if (!staged) return
  await staged.install()
  await relaunch()
}
