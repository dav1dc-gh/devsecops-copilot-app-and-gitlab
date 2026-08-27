#!/usr/bin/env node
// preToolUse hook: deny any tool call that would write a credential into the repo.
// Written in Node because Copilot CLI already requires Node 22 — no extra dependency
// on jq or a scanner binary, and it works identically on macOS, Linux and Windows.
//
// Contract (docs.github.com/en/copilot/reference/hooks-reference):
//   stdin  <- {"sessionId","timestamp","cwd","toolName","toolArgs"}
//   stdout -> {"permissionDecision":"allow"|"deny"|"ask","permissionDecisionReason":"..."}
// preToolUse command hooks are fail-closed: a crash or non-zero exit denies the call.

const PATTERNS = [
  { name: 'AWS access key ID', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'GitLab personal access token', re: /\bglpat-[0-9A-Za-z_-]{20,}\b/ },
  { name: 'GitHub token', re: /\bgh[pousr]_[0-9A-Za-z]{36,}\b/ },
  { name: 'GitHub fine-grained PAT', re: /\bgithub_pat_[0-9A-Za-z_]{50,}\b/ },
  { name: 'private key block', re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/ },
  { name: 'hardcoded credential assignment', re: /(?:api[_-]?key|secret|password|passwd|token)\s*[:=]\s*['"][^'"\s]{12,}['"]/i }
];

function decide(text) {
  for (const { name, re } of PATTERNS) {
    if (re.test(text)) return name;
  }
  return null;
}

function emit(decision, reason) {
  const out = { permissionDecision: decision };
  if (reason) out.permissionDecisionReason = reason;
  process.stdout.write(JSON.stringify(out));
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  raw += chunk;
});

process.stdin.on('end', () => {
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    // Malformed input must not silently disable the guard.
    emit('deny', 'secret-guard could not parse the preToolUse payload.');
    return;
  }

  // Inspect every string in toolArgs: file contents for create/edit, the command
  // line for bash/powershell. Depth is bounded to keep the hook well under timeout.
  const found = decide(JSON.stringify(payload.toolArgs ?? ''));

  if (found) {
    emit(
      'deny',
      `Blocked by secret-guard: the content looks like a ${found}. ` +
        'Do not commit credentials. Read the value from an environment variable ' +
        'or the GitLab CI/CD variable store instead, and reference it by name.'
    );
    return;
  }

  emit('allow');
});
