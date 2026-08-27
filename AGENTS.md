# AGENTS.md

Conventions for anyone — human or agent — working in this repository.

## Project layout

```
docs/            Preflight setup and the lab guide
scripts/         preflight.sh — verifies your machine is ready
lab-app/         The application. All source and tests live here.
.gitlab-ci.yml   Pipeline definition
```

The application lives in **`lab-app/`**. Unless a task explicitly concerns the docs,
scripts, or pipeline, changes belong under `lab-app/`.

## Runtime and language

- **Node.js 22** or later (`engines.node` is `>=22`). Do not introduce syntax or APIs
  that require a newer runtime, and do not lower the engine floor.
- **CommonJS** (`"type": "commonjs"`). Use `require` / `module.exports`. Do not convert
  files to ESM or add `import` / `export` syntax.
- No transpiler, no bundler, no framework. Keep it plain Node.

## Tests

- Tests use the **built-in `node:test` runner** — there is no Jest, Mocha, or Vitest, and
  none should be added.
- Test files live in `lab-app/test/` and are named `*.test.js`.
- Run the suite with:

  ```bash
  cd lab-app && npm test
  ```

  which executes `node --test test/*.test.js`.

- To reproduce CI exactly, install from the lockfile first:

  ```bash
  cd lab-app && npm ci && npm test
  ```

**The test suite must pass before any change is reported as complete.** Do not describe a
fix as working, done, or verified unless you have actually run the tests and observed them
pass. If the suite fails, say so plainly and report the failure rather than characterising
the change as successful.

## Source control and merge requests

- The `origin` remote is a **self-managed GitLab instance**, not GitHub.
- Merge requests are created with **`glab`**, not `gh`. For example:

  ```bash
  glab mr create --fill
  ```

- `gh` targets GitHub and will not work against this remote. Do not substitute it, and do
  not reach for the GitHub API or GitHub-specific tooling for review workflow.
- The GitLab terminology is *merge request* (MR), not *pull request*.

## Dependency upgrades

- **Keep upgrades minimal.** Change only the package the task calls for. Do not
  opportunistically bump unrelated dependencies, and do not run broad commands such as
  `npm audit fix --force` or `npm update`.
- When remediating an advisory, upgrade to the **lowest fixed version that is still an
  upgrade** from the version currently in use. Do not jump to `latest`.
- **Preserve exact-version pinning.** Dependencies in `lab-app/package.json` are pinned to
  exact versions with no range prefix:

  ```json
  "dependencies": {
    "lodash": "4.17.15",
    "minimist": "1.2.6"
  }
  ```

  Never introduce `^`, `~`, `*`, or any other range specifier.
- Update `lab-app/package-lock.json` alongside `package.json` and commit both. Prefer
  `npm install --package-lock-only` so the lockfile is regenerated without pulling in
  incidental changes.
- Dependency changes are not application changes: do not alter application logic while
  performing an upgrade.

## Credentials and secrets

- **Never write credentials into tracked files.** No tokens, passwords, private keys,
  connection strings, or personal access tokens in source, tests, config, documentation,
  commit messages, or CI definitions — not even as placeholders that look real.
- Supply secrets through environment variables or GitLab CI/CD variables, and reference
  them by name only.
- Scanner output and session logs may contain sensitive data and are deliberately excluded
  in `.gitignore` (`findings.json`, `gitleaks-report.json`, session notes). Do not commit
  them or remove those entries.
- If you encounter a credential that is already committed, stop and report it. Do not
  quietly rewrite history or propagate the value.
