# Facilitator guide

## Branch model — read this first

This repository is split in two, deliberately.

| Branch | Contains | Who sees it |
| --- | --- | --- |
| `main` | README, preflight, lab guide, `scripts/`, `lab-app/`, `.gitlab-ci.yml` | Attendees. This is what they clone. |
| `facilitator` | Everything on `main`, **plus** this guide, the plumbing-tax worksheet, `solutions/`, `ci/`, and `TODO.md` | You. |

Attendees must not be pointed at `facilitator`. It contains the answers to every lab and
the framing for the closing segment.

**Attendee-facing language is deliberately outcome-focused.** The lab guide never mentions
what the customer does not have, and never telegraphs the closing argument. Labs are framed
as *"here is what you will be able to do"*, not *"here is what you are missing"*. Keep to
that framing verbally as well — the tally in the closing segment only works if the room
reaches it themselves.

Attendees are told to compare their Lab 3 pipeline against `solutions/lab3/.gitlab-ci.yml`
on this branch. Either paste it into chat at that point in the session, or push it to
`main` beforehand — the lab guide review table works without it, but the comparison lands
better with the file in front of them.

To hand out the annotated capstone pipeline, share `ci/copilot-remediate.gitlab-ci.yml`
from the `facilitator` branch directly, or merge it to `main` after the session.

## The one-sentence thesis

> Copilot is the remediation layer on top of the scanners you already run.

For a customer with no GHAS, Copilot is not a scanner and must never be sold as one. The
value is closing the loop between a finding and a merged fix. Every lab reinforces that
separation: the scanner finds, the agent fixes.

## Correct the record before the invite goes out

The previous customer conversation covered Copilot cloud agents. **Cloud agent only works
on repositories hosted on GitHub.** This customer has none. If the abstract promises cloud
agents, the workshop cannot deliver them and you lose the room in the first ten minutes.

Flag this to the account team before the invitation is sent.

Also avoid the word "free" for security scanning. Free applies to public repositories; for
this customer's private code it is licensed.

---

## Run of show

### 0–5 · Preflight green-check

Everyone runs `./scripts/preflight.sh` and shows green. Anyone red pairs with a neighbour
immediately — do not debug one laptop while nine people watch.

### 5–12 · Framing and one end-to-end demo

Draw the loop before anyone touches a keyboard:

```
GitLab repo → scanner → findings.json → Copilot → branch → Merge Request → CI
```

**The honest scope-setting sentence — say this, it matters:**

> *"Everything today runs locally against GitLab. Where GitHub does something natively I'll
> flag it in passing, and we'll total it up at the end."*

This buys trust and licenses every later mention. Without it, the first platform mention
feels like a bait-and-switch and the room's guard goes up.

Then demo Lab 1 end to end, fast, so everyone has seen the destination.

### 12–25 · Lab 1 — Findings to Merge Request

Circulate. The teaching moment is **step 3, reviewing the diff** — not the agent making
the edit. Push people to check whether it chose the lowest fixed version or just the
newest.

Expect roughly 20% to get a different-but-valid diff. Say so in advance and frame it as
normal.

The closing line of the section — *"notice how much of that prompt is not fix the
vulnerability"* — is the setup for Lab 2. Say it out loud even if the room is behind.

### 25–37 · Lab 2 — Turn that prompt into an agent

The most important lab. It converts a demo into a standard.

Two points to land explicitly:

- `preToolUse` command hooks are fail-closed on crash or non-zero exit.
- **Timeouts always fail open.** So this is a guardrail, not a control. Say it out loud.
  Someone will otherwise put it in a compliance document.

Attendees must start a **new session** for the hook to load. This is the most common
stumble in this lab.

**Do not let anyone skip step 5.** Fixing `lodash` with a single-line prompt is the payoff
for the whole lab; without it the session reads as filling in config for its own sake. Ask
the room to compare that one line against the Lab 1 prompt still in their scrollback.

Reference answers: [solutions/lab2/](../solutions/lab2/).

### 37–52 · Lab 3 — Run the agent in a GitLab runner

This is where the prompt itself is the lesson. The Lab 3 step 3 prompt names the binary,
every flag, both environment variables and the failure behaviour — and it says so. If
anyone's pipeline came back without `--agent security-reviewer`, that is the demonstration,
not a failure: the flags an agent omits are the ones you did not name.

The one worth stopping the room for is `GITHUB_COPILOT_PROMPT_MODE_REPO_HOOKS`. Without
it, repository hooks do not load in prompt mode and the guardrail they built in Lab 2
silently does nothing in CI. A guardrail that fails quiet is worse than no guardrail.

Step 6 is the plumbing tax — see [plumbing-tax.md](plumbing-tax.md). You run
`copilot-remediate` for real; they watch and annotate. Nobody in the room will have a
fine-grained PAT with Copilot Requests set up, so do not plan for them to run it.

Reference answer: [solutions/lab3/.gitlab-ci.yml](../solutions/lab3/.gitlab-ci.yml). The
fully annotated version is [ci/copilot-remediate.gitlab-ci.yml](../ci/copilot-remediate.gitlab-ci.yml).

### Stretch goal — Dockerfile hardening

For fast finishers only, at the end of the lab guide. It exists to absorb the spread
between the quickest and slowest tables; do not let it become the main event.

Reference answer: [solutions/stretch/Dockerfile](../solutions/stretch/Dockerfile). The
review catch is that an agent will happily pin `node:22-slim` and call that "pinned" —
a tag is not a pin. Ask whoever claims to be done what happens when they rebuild in six
months.

Two things in the reference are deliberately beyond the four the prompt asks for, and are
worth mentioning if anyone gets there: `src/config.js` defaults the host to `127.0.0.1`,
so the container is unreachable regardless of `EXPOSE` and `-p` unless the CMD overrides
it; and read-only rootfs, dropped capabilities and `no-new-privileges` are *runtime* flags
that belong to whoever deploys the image. Hardening a Dockerfile is not the same as
hardening a container.

### 52–60 · Governance and close

End on **their** control story, not your platform story. This segment also absorbs an
overrun gracefully.

| Control | Where |
| --- | --- |
| Enterprise managed settings for agents | Copilot admin |
| MCP allowlists (`allowedMcpServers` / `deniedMcpServers`) | MDM / managed settings |
| Machine-wide policy hooks, root-owned, cannot be disabled | `/etc/github-copilot/policy.d/` |
| Local sandboxing | `sandbox.enabled`, or `/sandbox enable` |
| Copilot audit log events | Enterprise settings |
| Blocking `--allow-all` escalation | `permissions.disableBypassPermissionsMode` |

Then the ask, from [plumbing-tax.md](plumbing-tax.md).

---

## Design decisions worth knowing

**No MCP server.** The labs use `glab` through the shell rather than a GitLab MCP server.
One less moving part, no dependency on the customer's MCP allowlist policy, and it works
identically against a self-managed instance. If they ask, that is the answer.

**Node for the hook, not jq.** Copilot CLI already requires Node 22, so the hook has zero
additional dependencies and behaves the same on macOS, Linux and Windows. jq is not on
everyone's laptop.

**Scanner-agnostic by design.** Everything downstream consumes `findings.json`. If the
customer turns out to have GitLab Ultimate, swap the scanner step for their existing
Dependency Scanning report and the rest of the workshop is unchanged.

---

## Verify before you deliver

The full tracked list lives in [TODO.md](../TODO.md). The items below are the ones that
change what you say in the room.

### Must confirm with the customer's Copilot administrator

1. **`permissions.disableBypassPermissionsMode`** — if set to `"disable"`, all
   `--allow-all*` flags are suppressed at startup and the capstone job breaks. Check first.
2. **PAT lifetime policy** — organisations can enforce a maximum expiry. This sets the
   rotation cadence they would inherit, and it is a number worth having.
3. **Seat semantics for CI.** The capstone runs on a named individual's Copilot seat and
   consumes their AI credits, because only user-owned fine-grained PATs can carry the
   "Copilot Requests" permission. Confirm the acceptable pattern with GitHub before
   recommending this in a customer's pipeline.

### Must verify in a dry run

4. **Do repo-level hooks load in the Copilot App?** The hooks reference documents Copilot
   CLI and cloud agent explicitly; the App is not named. If the App does not support them,
   run Lab 2 in the CLI. **Decide this before writing the final attendee handout.**
5. **Does the runner image build behind their proxy?** It pulls releases from github.com
   and gitlab.com. They may need an internal mirror.
6. **Bubblewrap availability** if you intend to demo local sandboxing inside a container.

### Logistics

7. **Where does the lab repo live?** Preferred: a sandbox group on their GitLab, one fork
   per attendee. You need permission to create it — confirm early, it has a lead time.
8. **Attendee roles.** If GitLab platform ownership is attending, reframe the capstone as
   described in [plumbing-tax.md](plumbing-tax.md).
9. **Pin the model.** Set `COPILOT_MODEL` in the handout so the room converges.

---

## If you run out of time

Cut in this order:

1. The Dockerfile hardening stretch goal
2. Lab 3 step 5, push-and-watch — reviewing the pipeline against the reference is the
   lesson, shipping it is not
3. Governance table — hand it out instead

**Never cut Lab 2, and never cut Lab 3 step 6.** The agent and the plumbing tax are the
two segments that are still being talked about next week.

Do not cut Lab 2 to protect Lab 3: Lab 3 calls the agent Lab 2 builds, so losing Lab 2
leaves the pipeline pointing at an agent that does not exist.
