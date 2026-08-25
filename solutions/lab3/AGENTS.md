# Lab App — agent instructions

## What this project is

A small Node.js HTTP service. Configuration is layered: defaults, then command line
arguments, then explicit overrides. There is no database and no external service.

## Environment

- Node 22 or later. No transpiler, no bundler.
- CommonJS (`require`), not ESM.
- Tests use the built-in `node:test` runner. There is no Jest, Mocha, or Chai.
- The origin remote is self-managed GitLab, not GitHub. Use `glab` for merge requests.

## Commands

| Task | Command |
| --- | --- |
| Install | `npm ci` |
| Test | `npm test` |
| Run | `npm start` |
| Scan dependencies | `osv-scanner --format json --output-file findings.json ./` |
| Scan for secrets | `gitleaks detect --no-git --redact` |

## Rules for changes

- **Always run `npm test` before proposing a change is complete.** Do not report success
  on an unverified change.
- Keep dependency upgrades minimal. Bump the vulnerable package to the lowest version
  that resolves the advisory. Do not upgrade unrelated packages in the same change.
- Do not change application behaviour while remediating a vulnerability. If a fix
  requires a behaviour change, stop and say so rather than making it.
- Never write credentials into tracked files. Read them from environment variables and
  reference them by name. A `preToolUse` hook enforces this and will block the attempt.
- Branch names use the form `copilot/<short-description>`.
- Merge requests target the default branch and must describe which advisory was fixed
  and how the fix was verified.

## Security context

This project has no GitHub Advanced Security, no Dependabot, and no code scanning.
Every finding you act on comes from a scanner report file in the working directory —
usually `findings.json`. Treat that file as the source of truth for what is vulnerable.
Do not invent findings, and do not claim a vulnerability is fixed unless the scanner
report or a version bump in `package-lock.json` demonstrates it.
