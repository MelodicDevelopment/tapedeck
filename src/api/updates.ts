import { getVersion } from '@tauri-apps/api/app'

const REPO = 'MelodicDevelopment/tapedeck'
const LATEST_RELEASE_API = `https://api.github.com/repos/${REPO}/releases/latest`

export type UpdateInfo = {
  currentVersion: string
  latestVersion: string
  releaseUrl: string
}

/** Numeric comparison of dotted version strings (e.g. "0.2.10" > "0.2.9"). */
function isNewer(latest: string, current: string): boolean {
  const a = latest.split('.').map(Number)
  const b = current.split('.').map(Number)
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const x = a[index] ?? 0
    const y = b[index] ?? 0
    if (x !== y) return x > y
  }
  return false
}

/**
 * Compares the running desktop app's version against GitHub's latest
 * published release (drafts/prereleases are excluded by this endpoint).
 * Resolves to null on any network/parse failure or when already current —
 * this is a background convenience check, not something that should ever
 * block or error out app startup.
 */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  const currentVersion = await getVersion()
  let response: Response
  try {
    response = await fetch(LATEST_RELEASE_API)
  } catch {
    return null
  }
  if (!response.ok) return null

  const data = (await response.json()) as { tag_name?: string; html_url?: string }
  const latestVersion = data.tag_name?.replace(/^v/, '')
  if (!latestVersion || !data.html_url || !isNewer(latestVersion, currentVersion)) return null

  return { currentVersion, latestVersion, releaseUrl: data.html_url }
}
