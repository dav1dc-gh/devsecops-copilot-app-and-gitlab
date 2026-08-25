# Capstone — the plumbing tax

## How this segment runs (10 minutes)

1. **Facilitator demos** a pre-warmed pipeline running Copilot CLI inside a GitLab runner.
   Attendees do **not** build this. Auth, runner images and egress would consume half the
   session and a third of the room would fail.
2. **Attendees annotate** [ci/copilot-remediate.gitlab-ci.yml](../ci/copilot-remediate.gitlab-ci.yml)
   for three minutes, using the worksheet below.
3. **Total it up.**

## Ground rule for the facilitator

**This artifact genuinely works, and attendees keep it.** If it is built as a strawman the
room will detect it instantly and the entire argument collapses. Present it as a real
pattern you would recommend — then let the maintenance burden speak for itself. Do not
editorialise. The file makes the point better than you can.

## Worksheet

Go through the job and mark every line that exists *only* because this is not the GitHub
platform.

| # | What you own | Where | What replaces it on GitHub |
| --- | --- | --- | --- |
| 1 | A **user-owned** fine-grained PAT with "Copilot Requests". Org-owned tokens cannot carry that permission; classic PATs are unsupported. | `COPILOT_GITHUB_TOKEN` | Ephemeral scoped token |
| 2 | A second GitLab PAT with its own expiry and rotation runbook | `GITLAB_TOKEN` | — |
| 3 | A runner image with a pinned CLI, pinned scanners, and a rebuild cadence | `ci/copilot-runner.Dockerfile` | Provisioned environment |
| 4 | Pre-seeded `COPILOT_HOME` so the job never hits an interactive trust prompt | `variables` | N/A |
| 5 | A hand-written `--deny-tool` list as your blast-radius limit | `script` | Policy-inherited firewall and sandbox |
| 6 | Manual redaction — `GITLAB_TOKEN` is **not** redacted by default | `--secret-env-vars` | — |
| 7 | Branch, commit, push and MR creation, written by you | `script` | Automatic |
| 8 | A job artifact with an expiry as your entire audit trail | `artifacts` | Per-session logs, viewable and replayable |
| 9 | Runner capacity, schedules and cost | `rules`, `timeout` | Actions concurrency |
| 10 | No mid-run steering, no resume, no session view | everywhere | Session UI |

## The one that is not convenience

Items 1–8 are plumbing. This one is a ceiling:

> **Parallelism.** Local agent sessions are bounded by a laptop. This pipeline is bounded
> by your runner fleet, and every repository needs its own schedule, its own variables and
> its own pipeline. "Fix this CVE across 200 repositories overnight" is not a
> configuration difference — it is a different category of operation.

Say it once, with a number, and stop talking.

## The security finding — raise this yourself

An autonomous agent running with broad tool permissions inside a CI container that holds
your deployment credentials is a genuine risk. If a dependency README, a transitive
package, or a merge request description carries a prompt injection, the agent has both the
credentials and the network to act on it.

The `--deny-tool` list and the policy hook in
[ci/policy.d/](../ci/policy.d/) are **mitigations, not controls**. On the GitHub platform
that containment is the platform's job. Here it is yours.

Being the person who raises this unprompted is worth more than the demo.

## Then name the costs honestly

Thirty seconds, immediately after the tally. Two things GitLab does well for this
customer, and the real cost of moving: CI rewrite, runner strategy, permissions model,
and muscle memory. Vendors never do this, which is exactly why it works — and it is what
makes the preceding ten rows believable.

## The ask

Not a migration. Migration is a procurement and policy decision that nobody in the room
can make. Ask for something a developer *can* do:

> **"Who would we need in a room to explore whether one non-critical repository could
> live on GitHub for 30 days?"**

That identifies your champion and your blocker in a single question.

## Room risk

Check the attendee list first. If GitLab platform ownership is in the room, this worksheet
reads as criticism of their work. Same content, different frame:

> *"Here is what your platform team is currently carrying."*

Sympathetic, not competitive.
