# Releasing

Releases are driven by [release-please](https://github.com/googleapis/release-please) from Conventional Commits on `main` ([workflow](../.github/workflows/release.yml)).

1. Push `feat:` / `fix:` commits to `main` as usual. release-please keeps a release PR open that bumps `package.json` and updates `CHANGELOG.md`.
2. Merge the release PR when you want to ship. That tags `vX.Y.Z` and creates a GitHub release.
3. The `publish` job then lints, tests and builds, attaches the zip to the GitHub release, and submits it to the Chrome Web Store. The store publishes it once review passes.

The manifest reads its version from `package.json`, so there is nothing else to bump.

- `feat` bumps minor, `fix` bumps patch. While we're below 1.0, a breaking change (`feat!:` or `BREAKING CHANGE:`) also bumps minor.
- Never use pre-release versions such as `0.2.0-beta.1`. Chrome only accepts 1–4 dot-separated integers.
- Commits before `bootstrap-sha` in [release-please-config.json](../release-please-config.json) are treated as already released as 0.1.0.

## One-time setup

1. **First listing.** Run `npm run release:build` (tests, builds and zips `dist/` into `releases/`) and upload that 0.1.0 zip by hand in the [developer dashboard](https://chrome.google.com/webstore/devconsole). The API can only update an existing item. Note the extension ID and your publisher ID.
2. **API credentials.** Enable the Chrome Web Store API in a Google Cloud project and create an OAuth client and refresh token ([guide](https://github.com/fregante/chrome-webstore-upload-keys)).
3. **Repo secrets.** In GitHub → Settings → Secrets and variables → Actions, add `CWS_EXTENSION_ID`, `CWS_PUBLISHER_ID`, `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET` and `CWS_REFRESH_TOKEN`.
4. **Actions permission.** In GitHub → Settings → Actions → General, enable *Allow GitHub Actions to create and approve pull requests*, or release-please can't open its PR.

## Quick patch: Bandcamp broke a parser

Symptoms: the sidebar shows "parser broken", or a scan fails with a `ParserError`.

1. Diff the live responses against the saved fixtures with `npm run fixtures:refresh`. It captures fresh copies into `tests/fixtures/.fresh/` and prints which keys were added, removed or changed type, and which parser now rejects the body. Saved fixtures are untouched.
2. Update the zod schema and the parser in `src/bandcamp/`. Bandcamp knowledge stays in that folder only.
3. Adopt the new samples with `npm run fixtures:refresh -- --write` (or name single files) and review the fixture diff. Logged-in fixtures aren't refreshed by the script: recapture those by hand per `tests/fixtures/README.md`.
4. Update the fixture tests to cover the new shape, then `npm test`.
5. Commit as `fix: …` (for example `fix: parse the new supporters payload`) and push to `main`.
6. Merge the release PR. CI submits the patch, and the store review usually takes hours to days; users on the old version stay broken until it's approved and Chrome auto-updates.
