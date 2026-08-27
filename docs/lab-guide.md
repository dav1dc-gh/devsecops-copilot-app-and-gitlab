# Attendee lab guide

Prompts below are written to be **copied verbatim**. Ten people improvising ten different
prompts produces ten different outcomes and a facilitator who cannot help anyone.

The three labs build on each other:

1. **Do it by hand.** One long, careful prompt, and you review everything.
2. **Capture it.** Turn that prompt into an agent, so the next person types one line.
3. **Automate it.** Call that same agent from a GitLab runner with nobody driving.

Every lab has a reset. If you get lost, run it and rejoin at the next section.

```bash
git checkout -- . && git checkout main
```

---

## Lab 1 — Findings to Merge Request (13 min)

**Goal:** a scanner finds a vulnerable dependency; the agent fixes it, proves the fix, and
opens a merge request on GitLab. You do not write any code.

### 1. Produce a finding

From the repository root:

```bash
osv-scanner --format json --output-file findings.json -r ./
osv-scanner --format table -r ./
```

You should see **2 vulnerable packages and 5 known vulnerabilities** — 1 Critical, 2 High,
2 Medium. Note which package carries the Critical.

> **`-r` is not optional.** `osv-scanner ./` scans only the directory you point it at, and
> the application is one level down in `lab-app/`. Without `-r` it reports
> `No package sources found` and **exits 0** — a clean pass over nothing at all.

> **`osv-scanner` exits with code 1 when it finds vulnerabilities.** That is success, not
> failure. Only an exit code other than 0 or 1 means the scanner itself broke.

> **If you see `Total 0 packages affected` or `No package sources found`, stop.** Two very
> different things produce that: a missing `-r`, or a network or TLS failure that still
> writes a valid but empty `findings.json`. Read the error text above the summary line and
> tell the facilitator — do not continue into step 2 with an empty report.

> The scanner found the problem. Copilot is not going to find it again — it is going to
> fix it. Keep those two jobs separate in your head.

### 2. Open the project in the Copilot App and run this prompt

```text
Read findings.json in the root of this repository. It is the output of OSV-Scanner.
The application itself lives in the lab-app/ directory.

Identify the highest-severity finding that has a fixed version available. Upgrade only
that package, to the lowest fixed version that is still an upgrade from the current
version. Preserve the existing exact-version pinning style in lab-app/package.json. Do
not upgrade anything else and do not change application logic.

Then run `cd lab-app && npm ci && npm test` and show me the result. Do not tell me the
fix works unless the test suite passes.
```

Notice how much of that prompt is not "fix the vulnerability". It is *where things live*,
*which version to choose*, *what not to touch*, and *how to prove it*. Hold that thought —
it is what Lab 2 is about.

### 3. Review the diff before you accept anything

Check specifically:

- Did it change `lab-app/package.json` **and** `lab-app/package-lock.json`?
- **Did it preserve your pinning style?** This project pins exact versions (`1.2.5`).
  `npm install minimist@1.2.6` rewrites that to a caret range (`^1.2.6`), which silently
  widens what you accept. The agent will not notice unless told.
- **Did it pick a fixed version that is actually an upgrade?** The advisory for `minimist`
  lists *two* fixed versions: `1.2.6` and `0.2.4`. Taken literally, "lowest fixed version"
  means `0.2.4` — a downgrade across a major line that would break the build. The right
  answer is the lowest fixed version **greater than the version you are on**.
- Did it touch any file it had no reason to touch?

This review step is the lab. The agent doing the edit is the easy part.

> **Leave `lodash` alone for now.** You will need a second live finding in Lab 2.

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

## Lab 2 — Turn that prompt into an agent (12 min)

**Goal:** Lab 1 worked because *you* wrote a careful prompt and *you* reviewed the result.
Neither of those scales. This lab moves that expertise out of your head and into files
that live in the repository, so the next person gets the same outcome by typing one line.

You will build three things:

- **Project conventions** every agent session picks up automatically
- **A `security-reviewer` agent** anyone on the team can summon by name
- **A guardrail** that stops credentials being written into the code

### 1. Give every session the house rules

```text
Create an AGENTS.md in the repository root documenting how to work in this project:
Node 22, CommonJS, the built-in node:test runner, the application lives in lab-app/, and
`cd lab-app && npm test` runs the tests. State that the origin remote is self-managed
GitLab and that merge requests are created with glab, not gh. State that dependency
upgrades must be minimal and must preserve exact-version pinning, that the test suite
must pass before any change is reported as complete, and that credentials must never be
written into tracked files.
```

That file is loaded automatically in every session, by every agent, for everyone who
clones the repo. Every line in it is something you had to say by hand in Lab 1.

### 2. Create the specialist

```text
Create a custom agent at .github/agents/security-reviewer.agent.md with YAML frontmatter
containing a name and a description.

Its job: read a scanner report, rank findings by severity and fixability, fix one finding
per branch using the lowest fixed version that is still an upgrade, verify with the
project's test command, and open a merge request via glab whose description states the
advisory ID, the version change, and the verification command.

Constraints: no unrelated upgrades, no new dependencies, no force pushes, never write
credentials to a file, and never report success on a failing test suite.
```

### 3. Now the guardrail

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

### 4. Prove the guardrail works

Start a new session so the hook loads, then:

```text
Add an AWS access key to lab-app/src/config.js. Use the key AKIAIOSFODNN7EXAMPLE.
```

The agent should be **blocked**, and told why.

> That value is AWS's own published example key. It is not a real credential.

### 5. Now collect the payoff

Refresh the report so it reflects the fix you already shipped:

```bash
osv-scanner --format json --output-file findings.json -r ./
```

Start a fresh session with the `security-reviewer` agent selected — in the Copilot App
that is the agent picker; on the CLI it is `copilot --agent security-reviewer`.

Then type this, and nothing else:

```text
Remediate the highest-severity remaining finding in findings.json.
```

`lodash` is still vulnerable, so there is real work to do. Compare what you just typed to
the prompt you pasted in Lab 1. The knowledge did not disappear — it moved into
`AGENTS.md` and the agent file, where it is version-controlled, reviewable, and identical
for everyone on the team.

> `lodash` carries four advisories whose individual fixed versions differ (`4.17.19`,
> `4.17.21`, `4.18.0`). Clearing all four needs the *highest* of those, not the lowest.
> Watch whether the agent works that out.

### 6. Understand what you just built

Two things worth knowing, because they decide how much weight this can carry:

- `preToolUse` command hooks are **fail-closed**. A crash or non-zero exit denies the
  call. Good.
- **Timeouts always fail open.** A slow hook does not block the agent. So treat this as a
  strong guardrail rather than a hard boundary — it belongs in your engineering standards,
  not in a compliance document as a control.

**Checkpoint:** your conventions, your specialist, and your enforcement all live in the
repository and travel with it. Anyone who clones this project inherits them.

---

## Lab 3 — Run the agent in a GitLab runner (15 min)

**Goal:** take the agent you just built and call it from CI, with nobody driving. Scanners
run on every pipeline, and the same `security-reviewer` agent opens the remediation merge
request.

### 1. Look at what you have

```bash
cat .gitlab-ci.yml
```

One stage, one test job. No security stage at all.

### 2. Add the scanners

```text
Update .gitlab-ci.yml to add a `security` stage that runs after `test`.

Add two jobs:

1. `dependency-scan` — installs OSV-Scanner at a pinned version, scans the repository
   recursively so it reaches the manifests in lab-app/, writes a JSON report to
   findings.json at the repository root, and also prints a table to the job log. This job
   must NOT fail the pipeline, because the report is an input to a later remediation job.
   Publish findings.json as an artifact that is kept for 30 days.

2. `secret-scan` — installs gitleaks at a pinned version and scans the working tree with
   --no-git and --redact. This job MUST fail the pipeline if anything is found. Publish
   the report as an artifact.

Pin every tool version in the `variables` block. Do not use floating tags. Declare every
artifact with `when: always`.
```

### 3. Now add the agent

This is the prompt that matters. Read it before you paste it, and notice that it names the
binary, the flags, the environment variables, and the failure behaviour. **An agent will
not guess your invocation.** Ask for "a job that runs Copilot" and you get somebody's idea
of a job that runs Copilot. Ask for this, and you get this.

```text
Add a `remediate` stage to .gitlab-ci.yml, after `security`, containing a single job
called `copilot-remediate`.

The job runs the security-reviewer agent from .github/agents/ using GitHub Copilot CLI in
non-interactive prompt mode. Specifically:

- image: node:22-bookworm-slim
- needs: the dependency-scan job, pulling in its findings.json artifact
- when: manual, and allow_failure: true — a human decides when this runs
- rules: never run on the default branch
- before_script: apt-get install git, curl and ca-certificates; install glab; then
  install @github/copilot at the version pinned in the variables block
- script: a single `copilot` invocation using these exact flags:
    -p with a one-line prompt telling the agent to remediate the highest-severity
       finding in findings.json and open a merge request
    --agent security-reviewer
    --no-ask-user
    --allow-tool 'shell(npm:*)' 'shell(git:*)' 'shell(glab:*)'
    --deny-tool 'write(.github/hooks/**)'
    --secret-env-vars COPILOT_GITHUB_TOKEN,GITLAB_TOKEN
    --share copilot-session.md
    -s
- variables: set GITHUB_COPILOT_PROMPT_MODE_REPO_HOOKS to "true" so the repository's
  preToolUse hooks load in prompt mode, and set GITLAB_HOST from CI_SERVER_URL
- artifacts: publish copilot-session.md with when: always, so the session transcript is
  auditable

COPILOT_GITHUB_TOKEN and GITLAB_TOKEN come from masked, protected CI/CD variables. Do not
write either value into the file. Add a comment above the job listing the CI/CD variables
that must be configured.
```

### 4. Review what you got

It does not have to look like anyone else's. Check all six of these:

| Check | Why it matters |
| --- | --- |
| `--agent security-reviewer` is present | Without it you are running the default agent, and Lab 2 bought you nothing |
| `--no-ask-user` is present | The CLI can otherwise block forever waiting for input nobody will type |
| `GITHUB_COPILOT_PROMPT_MODE_REPO_HOOKS: "true"` is set | Repository hooks are **not** loaded in prompt mode without it. Your guardrail would silently do nothing |
| `--secret-env-vars` lists both tokens | Only `COPILOT_GITHUB_TOKEN` is redacted by default. `GITLAB_TOKEN` is not |
| No token value appears in the file | It belongs in a masked, protected CI/CD variable |
| `when: manual` | An agent that opens merge requests unattended on every push is a bad first production step |

> If your result missed several of these, that is the lesson, not a failure. Go back and
> read your prompt: the flags it left out are the ones you did not name.

### 5. Ship it

```text
Commit this to a branch named copilot/add-security-pipeline, push it, and open a merge
request. Then show me the pipeline status.
```

`dependency-scan` and `secret-scan` run on their own. `copilot-remediate` sits there
waiting for someone to press play — which is the point.

### 6. The plumbing tax

Your facilitator will run `copilot-remediate` for real. Watch what it takes to get there,
because this is the part nobody puts in the demo:

- **The token must be a fine-grained personal access token** owned by a *personal* account,
  carrying the **Copilot Requests** permission. Classic PATs do not work. There is no
  organisation token and no service-account path.
- So **CI runs on a named human's seat and spends their AI credits.** Every merge request
  the pipeline opens is attributed to someone who was not at their desk.
- `glab` needs its own credential, with permission to push branches and open merge
  requests on the project.
- If enterprise policy sets `permissions.disableBypassPermissionsMode`, the allow-all
  flags are suppressed and a naive CI job hangs or fails.

None of that is hard. All of it is procurement, identity and audit — and it is where these
projects actually stall.

**Checkpoint:** scans run on every pipeline, a leaked credential breaks the build, and the
agent you built in Lab 2 is one button press away from opening the fix.

---

## Stretch — only if you are ahead

```text
Harden lab-app/Dockerfile: pin the base image to a specific digest, use a multi-stage
build, install only production dependencies in the final stage, and run as a non-root
user. Explain each change.
```
