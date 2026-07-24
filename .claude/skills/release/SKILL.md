---
name: release
description: Cut a full Tapedeck release — bump the version everywhere it's tracked, commit, push, tag, wait on the cross-platform GitHub Actions build, then write a real title/description and publish the draft GitHub release. Use when the user says "cut a release", "ship this", "do a release", or runs `/release`.
---

# /release — full Tapedeck release

Arguments (`$ARGUMENTS`, optional): `patch` (default), `minor`, `major`, or an
explicit version like `0.3.0`.

This repo's release pipeline: pushing a `vX.Y.Z` tag triggers
`.github/workflows/release.yml`, which builds signed macOS/Windows/Linux
bundles via `tauri-apps/tauri-action` and creates a **draft** GitHub Release
named "Tapedeck vX.Y.Z" with the built installers attached, but no real
title or description — that part is manual, which is what this skill
automates.

## 1. Check the working tree

Run `git status` and `git diff`. Anything uncommitted is the content of this
release — read it well enough to describe it later. If there's nothing
uncommitted and no reason to release, stop and ask the user what they want
shipped.

## 2. Compute the new version

Current version lives in three places, always in lockstep:
`package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`.
Read the version from `package.json` (source of truth), then:

- no argument / `patch` → bump the patch number
- `minor` → bump minor, zero the patch
- `major` → bump major, zero minor and patch
- an explicit `x.y.z` → use it verbatim

Edit the version string in all three files, then run `cargo check` inside
`src-tauri/` — this refreshes the `tapedeck` package entry in `Cargo.lock` to
match. All four files should change; that's the pattern every prior version
bump in this repo follows (`git log --oneline | grep -i bump` for examples).

## 3. Sanity-check before shipping

Run, from the repo root:
- `npx tsc -p tsconfig.app.json --noEmit`
- `npx eslint .`
- `npm test -- --run`
- `cargo check` (inside `src-tauri/`, if not already run in step 2)

Fix anything broken before proceeding — don't tag a build you haven't
verified compiles and passes tests.

## 4. Commit and push

Write a commit message the same way recent history does it (check
`git log -5` for tone): a short imperative summary line, a bullet body only
if there's more than one notable change, and — only when the version bump is
bundled into this same commit — a trailing line `Bumps to X.Y.Z.`

Do **not** add a `Co-Authored-By` trailer (global rule, no exceptions).

Stage the relevant files (not `-A` blindly — check `git status` first),
commit, then `git push`.

## 5. Tag and push the tag

Tags in this repo are lightweight, not annotated:

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

## 6. Watch the build

Grab the run this just triggered and watch it in the background so it
doesn't block the conversation:

```bash
sleep 5  # give GitHub a moment to register the push
gh run list --workflow=release.yml --limit 1 --json databaseId,status -q '.[0].databaseId'
```

Then launch (as a **background** Bash command — this takes ~10-13 minutes
across three platforms, don't block on it or poll it manually):

```bash
gh run watch <run-id> --exit-status
```

Tell the user the build is running and you'll follow up when it's done.
When the notification arrives, check the conclusion. If a platform failed,
diagnose from `gh run view <run-id> --log-failed` before touching the
release — do not publish a release with a failed platform build silently
missing its installer.

## 7. Write the release and publish it

Once all three platforms succeed, the draft release `vX.Y.Z` exists with
installers attached but a generic title. Replace both:

```bash
gh release edit vX.Y.Z \
  --title "Tapedeck vX.Y.Z — <short highlight of the headline change>" \
  --notes "$(cat <<'EOF'
<2-5 sentences or a short bullet list of what actually changed for a user —
pull this from the commits since the previous tag, not from the diff line
count. Written for someone deciding whether to update, not a changelog robot.>
EOF
)" \
  --draft=false
```

Base the notes on `git log <previous-tag>..vX.Y.Z --oneline` plus the commit
bodies for context — most prior releases (v0.2.1 onward) shipped with a flat
"Tapedeck vX.Y.Z" title and empty body; do better than that here.

Report the release URL back to the user when done.
