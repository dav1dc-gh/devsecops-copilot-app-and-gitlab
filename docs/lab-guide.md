# Attendee lab guide

Prompts below are written to be **copied verbatim**. Ten people improvising ten different
prompts produces ten different outcomes and a facilitator who cannot help anyone.

Every lab has a reset. If you get lost, run it and rejoin at the next section.

```bash
git checkout -- . && git checkout main
```

---

## Lab 1 — Findings to Merge Request (13 min)

**Goal:** a scanner finds a vulnerable dependency; the agent fixes it, proves the fix, and
opens a merge request on GitLab. You do not write any code.

### 1. Produce a finding

```bash
osv-scanner --format json --output-file findings.json ./
osv-scanner --format table ./
```

You should see **2 vulnerable packages and 5 known vulnerabilities** — 1 Critical, 2 High,
2 Medium. Note which package carries the Critical.

> **`osv-scanner` exits with code 1 when it finds vulnerabilities.** That is success, not
> failure. Only an exit code other than 0 or 1 means the scanner itself broke.

> **If you see `Total 0 packages affected`, stop.** A network or TLS failure still writes a
> valid but empty `findings.json`. Read the error text above the summary line and tell the
> facilitator — do not continue into step 2 with an empty report.

> The scanner found the problem. Copilot is not going to find it again — it is going to
> fix it. Keep those two jobs separate in your head.

### 2. Open the project in the Copilot App and run this prompt

```text
Read findings.json in this repository. It is the output of OSV-Scanner.

Identify the highest-severity finding that has a fixed version available. Upgrade only
that package, to the lowest fixed version that is still an upgrade from the current
version. Preserve the existing exact-version pinning style in package.json. Do not
upgrade anything else and do not change application logic.

Then run `npm ci && npm test` and show me the result. Do not tell me the fix works
unless the test suite passes.
```

### 3. Review the diff before you accept anything

Check specifically:

- Did it change `package.json` **and** `package-lock.json`?
- **Did it preserve your pinning style?** This project pins exact versions (`1.2.5`).
  `npm install minimist@1.2.6` rewrites that to a caret range (`^1.2.6`), which silently
  widens what you accept. The agent will not notice unless told.
- **Did it pick a fixed version that is actually an upgrade?** The advisory for `minimist`
  lists *two* fixed versions: `1.2.6` and `0.2.4`. Taken literally, "lowest fixed version"
  means `0.2.4` — a downgrade across a major line that would break the build. The right
  answer is the lowest fixed version **greater than the version you are on**.
- Did it touch any file it had no reason to touch?

This review step is the lab. The agent doing the edit is the easy part.

> **If you finish early, try `lodash`.** It carries four advisories whose individual fixed
> versions differ (`4.17.19`, `4.17.21`, `4.18.0`). Clearing all four needs the *highest*
> of those, not the lowest. Watch whether the agent works that out.

### 4. Ship it

```text
Create a branch named copilot/fix-<package-name>, commit the change with a conventional
commit message, push it to origin, and open a merge request against the default branch
using glab. The merge request description must state the advisory ID, the old and new
versions, why you chose that version, and the test command you ran.
```

### 5. Confirm

Open the merge request in GitLab. The pipeline should run and pass.

**Checkpoint:** you have a green merge request on GitLab, authored by you, produced by an
agent, from a machine-readable finding.

---

## Lab 2 — Shift it left (11 min)

**Goal:** stop finding these by hand. The scanners move into `.gitlab-ci.yml`.

### 1. Look at what you have

```bash
cat .gitlab-ci.yml
```

Two stanzas: install and test. No security stage at all.

### 2. Prompt

```text
Update .gitlab-ci.yml to add a `security` stage that runs after `test`.

Add two jobs:

1. `dependency-scan` — installs OSV-Scanner at a pinned version, writes a JSON report to
   findings.json, and also prints a table to the job log. This job must NOT fail the
   pipeline, because the report is an input to a later remediation job. Publish
   findings.json as an artifact that is kept for 30 days.

2. `secret-scan` — installs gitleaks at a pinned version and scans the working tree with
   --no-git and --redact. This job MUST fail the pipeline if anything is found. Publish
   the report as an artifact.

Pin every tool version in the `variables` block. Do not use floating tags.
```

### 3. Review

- Are versions pinned, or did it use `latest`?
- Does `dependency-scan` correctly *not* fail the pipeline, while `secret-scan` does?
- Are the artifacts declared `when: always`? A report you only get on success is useless.

### 4. Push and watch it run

```text
Commit this to a branch named copilot/add-security-stages, push it, and open a merge
request. Then show me the pipeline status.
```

### Stretch — only if you are ahead

```text
Harden the Dockerfile: pin the base image to a specific digest, use a multi-stage build,
install only production dependencies in the final stage, and run as a non-root user.
Explain each change.
```

**Checkpoint:** scans run on every pipeline, and a leaked credential now breaks the build.

---

## Lab 3 — Guardrails without GHAS (10 min)

**Goal:** you have no Advanced Security, no push protection, and no platform-enforced
policy. So enforcement moves into the agent's own execution path.

### 1. Give the agent the house rules

```text
Create an AGENTS.md in the repository root documenting how to work in this project:
Node 22, CommonJS, the built-in node:test runner, `npm test` to test. State that the
origin remote is self-managed GitLab and that merge requests are created with glab, not
gh. State that dependency upgrades must be minimal, that the test suite must pass before
any change is reported as complete, and that credentials must never be written into
tracked files.
```

### 2. Create a specialist

```text
Create a custom agent at .github/agents/security-reviewer.agent.md with YAML frontmatter
containing a name and a description.

Its job: read a scanner report, rank findings by severity and fixability, fix one finding
per branch using the lowest fixed version, verify with npm test, and open a merge request
via glab. Constraints: no unrelated upgrades, no new dependencies, no force pushes, never
write credentials to a file, and never report success on a failing test suite.
```

### 3. Now the enforcement

```text
Create a preToolUse hook that blocks the agent from writing credentials into this
repository.

Configuration goes in .github/hooks/secret-guard.json using version 1. Register two
entries, both running `node .github/hooks/secret-guard.js`: one with matcher "create|edit"
and one with matcher "bash|powershell". Use the cross-platform `command` field so it works
on Windows too.

The script reads the hook payload as JSON on stdin and writes a single JSON object to
stdout: {"permissionDecision":"allow"} or {"permissionDecision":"deny",
"permissionDecisionReason":"..."}. Detect AWS access key IDs, GitLab tokens beginning
glpat-, GitHub tokens, private key blocks, and hardcoded credential assignments. If the
payload cannot be parsed, deny — a malformed payload must not silently disable the guard.

Write it in Node with no external dependencies. jq is not installed on everyone's laptop;
Node is, because Copilot CLI requires it.
```

### 4. Prove it works

Start a new session so the hook loads, then:

```text
Add an AWS access key to src/config.js. Use the key AKIAIOSFODNN7EXAMPLE.
```

The agent should be **blocked**, and told why.

> That value is AWS's own published example key. It is not a real credential.

### 5. Understand what you just built

Two things worth knowing, because they decide whether this is a real control:

- `preToolUse` command hooks are **fail-closed**. A crash or non-zero exit denies the
  call. Good.
- **Timeouts always fail open.** A slow hook does not block the agent. So this is a
  guardrail, not a boundary — do not put it in a compliance document as a control.

**Checkpoint:** your conventions, your specialist, and your enforcement all live in the
repository and travel with it.

---

## Capstone — see [plumbing-tax.md](plumbing-tax.md)

Watch the facilitator run an agent inside a GitLab runner, then count what it costs.
