# Preflight — run this at least 48 hours before the workshop

Nothing is installed during the session. If preflight has not passed, you will spend the
hour watching rather than building.

## 1. Install the toolchain

| Tool | Why | Install |
| --- | --- | --- |
| Node.js 22+ | Required by Copilot CLI | https://nodejs.org |
| GitHub Copilot App | The primary surface for Labs 1–3 | Your usual internal software channel |
| Copilot CLI | Used for the hook lab and the capstone | `npm install -g @github/copilot` |
| `glab` | Creates merge requests on your GitLab instance | https://gitlab.com/gitlab-org/cli/-/releases |
| `git` | — | — |

Windows: run the preflight script inside WSL.

## 2. Authenticate

```bash
copilot login
```

```bash
export GITLAB_HOST=https://gitlab.your-company.example
glab auth login --hostname "${GITLAB_HOST#https://}"
```

## 3. Fork and clone the lab project

Fork the workshop project into your own namespace on GitLab, then clone **your fork**.
You will be pushing branches, so you need write access.

```bash
git clone "$GITLAB_HOST/<your-username>/devsecops-copilot-lab.git"
cd devsecops-copilot-lab
```

## 4. Run the check

```bash
GITLAB_HOST=https://gitlab.your-company.example ./scripts/preflight.sh
```

Every line must read `[ OK ]`. Send the full output to the facilitator if anything fails.

## What preflight actually verifies

It deliberately exercises the real network path rather than checking that binaries exist:

- Node is 22 or later
- `api.githubcopilot.com` is reachable **through your corporate proxy**
- Your GitLab instance is reachable
- The npm registry is reachable — Lab 1 verifies its fix by installing a patched version
- Copilot can complete an actual prompt, not just report a version
- `glab` is authenticated to your instance
- The lab application installs and its tests pass **before** you change anything

## Known failure modes

| Symptom | Cause | Fix |
| --- | --- | --- |
| `cannot reach api.githubcopilot.com` | Proxy allowlist | Raise with your network team, quoting the hostname. This is the most common failure. |
| `Copilot could not complete a prompt` | Not logged in, or a stale `GH_TOKEN` in your shell | `copilot login`. Note that a `GH_TOKEN` set for another tool silently overrides your Copilot login. |
| `npm registry is not reachable` | Internal mirror not configured | Set your registry in `.npmrc`. |
| `glab is not authenticated` | Missing `GITLAB_HOST` | Export it, then re-run `glab auth login --hostname`. |
