#!/usr/bin/env bash
# Machine-wide policy hook. Loaded from /etc/github-copilot/policy.d/ before every other
# hook, and cannot be disabled by disableAllHooks or by repository configuration.
#
# preToolUse command hooks are fail-closed: if this script crashes or exits non-zero,
# the tool call is denied. Timeouts, however, fail open — keep this fast.
set -uo pipefail

PAYLOAD="$(cat)"
CMD="$(printf '%s' "$PAYLOAD" | jq -r '.toolArgs.command // .toolArgs // ""' 2>/dev/null)"

deny() {
  jq -cn --arg reason "$1" '{permissionDecision:"deny", permissionDecisionReason:$reason}'
  exit 0
}

case "$CMD" in
  *"git push --force"*|*"git push -f"*)
    deny "Policy: force-pushing is not permitted from an automated agent session." ;;
  *"git reset --hard"*)
    deny "Policy: 'git reset --hard' is not permitted from an automated agent session." ;;
  *"rm -rf /"*|*"rm -rf ~"*)
    deny "Policy: recursive deletion outside the workspace is not permitted." ;;
  *"curl"*|*"wget"*)
    deny "Policy: outbound fetches are not permitted from this runner. Vulnerability data is pre-seeded in the image." ;;
esac

jq -cn '{permissionDecision:"allow"}'
