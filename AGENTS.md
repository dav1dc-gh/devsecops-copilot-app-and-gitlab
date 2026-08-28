# AGENTS.md

Guidance for AI agents and humans working in this repository.

## Project layout

The application lives in `lab-app/`. The repository root holds lab documentation,
CI configuration, and helper scripts — not application code.

```
lab-app/
  src/          application source (config.js, server.js)
  test/         node:test suites (*.test.js)
  package.json  dependencies, exact-pinned
  Dockerfile
docs/           lab guide and preflight notes
scripts/        preflight helper
.gitlab-ci.yml  CI pipeline
```

## Runtime and language

- **Node 22.** `lab-app/package.json` declares `"engines": { "node": ">=22" }` and CI
  runs on `node:22-bookworm-slim`. Do not use APIs that require a newer runtime.
- **CommonJS.** The package sets `"type": "commonjs"`. Use `require()` and
  `module.exports`. Do not convert files to ESM or add `import`/`export` syntax.
- **Built-in `node:test` runner.** Tests use Node's built-in test runner and
  `node:assert`. Do not add Jest, Mocha, Vitest, or any other test framework.

## Running the tests

```bash
cd lab-app && npm test
```

That runs `node --test test/*.test.js`. To reproduce CI exactly, use a clean install:

```bash
cd lab-app && npm ci && npm test
```

`npm ci` requires `package.json` and `package-lock.json` to be in sync — if you change
one, update the other in the same change.

## Source control and merge requests

- The `origin` remote is a **self-managed GitLab** instance. This is not a GitHub
  repository workflow.
- Create merge requests with the **`glab`** CLI (for example `glab mr create`).
  **Do not use `gh`** — it targets GitHub and will not work against this origin.
- Terminology follows GitLab: *merge request* (MR), not *pull request*.

## Dependency upgrades

- Keep upgrades **minimal**. Upgrade only the package you were asked to address, and
  only to the **lowest fixed version that is still an upgrade** from the current one.
  Do not opportunistically bump unrelated dependencies.
- **Preserve exact-version pinning.** Dependencies are pinned to exact versions
  (`"minimist": "1.2.6"`). Never introduce range specifiers such as `^`, `~`, `*`,
  `latest`, or `>=`.
- Update `package-lock.json` alongside `package.json` so `npm ci` keeps working.
  `npm install --package-lock-only` updates the lockfile without touching
  `node_modules/`.
- Do not change application logic as part of a dependency upgrade. If an upgrade
  genuinely requires a code change, call that out explicitly rather than folding it in
  silently.

## Definition of done

**The test suite must pass before any change is reported as complete.** Run
`cd lab-app && npm ci && npm test` and confirm zero failures. Do not describe a change
as working, fixed, or done based on inspection alone — report the actual test output,
and if tests fail, say so plainly instead of claiming success.

## Credentials and secrets

**Never write credentials into tracked files.** No tokens, passwords, private keys,
connection strings, or API keys in source, config, test fixtures, commit messages, or
documentation — including placeholder-looking values that are actually real.

- Use environment variables or the CI secret store for anything sensitive.
- If a scan report or log may contain secrets, keep it out of version control.
  `.gitignore` already excludes `findings.json`, `gitleaks-report.json`, and session
  notes for this reason.
- If you encounter a committed secret, report it and treat it as compromised — do not
  quietly delete it and move on, since it remains in git history.
