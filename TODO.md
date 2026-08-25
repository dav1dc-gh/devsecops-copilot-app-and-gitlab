# TODO — open items before delivery

Tracking every unresolved assumption, unverified pin, and logistics dependency for the
DevSecOps + Copilot App workshop. Nothing here is cosmetic; each item either blocks
delivery or changes content.

Last updated: 2026-08-25

---

## P0 — Blocks delivery

- [ ] **`permissions.disableBypassPermissionsMode`** — if the customer's enterprise or MDM
      policy sets this to `"disable"`, every `--allow-all*` flag is suppressed at startup.
      The capstone job and parts of Lab 1 break.
      *Owner: customer Copilot admin. Resolve before writing the final handout.*

- [ ] **Do repo-level hooks load in the Copilot App?** The hooks reference names Copilot CLI
      and cloud agent explicitly; the App is **not** listed. If unsupported, Lab 3 must run
      in the CLI and the attendee handout changes.
      *Resolve by dry run. This is the single item most likely to force a rewrite.*

- [ ] **Lab repo hosting.** Need a sandbox group on their on-prem GitLab with permission to
      create one project per attendee fork. Has procurement/approval lead time.
      *Fallback: gitlab.com free group, or tarball + local bare remote (loses the MR moment).*

- [ ] **Seat semantics for agents in CI.** The capstone runs on a named individual's Copilot
      seat and consumes their AI credits, because only user-owned fine-grained PATs can
      carry the "Copilot Requests" permission. Confirm the acceptable pattern with GitHub
      before recommending this in a customer pipeline.

---

## P1 — Verify in dry run

- [ ] **Runner image builds behind their proxy.** [ci/copilot-runner.Dockerfile](ci/copilot-runner.Dockerfile)
      pulls releases from github.com and gitlab.com. They may need internal mirrors.

- [ ] **Capstone pipeline has never been executed end to end.** It is syntax-valid and the
      flags are documented, but it has not run against a real GitLab instance.
      *Do a full run before demoing it live.*

- [ ] **Pinned tool versions in the runner image are unverified placeholders.**
      Confirm each exists and is current, then update:
      | ARG | Current value | Verified? |
      | --- | --- | --- |
      | `COPILOT_CLI_VERSION` | `1.0.80` | **yes** — `npm view @github/copilot version` |
      | `GLAB_VERSION` | `1.48.0` | no |
      | `GITLEAKS_VERSION` | `8.21.2` | no |
      | `OSV_SCANNER_VERSION` | `2.5.1` | **yes** — confirmed in dry run |

- [ ] **osv-scanner 2.x release asset naming.** The Dockerfile and Lab 2 solution download
      `osv-scanner_linux_amd64`. That path was correct for 1.x; confirm it for 2.5.1, which
      also ships an `osv-scalibr` component.

- [ ] **TLS interception breaks osv-scanner.** Reproduced locally: certificate verification
      against `api.osv.dev` fails behind a TLS-inspecting proxy
      (`x509: OSStatus -26276`). Highly likely on the customer's managed laptops.
      **Preflight now detects this** by asserting a real scan returns findings.
      *Remaining: pre-seed an offline vulnerability database in the runner image, and
      document offline flags as an attendee fallback.*

- [ ] **`glab` release tarball URL format** used in the Dockerfile and Lab 2 solution is
      unverified against the actual release asset naming.

- [ ] **OSV-Scanner JSON schema.** ~~The capstone's early-exit check uses
      `.results[]?.packages[]?.vulnerabilities[]?`.~~ **Verified against real output in the
      Lab 1 dry run — the path is correct.** Remaining work: none.

- [ ] **npm registry / internal mirror** reachable from both attendee laptops and runners.
      Lab 1 verifies its fix by installing a patched version, so this is not optional.

- [ ] **Scanner vulnerability DB seeding** through the proxy. Pre-bake into the image if
      first-run downloads are blocked.

- [ ] **Bubblewrap availability** — only if you intend to demo local sandboxing inside a
      container during the governance segment.

---

## P2 — Open inputs that change content

- [ ] **GitLab tier.** Labs assume no Ultimate SAST/Dependency Scanning. If they have
      Ultimate, swap the scanner step to consume their existing report — everything
      downstream reads `findings.json`, so the rest is unchanged.

- [ ] **Audience makeup.** Written for app developers. A platform/DevSecOps audience wants
      Lab 3 and the capstone expanded, Labs 1–2 compressed.

- [ ] **Attendee roles.** If GitLab platform ownership is in the room, reframe the capstone
      as *"here's what your platform team is carrying"* rather than *"here's what's
      missing."* See [docs/plumbing-tax.md](docs/plumbing-tax.md).

- [ ] **Pin the model.** Set `COPILOT_MODEL` in the attendee handout so the room converges
      on similar output.

- [ ] **GitLab Duo.** If they have it, expect direct comparison questions. Prepare the
      differentiation deliberately rather than improvising in the room.

---

## P3 — Comms, before the invite goes out

- [ ] **Correct the cloud agent record with the account team.** The prior customer
      conversation covered Copilot cloud agents. Cloud agent only works on GitHub-hosted
      repos, and this customer has none. If the abstract promises it, the workshop cannot
      deliver and the room is lost in the first ten minutes.

- [ ] **Drop "free security scanning" language.** Free applies to public repos; for their
      private code it is licensed. Saying "free" to an enterprise is a credibility hit.

---

## Deliberately excluded — do not add without re-checking

| Item | Why it's out |
| --- | --- |
| Copilot cloud agent | Only works on GitHub-hosted repositories |
| Copilot automations, `@copilot` on PRs | Same dependency |
| GHAS code scanning / secret scanning / Dependabot | Not licensed |
| Copilot code review | Operates on GitHub PRs |
| `--share-gist` | Publishes session transcripts to a GitHub gist — exfiltration path under their policy |
| Cloud sandbox (`copilot --cloud`) | Public preview; GitLab auth from inside it is unproven |
| Copilot Memory | Documented for Pro/Pro+/Max; they are likely Business/Enterprise |
| GitLab MCP server | Dropped in favour of `glab` via shell — removes a dependency on their MCP allowlist policy |

---

## Resolved

- [x] **Preflight gaps closed (2026-08-25).** It did not check for `osv-scanner` at all —
      the very first command in Lab 1. Now checks presence *and* runs a real scan asserting
      findings are returned. Also replaced an unreliable `npm ping` (404s against some
      registry configs while installs work fine) with a lookup of `minimist@1.2.6`, the
      exact package Lab 1 installs.
- [x] **Lab 1 walked through end to end (2026-08-25).** Scanner produces 2 packages /
      5 vulnerabilities (1 Critical, 2 High, 2 Medium). `minimist` 1.2.5 at CVSS 9.8 is the
      unambiguous target; bumping to 1.2.6 clears the Critical and all 6 tests still pass.
      Lab design confirmed sound.
- [x] **Silent-failure hole in the capstone — fixed.** A scanner network/TLS error writes a
      valid but empty `findings.json`; the old `|| true` plus length check would have
      exited green having done nothing. Now guarded on the scanner's exit code (0 = clean,
      1 = findings, anything else = hard fail).
- [x] **`--output` is deprecated** in favour of `--output-file`. Updated everywhere.
- [x] **OSV JSON path verified** — `.results[].packages[].vulnerabilities[]` is correct.
- [x] **Headless Copilot CLI auth in CI** — supported and documented. User-owned
      fine-grained PAT with "Copilot Requests", via `COPILOT_GITHUB_TOKEN`. Classic PATs
      not supported, org-owned tokens cannot carry the permission.
- [x] **`preToolUse` hook contract** — `permissionDecision` on stdout; fail-closed on crash
      and non-zero exit, **fail-open on timeout** (so it is a guardrail, not a control).
- [x] **GitLab deployment model** — confirmed on-premise/self-managed.
