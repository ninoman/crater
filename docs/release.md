# Releasing

The version lives in `package.json` only. `src/manifest.ts` reads it, so the built manifest, the
zip name and the changelog can't drift. The extension name also lives in the manifest only.

## Normal release

1. Make sure `CHANGELOG.md` has entries under `## [Unreleased]` (Added / Changed / Fixed / Removed).
2. Start from a clean tree on `main`.
3. Run one of:

   ```bash
   npm run release:patch   # fixes, parser patches
   ```

   `release:minor` for new features, `release:major` for breaking changes (a schema change that
   drops data, say). The script:
   - runs `npm test` first and stops if it fails
   - bumps `package.json` (and the lockfile) and moves the Unreleased entries under
     `## [x.y.z] - <today>`
   - runs `npm run build` (typecheck + Vite)
   - zips `dist/` into `releases/<name>-<version>.zip` (gitignored)
   - if the build fails, puts the version and changelog back
4. Run `npm run lint`, load `dist/` unpacked and smoke-test a release page and your profile.
5. Commit and tag, as the script prints:

   ```bash
   git commit -am "release: vX.Y.Z" && git tag vX.Y.Z
   ```

6. Upload the zip in the [Chrome Web Store dashboard](https://chrome.google.com/webstore/devconsole)
   (Package → Upload new package), update the listing if needed, and submit for review.

The first submission is the current version without a bump: `npm run release:build`.

## Quick patch: Bandcamp broke a parser

Symptoms: the sidebar shows "parser broken", or a scan fails with a `ParserError`.

1. Diff the live responses against the saved fixtures:

   ```bash
   npm run fixtures:refresh
   ```

   It captures fresh copies into `tests/fixtures/.fresh/` and prints which keys were added,
   removed or changed in type, and which parser now rejects the body. Saved fixtures are untouched.
2. Update the zod schema and the parser in `src/bandcamp/` to match. Bandcamp knowledge stays in
   that folder only.
3. Adopt the new samples: `npm run fixtures:refresh -- --write` (or name single files), and
   review the fixture diff. Logged-in fixtures are not refreshed by the script: recapture those
   by hand per `tests/fixtures/README.md`.
4. Update the fixture tests so they cover the new shape, then `npm test`.
5. Add a `### Fixed` line under Unreleased, for example "Parse the new supporters payload".
6. `npm run release:patch`, commit, tag.
7. Resubmit the zip in the dashboard. Patch reviews are usually quick, but expect hours to days;
   users on the old version stay broken until it is approved and Chrome auto-updates.
