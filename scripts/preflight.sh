#!/usr/bin/env bash
# Preflight check for the DevSecOps + Copilot App workshop.
# Run this at least 48 hours before the session. Every check must pass.
#
#   GITLAB_HOST=https://gitlab.internal.example.com ./scripts/preflight.sh
#
# Windows attendees: run this inside WSL.

set -uo pipefail

PASS=0
FAIL=0

ok()   { printf '  [ OK ]  %s\n' "$1"; PASS=$((PASS + 1)); }
bad()  { printf '  [FAIL]  %s\n' "$1"; FAIL=$((FAIL + 1)); }
note() { printf '          %s\n' "$1"; }
head_() { printf '\n%s\n' "$1"; }

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

head_ "1. Toolchain"

if command -v node >/dev/null 2>&1; then
  NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
  if [ "$NODE_MAJOR" -ge 22 ]; then
    ok "node $(node -v)"
  else
    bad "node $(node -v) is too old — Copilot CLI requires Node 22 or later"
  fi
else
  bad "node is not installed (Node 22+ required)"
fi

command -v git >/dev/null 2>&1 && ok "git $(git --version | awk '{print $3}')" || bad "git is not installed"

if command -v copilot >/dev/null 2>&1; then
  ok "copilot $(copilot --version 2>/dev/null | head -n1)"
else
  bad "copilot is not installed"
  note "npm install -g @github/copilot"
fi

if command -v glab >/dev/null 2>&1; then
  ok "glab $(glab --version 2>/dev/null | head -n1)"
else
  bad "glab is not installed"
  note "https://gitlab.com/gitlab-org/cli/-/releases"
fi

if command -v osv-scanner >/dev/null 2>&1; then
  ok "osv-scanner $(osv-scanner --version 2>/dev/null | head -n1)"
else
  bad "osv-scanner is not installed"
  note "brew install osv-scanner"
  note "or https://github.com/google/osv-scanner/releases"
fi

head_ "2. Network path"

if [ -n "${HTTPS_PROXY:-${https_proxy:-}}" ]; then
  note "proxy detected: ${HTTPS_PROXY:-$https_proxy}"
fi

if curl -fsS --max-time 20 -o /dev/null https://api.githubcopilot.com 2>/dev/null; then
  ok "reachable: api.githubcopilot.com"
else
  # A non-2xx status still proves the network path is open.
  if curl -sS --max-time 20 -o /dev/null -w '%{http_code}' https://api.githubcopilot.com 2>/dev/null | grep -qE '^[0-9]{3}$'; then
    ok "reachable: api.githubcopilot.com (non-2xx response, path is open)"
  else
    bad "cannot reach api.githubcopilot.com"
    note "this is the most common failure — check the corporate proxy allowlist"
  fi
fi

if [ -z "${GITLAB_HOST:-}" ]; then
  bad "GITLAB_HOST is not set"
  note "export GITLAB_HOST=https://gitlab.your-company.example"
else
  if curl -fsS --max-time 20 -o /dev/null "$GITLAB_HOST" 2>/dev/null; then
    ok "reachable: $GITLAB_HOST"
  else
    bad "cannot reach $GITLAB_HOST"
  fi
fi

# `npm ping` 404s against some registry configurations even when the registry is fine.
# Fetch metadata for the exact version Lab 1 installs instead.
if npm view minimist@1.2.6 version >/dev/null 2>&1; then
  ok "npm registry reachable"
else
  bad "cannot fetch package metadata from the npm registry"
  note "Lab 1 verifies its fix by installing minimist@1.2.6 — this must work"
  note "if you use an internal mirror, set it in your .npmrc"
fi

head_ "3. Authentication"

if command -v copilot >/dev/null 2>&1; then
  COPILOT_OUT="$(copilot -p 'Reply with exactly: PREFLIGHT_OK' -s --no-ask-user 2>&1)"
  if printf '%s' "$COPILOT_OUT" | grep -q 'PREFLIGHT_OK'; then
    ok "Copilot authenticated and answering prompts"
  else
    bad "Copilot could not complete a prompt"
    note "run 'copilot login', or set COPILOT_GITHUB_TOKEN"
    note "first line of output: $(printf '%s' "$COPILOT_OUT" | head -n1)"
  fi
fi

if command -v glab >/dev/null 2>&1 && [ -n "${GITLAB_HOST:-}" ]; then
  if glab auth status >/dev/null 2>&1; then
    ok "glab authenticated to $GITLAB_HOST"
  else
    bad "glab is not authenticated"
    note "glab auth login --hostname \"\${GITLAB_HOST#https://}\""
  fi
fi

head_ "4. Lab application"

if [ -d "$REPO_ROOT/lab-app" ]; then
  if (cd "$REPO_ROOT/lab-app" && npm install --no-audit --no-fund >/dev/null 2>&1); then
    ok "lab-app dependencies install"
    if (cd "$REPO_ROOT/lab-app" && npm test >/dev/null 2>&1); then
      ok "lab-app test suite passes"
    else
      bad "lab-app test suite fails before any changes are made"
    fi
  else
    bad "npm install failed in lab-app"
  fi
else
  bad "lab-app directory not found at $REPO_ROOT/lab-app"
fi

# Presence of the binary proves nothing. A scanner blocked by TLS interception still
# exits cleanly enough to write a valid, EMPTY report - which reads downstream as
# "no findings" rather than "the scan never happened". Assert it returns real results.
if command -v osv-scanner >/dev/null 2>&1 && [ -d "$REPO_ROOT/lab-app" ]; then
  SCAN_TMP="$(mktemp)"
  # Run exactly what Lab 1 step 1 runs, from the same directory. Scanning lab-app/
  # directly would pass here while the lab's own command finds nothing, which is the
  # one failure preflight exists to catch.
  (cd "$REPO_ROOT" && osv-scanner --format json --output-file "$SCAN_TMP" -r ./ >/dev/null 2>&1)
  SCAN_EXIT=$?

  VULN_COUNT="$(node -e "
    try {
      const r = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
      console.log((r.results || [])
        .flatMap(s => s.packages || [])
        .flatMap(p => p.vulnerabilities || []).length);
    } catch { console.log(0); }
  " "$SCAN_TMP" 2>/dev/null)"

  # 0 = clean, 1 = vulnerabilities found. Anything else is a broken scanner.
  if [ "$SCAN_EXIT" -ne 0 ] && [ "$SCAN_EXIT" -ne 1 ]; then
    bad "osv-scanner failed to run (exit $SCAN_EXIT)"
    note "most likely TLS interception by a corporate proxy blocking api.osv.dev"
  elif [ "${VULN_COUNT:-0}" -gt 0 ]; then
    ok "osv-scanner resolves advisories ($VULN_COUNT found in lab-app)"
  else
    bad "osv-scanner returned ZERO results for a project that is expected to have them"
    note "the scan appeared to succeed but returned an empty report"
    note "this is almost always TLS interception — check certificate trust for api.osv.dev"
  fi

  rm -f "$SCAN_TMP"
fi

head_ "Summary"
printf '  %s passed, %s failed\n\n' "$PASS" "$FAIL"

if [ "$FAIL" -gt 0 ]; then
  printf 'Preflight FAILED. Send this output to the workshop facilitator.\n'
  exit 1
fi

printf 'Preflight passed. You are ready for the workshop.\n'
