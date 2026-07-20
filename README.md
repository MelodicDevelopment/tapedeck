# Tapedeck

Tapedeck is a lightweight Tauri 2 desktop player that turns a YouTube channel or playlist into a focused, sequential listening queue. Videos always play through the visible official YouTube embedded player; Tapedeck does not download or extract audio.

## Why Tauri

Tauri uses the operating system webview instead of bundling Chromium. That gives Tapedeck a substantially smaller distribution and lower idle-memory baseline than an Electron shell while preserving the existing React interface.

The tradeoff is that rendering uses WKWebView on macOS, WebView2 on Windows, and WebKitGTK on Linux. The normal browser build remains supported as a fallback.

## Architecture

- React, TypeScript, and Vite interface
- Tauri 2 Rust host and native application window
- A locked-down localhost origin for packaged assets so the official YouTube player receives HTTP client identity/referrer information
- Single-instance protection so multiple launches cannot compete for that private player origin
- Google OAuth for installed apps using the system browser, PKCE, a random loopback callback port, and state validation
- Refresh tokens stored in the operating system credential vault; short-lived access tokens remain in memory
- Direct, authenticated calls from the Rust host to the official YouTube Data API
- YouTube IFrame Player API for visible, controlled playback
- Optional Express/API-key fallback for the browser build
- Vitest, Testing Library, ESLint, Rustfmt, and Clippy verification

The localhost-served desktop page is granted only Tapedeck's compiled commands. It has no general filesystem or shell access.

## Desktop development

Requirements:

- Node.js 20 or newer
- Rust stable
- Platform prerequisites from the [Tauri setup guide](https://v2.tauri.app/start/prerequisites/)
- A Google Cloud project with YouTube Data API v3 enabled
- A Google OAuth client whose application type is **Desktop app**

```sh
cp .env.example .env
# Add TAPEDECK_GOOGLE_CLIENT_ID and TAPEDECK_GOOGLE_CLIENT_SECRET to .env.
# Google requires the Desktop-app client secret at the token endpoint even
# with PKCE, and treats installed-app secrets as non-confidential.

npm install
npm run desktop
```

`npm run desktop` starts Vite and the native Tauri window. Tapedeck opens Google sign-in in the user's default browser, then receives the result on a temporary `127.0.0.1` port. The explicit demo playlist works without Google configuration.

### Google Cloud setup

1. Enable **YouTube Data API v3** in the Google Cloud project.
2. Configure the OAuth consent screen. During development, add intended accounts as test users.
3. Create **Credentials → OAuth client ID → Desktop app**.
4. Copy the resulting client ID (ending in `.apps.googleusercontent.com`) into `.env` as `TAPEDECK_GOOGLE_CLIENT_ID`, and the client secret as `TAPEDECK_GOOGLE_CLIENT_SECRET`.

Tapedeck requests `youtube.readonly`, `openid`, `email`, and `profile`. A public release may require completing Google's OAuth app verification and publishing requirements for the YouTube read-only scope.

## Package the desktop app

A distributable desktop build embeds the Desktop OAuth client ID and secret from `.env`:

```sh
npm run desktop:build
```

No YouTube API key or Tapedeck API endpoint is included in or required by the desktop package. The embedded Desktop OAuth credentials are the kind Google designates non-confidential for installed apps; keep `.env` and the downloaded client JSON out of source control regardless.

The macOS outputs are written under:

```text
src-tauri/target/release/bundle/macos/Tapedeck.app
src-tauri/target/release/bundle/dmg/Tapedeck_<version>_aarch64.dmg
```

Windows and Linux packages must be built on their respective platforms. Public distribution additionally requires platform code signing and, on macOS, notarization.

## Run the API or browser fallback

The Express service is retained only for the standalone browser build. Configure `YOUTUBE_API_KEY` using `.env.example`, then:

```sh
npm run dev       # Express API and Vite browser app
npm run build
npm start         # production Express API and browser build
```

For a hosted browser API, set `CORS_ORIGINS` to the allowed browser origins and `VITE_API_BASE_URL` to its public address.

## Quality checks

```sh
npm run typecheck
npm run lint
npm test

cd src-tauri
cargo fmt --check
cargo clippy --all-targets --all-features -- -D warnings
```

## YouTube integration

The desktop Rust host calls the official YouTube Data API with the signed-in user's short-lived access token. It:

- resolves handles, channel IDs, legacy usernames/custom URLs, and playlist URLs;
- maps channels to their uploads playlist;
- paginates playlist items;
- fetches durations and embeddability in batches;
- marks private, removed, or non-embeddable entries unavailable;
- never downloads media and returns only source and track metadata to the interface.

The optional Express fallback exposes the same normalized response at `POST /api/youtube/resolve`, using the server-only `YOUTUBE_API_KEY`.

## Product scope

Tapedeck has no Tapedeck account system, authentication database, comments, recommendations, downloads, audio extraction, or playlist editing. Google login exists only to authorize read-only official YouTube API requests. The checked-in demo metadata is the only mocked data; pasted URLs use the official YouTube Data API.
