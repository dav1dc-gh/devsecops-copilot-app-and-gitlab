#!/usr/bin/env node
'use strict';

/**
 * preToolUse guard — blocks credentials from being written into this repository.
 *
 * Reads the hook payload as JSON on stdin and writes exactly one JSON object to stdout:
 *   {"permissionDecision":"allow"}
 *   {"permissionDecision":"deny","permissionDecisionReason":"..."}
 *
 * Node only, no external dependencies (jq is not installed on every machine; Node is,
 * because Copilot CLI requires it).
 *
 * Fail-closed: if the payload cannot be read or parsed, the call is DENIED. A malformed
 * payload must never silently disable the guard.
 *
 * The deny reason never echoes the matched value — only what kind of credential was seen
 * and where. Hook reasons end up in logs and transcripts.
 */

const MAX_STDIN_BYTES = 10 * 1024 * 1024;
const MAX_DEPTH = 12;
const MAX_STRINGS = 5000;

function respond(decision, reason) {
  const out = { permissionDecision: decision };
  if (reason) out.permissionDecisionReason = reason;
  process.stdout.write(JSON.stringify(out));
}

function deny(reason) {
  respond('deny', reason);
  process.exit(0);
}

/* ------------------------------------------------------------------ detectors */

// Each detector reports the KIND of credential, never the value itself.
const DETECTORS = [
  {
    label: 'an AWS access key ID',
    // AKIA / ASIA / AROA / AIDA / ... followed by 16 uppercase alphanumerics.
    re: /\bA(?:KIA|SIA|ROA|IDA|GPA|IPA|NPA|NVA|CCA|BIA)[A-Z0-9]{16}\b/
  },
  {
    label: 'a GitLab token',
    // glpat- personal access tokens, plus the sibling GitLab token prefixes.
    re: /\bgl(?:pat|rt|dt|soat|ptt|cbt|ffct|imt|agent|deploy)-[A-Za-z0-9_-]{20,}/
  },
  {
    label: 'a GitHub token',
    re: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,})\b/
  },
  {
    label: 'a private key block',
    re: /-----BEGIN[ A-Z0-9]*PRIVATE KEY[ A-Z0-9]*-----/
  },
  {
    label: 'a hardcoded credential assignment',
    re: buildAssignmentPattern(),
    // Only this detector tolerates placeholders — a real key ID is denied even if it is
    // documented as an example, because example keys are how real ones get committed.
    filter: isNotPlaceholder
  }
];

function buildAssignmentPattern() {
  const words = [
    'passwords?',
    'passwd',
    'pwd',
    'secrets?',
    'tokens?',
    'api[_-]?keys?',
    'apikeys?',
    'access[_-]?keys?',
    'secret[_-]?keys?',
    'private[_-]?keys?',
    'client[_-]?secrets?',
    'auth[_-]?tokens?',
    'credentials?',
    'connection[_-]?strings?'
  ].join('|');

  // keyword <sep> "value"  — quoted literal of 8+ characters.
  return new RegExp(
    '(?:' + words + ')["\\s\\]]*(?:::?=|=>|[:=])\\s*' +
      '["\'`]([^"\'`\\r\\n]{8,})["\'`]',
    'i'
  );
}

// Values that are obviously not real credentials.
const PLACEHOLDER_VALUE =
  /^(?:x{3,}|\*{3,}|\.{3,}|-{3,}|change[-_ ]?me|placeholder|examples?|your[-_ ].*|my[-_ ].*|todo|tbd|n\/a|none|null|undefined|true|false|redacted|dummy|sample|fake|test(?:ing)?|password|passw0rd|secret|hunter2|s3cret|abc123|123456\d*)$/i;

// Values that are references to a secret, not the secret.
const VALUE_IS_REFERENCE =
  /(?:process\.env|os\.environ|ENV\[|Deno\.env|getenv|System\.getenv|secrets\.|vault:|\$\{|\{\{|<[^>]+>|%[A-Za-z_][A-Za-z0-9_]*%|\$[A-Z_][A-Z0-9_]*)/;

function isNotPlaceholder(match) {
  const value = (match[1] || '').trim();
  if (!value) return false;
  if (PLACEHOLDER_VALUE.test(value)) return false;
  if (VALUE_IS_REFERENCE.test(value)) return false;
  return true;
}

/* ------------------------------------------------------------ payload walking */

// Collect every string in the tool arguments, with a path, so the reason can say where.
function collectStrings(value, path, out, depth, seen) {
  if (out.length >= MAX_STRINGS) return;
  if (value === null || value === undefined) return;

  const type = typeof value;

  if (type === 'string') {
    out.push({ path: path || 'arguments', text: value });
    return;
  }

  if (type !== 'object') return;
  if (depth > MAX_DEPTH) return;
  if (seen.has(value)) return;
  seen.add(value);

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      collectStrings(value[i], path + '[' + i + ']', out, depth + 1, seen);
    }
    return;
  }

  for (const key of Object.keys(value)) {
    const next = path ? path + '.' + key : key;
    collectStrings(value[key], next, out, depth + 1, seen);
  }
}

function scan(strings) {
  for (const item of strings) {
    for (const detector of DETECTORS) {
      const match = detector.re.exec(item.text);
      if (!match) continue;
      if (detector.filter && !detector.filter(match)) continue;
      return { label: detector.label, path: item.path };
    }
  }
  return null;
}

function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let settled = false;

    const finish = (fn, arg) => {
      if (settled) return;
      settled = true;
      fn(arg);
    };

    process.stdin.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_STDIN_BYTES) {
        finish(reject, new Error('payload exceeds ' + MAX_STDIN_BYTES + ' bytes'));
        return;
      }
      chunks.push(chunk);
    });
    process.stdin.on('end', () => finish(resolve, Buffer.concat(chunks).toString('utf8')));
    process.stdin.on('error', (err) => finish(reject, err));
  });
}

/* -------------------------------------------------------------------- main */

async function main() {
  let raw;
  try {
    raw = await readStdin();
  } catch (err) {
    deny('secret-guard could not read the hook payload (' + err.message + '), so the call was denied.');
    return;
  }

  if (!raw || !raw.trim()) {
    deny('secret-guard received an empty hook payload, so the call was denied.');
    return;
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (err) {
    deny('secret-guard could not parse the hook payload as JSON (' + err.message + '), so the call was denied.');
    return;
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    deny('secret-guard received a hook payload that was not a JSON object, so the call was denied.');
    return;
  }

  // camelCase (preToolUse) and VS Code compatible (PreToolUse) payload shapes.
  const toolName = payload.toolName || payload.tool_name || 'unknown tool';
  let args = payload.toolArgs !== undefined ? payload.toolArgs : payload.tool_input;

  if (args === undefined || args === null) {
    respond('allow');
    return;
  }

  // Tool arguments are sometimes delivered as a JSON string.
  if (typeof args === 'string') {
    const trimmed = args.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        args = JSON.parse(trimmed);
      } catch (err) {
        // Not JSON after all — scan it as plain text.
      }
    }
  }

  const strings = [];
  collectStrings(args, '', strings, 0, new WeakSet());

  const hit = scan(strings);
  if (hit) {
    deny(
      'Blocked by secret-guard: the ' + toolName + ' call contains what looks like ' +
        hit.label + ' (in ' + hit.path + '). Credentials must never be written into ' +
        'tracked files. Use an environment variable or a masked CI/CD variable and ' +
        'reference it by name instead. The matched value has been withheld from this message.'
    );
    return;
  }

  respond('allow');
}

main().catch((err) => {
  deny('secret-guard failed unexpectedly (' + (err && err.message) + '), so the call was denied.');
});
