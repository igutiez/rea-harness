# Upstream provenance

`rea-harness` is a private fork that combines two MIT-licensed projects. This file records exactly
what came from where so a future update can be diffed instead of guessed.

## rsc-harness

- Repository: https://github.com/ericrisco/rsc-harness
- Version: 3.1.3
- Commit: `beb2af6233a368ca78d26d88257141fb1d599e45` (2026-10-20)
- License: MIT, © 2026 Eric Risco (`LICENSE`)
- Copied: `scripts/`, `targets/`, `schema/`, `skills/` (271 upstream skills), `manifest.json`
  (regenerated), `site/` (not part of the product), upstream tests.
- Modified: product identity and invocation, package metadata, CI, README, onboarding decision and
  policy for REA, REA scaffold and registration, doctor reporting, `CATALOG_ORIGIN`, and tests.
- The `.rsc` state directory and the `rsc` command name are kept for compatibility with the engine's
  contracts. The product exposes `rea-harness` and keeps `rsc` as an alias.

## REA

- Repository: https://github.com/morluto/rea
- Package: `rea-agents` 6.7.0
- Commit: `0bc2b42001f684beffcf47b70e507443b1a5d320` (2026-10-21)
- License: MIT, © 2026 morluto (`LICENSE` covers this repository; see `THIRD_PARTY_NOTICES.md`)
- Copied: `.agents/skills/reverse-engineer-anything/SKILL.md` and its six `references/*.md` into
  `skills/rea/` (renamed `rea`, pinned to `rea-agents@6.7.0`, harness section added).
- Not copied: the REA CLI, MCP server, bridges, native code, third-party engines or any code from
  `third_party/`. The harness invokes the published `rea-agents` package instead.
- Registration: delegated to `rea setup --client <id> --skill=false --yes --json`. The harness does
  not reimplement client configuration formats.

## Update procedure

1. Pick the new upstream commits and read their changelogs.
2. For rsc, diff `scripts/`, `targets/`, `schema/`, `skills/` and re-apply the REA modifications
   listed above; regenerate `manifest.json`.
3. For REA, re-copy the skill and references, update `REA_VERSION` in
   `scripts/lib/rea-integration.js`, the pin in `skills/rea/SKILL.md`, and the README version.
4. Run `npm run check` and the offline end-to-end test.
5. Record the new commits here before committing.

## Not affiliated

This repository is not endorsed by or affiliated with Eric Risco, rsc-harness, morluto or REA.
