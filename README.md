# DevSecOps with the GitHub Copilot App

A 60-minute hands-on lunch and learn. You will use the GitHub Copilot App and Copilot CLI
to automate real DevSecOps work against a repository hosted on your own GitLab instance.

> **The idea:** Copilot is the *remediation layer* on top of the scanners you already run.
> Your scanners are good at finding things. Copilot closes the gap between a finding and a
> merged fix — and once you have captured how your team does that, it can repeat it on
> demand.

## Getting started

1. Work through [docs/preflight.md](docs/preflight.md) **at least 48 hours before the
   session.** Nothing is installed on the day.
2. On the day, follow [docs/lab-guide.md](docs/lab-guide.md).

## What you will build

| | Lab | You will end up with |
| --- | --- | --- |
| 1 | Findings to Merge Request | A reviewed merge request that remediates a real advisory, verified by your test suite |
| 2 | Turn that prompt into an agent | Project conventions, a `security-reviewer` agent, and a guardrail that all travel with the repository |
| 3 | Run the agent in a GitLab runner | Security scanning on every pipeline, and a CI job that calls your agent unattended |

Each lab is the previous one with the human taken out of it: do it by hand, capture how
you did it, then let CI press the button.

## Repository layout

```
docs/            Preflight setup and the lab guide
scripts/         preflight.sh — verifies your machine is ready
lab-app/         The small Node service you will be working on
.gitlab-ci.yml   The pipeline you will extend in Lab 3
```

## What you need

- Node.js 22 or later
- The GitHub Copilot App, and Copilot CLI (`npm install -g @github/copilot`)
- `osv-scanner` and `glab`
- Access to your GitLab instance

Full details and a verification script are in [docs/preflight.md](docs/preflight.md).
