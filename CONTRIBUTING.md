# Contributing to Tapedeck

Thanks for your interest! Tapedeck is a small project and contributions of every size are welcome — bug reports, docs fixes, features, and especially testing on Windows and Linux.

## Before you start

- **Open an issue first** for anything beyond a small fix. A two-minute conversation beats a rejected pull request.
- **Check the product boundary**: Tapedeck plays YouTube through the official embedded player and Data API only. Changes that add downloading, audio extraction, ad blocking, or hidden playback of the stream will be declined, no matter how well written.

## Getting set up

Follow the [Installation](README.md#installation) section of the README. The demo playlist runs with no Google credentials, which is enough for most UI work. You only need your own OAuth client to test sign-in and real channel loading.

## Making changes

1. Fork the repo and create a branch from `main` (`feature/short-description` or `fix/short-description`).
2. Make your change. Match the style of the surrounding code; prefer small, focused commits with clear messages.
3. Add or update tests when you change behavior — pure logic lives in `src/lib/` specifically so it stays testable.
4. Run everything before pushing:

   ```sh
   npm run typecheck && npm run lint && npm test
   cd src-tauri && cargo fmt --check && cargo clippy --all-targets --all-features -- -D warnings && cargo test
   ```

5. Open a pull request against `main`. Describe **what** changed and **why**; link the related issue; include a screenshot for UI changes.

## What to expect

- Reviews aim to be constructive and prompt; small PRs get merged fastest.
- The maintainer may ask for changes or make minor adjustments on merge.
- By contributing, you agree your contributions are licensed under the project's [MIT License](LICENSE).

## Reporting bugs

Open an issue with:

- your OS and how you built/ran the app,
- steps to reproduce,
- what you expected vs. what happened,
- the exact error text — Tapedeck's network errors intentionally include their underlying cause, which usually points straight at the problem.

## Security

If you find a vulnerability (especially around the OAuth flow or the webview command surface), please **do not** open a public issue — email the maintainer instead so it can be fixed before disclosure.
