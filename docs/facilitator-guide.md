# Facilitator guide

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

### 25–36 · Lab 2 — Shift it left

Watch for unpinned tool versions in the generated YAML — that is the review catch. The
Dockerfile stretch goal exists to absorb fast finishers; do not let it become the main
event.

### 36–46 · Lab 3 — Guardrails without GHAS

The most important lab. It converts a demo into a standard.

Two points to land explicitly:

- `preToolUse` command hooks are fail-closed on crash or non-zero exit.
- **Timeouts always fail open.** So this is a guardrail, not a control. Say it out loud.
  Someone will otherwise put it in a compliance document.

Attendees must start a **new session** for the hook to load. This is the most common
stumble in this lab.

Reference answers: [solutions/lab3/](../solutions/lab3/).

### 46–56 · Capstone

See [plumbing-tax.md](plumbing-tax.md). You demo, they annotate.

### 56–60 · Governance and close

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
   run Lab 3 in the CLI. **Decide this before writing the final attendee handout.**
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

1. Lab 2 stretch goal (Dockerfile hardening)
2. Lab 2 push-and-watch step
3. Governance table — hand it out instead

**Never cut Lab 3 or the capstone.** They are the two segments that are still being talked
about next week.
