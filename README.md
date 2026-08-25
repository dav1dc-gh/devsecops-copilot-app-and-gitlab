# DevSecOps with the GitHub Copilot App — GitLab Edition

A 60-minute hands-on workshop teaching developers to automate DevSecOps tasks with the
GitHub Copilot App and Copilot CLI against repositories hosted on **self-managed GitLab**.

> **Framing:** Copilot is the *remediation layer* on top of the scanners you already run.
> It does not replace your scanners. It closes the loop between a finding and a merged fix.

## Audience constraints this workshop is built for

| Constraint | Consequence |
| --- | --- |
| No code on github.com, no GHES | Everything runs locally or in a GitLab runner |
| No GitHub Advanced Security | Findings come from OSV-Scanner / gitleaks, not GHAS |
| Copilot licences only | Copilot cloud agent is **out of scope** — it only works on GitHub-hosted repos |
| Self-managed GitLab | `glab` against `$GITLAB_HOST`; no gitlab.com dependency |

## Run of show

| Time | Segment | Guide |
| --- | --- | --- |
| 0–5 | Preflight green-check | [docs/preflight.md](docs/preflight.md) |
| 5–12 | Framing + end-to-end demo | [docs/facilitator-guide.md](docs/facilitator-guide.md) |
| 12–25 | Lab 1 — Findings to Merge Request | [docs/lab-guide.md](docs/lab-guide.md) |
| 25–36 | Lab 2 — Shift it left | [docs/lab-guide.md](docs/lab-guide.md) |
| 36–46 | Lab 3 — Guardrails without GHAS | [docs/lab-guide.md](docs/lab-guide.md) |
| 46–56 | Capstone — agent in the runner | [docs/plumbing-tax.md](docs/plumbing-tax.md) |
| 56–60 | Governance + the ask | [docs/facilitator-guide.md](docs/facilitator-guide.md) |

## Repository layout

```
docs/            Facilitator guide, attendee lab guide, preflight, plumbing-tax worksheet
scripts/         preflight.sh — the 48-hours-before green-check
lab-app/         Seeded Node app with intentionally vulnerable dependencies
ci/              Runner image + the capstone "agent in the runner" pipeline
solutions/       Facilitator reference answers for Labs 2 and 3
```

## Open assumptions

Two inputs were not confirmed before authoring. Both are isolated so they are cheap to swap:

1. **GitLab tier.** Labs assume no GitLab Ultimate SAST/Dependency Scanning. Scanners are
   brought in via OSV-Scanner and gitleaks, and everything downstream consumes a
   `findings.json` file. If the customer has Ultimate, replace the scanner step and keep
   the rest.
2. **Audience makeup.** Written for app developers. For a platform/DevSecOps audience,
   expand Lab 3 and the capstone and compress Labs 1–2.

## Before you deliver

See [TODO.md](TODO.md) for every unresolved assumption, unverified version pin, and
logistics dependency. Several P0 items must be confirmed against the customer's own
Copilot policy before the session.
