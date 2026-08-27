# DevSecOps with the GitHub Copilot App

A 60-minute hands-on lunch and learn. You will use the GitHub Copilot App and Copilot CLI
to automate real DevSecOps work against a repository hosted on your own GitLab instance.

> **The idea:** Copilot is the *remediation layer* on top of the scanners you already run.
> Your scanners are good at finding things. Copilot closes the gap between a finding and a
> merged fix — and once you have captured how your team does that, it can repeat it on
> demand.

## What you will build

| | Lab | You will end up with |
| --- | --- | --- |
| 1 | Findings to Merge Request | A reviewed merge request that remediates a real advisory, verified by your test suite |
| 2 | Shift it left | Security scanning running automatically on every pipeline |
| 3 | A reusable security agent | Project conventions, a custom agent, and a guardrail that all travel with the repository |
| 4 | Unattended remediation | The same workflow running on its own in a GitLab runner |

By the end you will have a `security-reviewer` agent that any developer on your team can
summon to repeat this workflow the same way every time.

## Getting started

1. Work through [docs/preflight.md](docs/preflight.md) **at least 48 hours before the
   session.** Nothing is installed on the day.
2. On the day, follow [docs/lab-guide.md](docs/lab-guide.md).

## Repository layout

```
docs/            Preflight setup and the lab guide
scripts/         preflight.sh — verifies your machine is ready
lab-app/         The small Node service you will be working on
```

## What you need

- Node.js 22 or later
- The GitHub Copilot App, and Copilot CLI (`npm install -g @github/copilot`)
- `osv-scanner` and `glab`
- Access to your GitLab instance

Full details and a verification script are in [docs/preflight.md](docs/preflight.md).
