# Security Policy

## Reporting a vulnerability

If you find a security issue in Tapedeck — especially anything involving the
Google OAuth flow (tokens, the credential vault, the redirect handling) or the
command surface exposed to the webview — please **do not open a public issue**.

Instead, either:

- use GitHub's [private vulnerability reporting](https://github.com/MelodicDevelopment/tapedeck/security/advisories/new), or
- email **support@melodic.dev** with the details.

Include steps to reproduce and what an attacker could gain. Please don't
include real tokens or credentials in your report — describe them instead.
You'll get an acknowledgment as soon as possible, and a fix will be released
before any public disclosure. Thanks for reporting responsibly.

## Supported versions

Only the latest release receives security fixes. Tapedeck checks GitHub for a
newer release on startup and tells you when one is out — please update before
reporting, so the fix isn't already shipped.
