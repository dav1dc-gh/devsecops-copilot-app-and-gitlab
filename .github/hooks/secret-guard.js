#!/usr/bin/env node
/**
 * secret-guard — preToolUse hook.
 *
 * Blocks the agent from writing credentials into this repository.
 *
 * Contract (Copilot hooks, version 1):
 *   - the hook payload arrives as JSON on stdin
 *   - exactly one JSON object is written to stdout:
 *       {"permissionDecision":"allow"}
 *       {"permissionDecision":"deny","permissionDecisionReason":"..."}
 *
 * Fail closed: if the payload cannot be read or parsed, or if this script hits
 * an internal error, the decision is DENY. A malformed payload must never
 * silently disable the guard.
 *
 * No external dependencies — Node only.
 */

'use strict';

const MAX_SCAN_BYTES = 2 * 1024 * 1024;

/** Emit exactly one JSON object and exit. */
function decide(decision, reason) {
  const out = { permissionDecision: decision };
  if (reason) out.permissionDecisionReason = reason;
  process.stdout.write(JSON.stringify(out));
  process.exit(0);
}

const allow = () => decide('allow');
const deny = (reason) => decide('deny', reason);

// --- Detectors -------------------------------------------------------------

const DETECTORS = [
  {
    id: 'aws-access-key-id',
    label: 'AWS access key ID',
    pattern: /\b(?:AKIA|ASIA|ABIA|ACCA|AGPA|AIDA|AIPA|ANPA|ANVA|AROA)[A-Z0-9]{16}\b/g
  },
  {
    id: 'gitlab-token',
    label: 'GitLab token (glpat-)',
    pattern: /\bglpat-[A-Za-z0-9_-]{20,}\b/g
  },
  {
    id: 'gitlab-token-other',
    label: 'GitLab token',
    pattern: /\b(?:gldt|glrt|glcbt|glptt|glsoat|glimt|glagent|glff|gloas)-[A-Za-z0-9_-]{20,}\b/g
  },
  {
    id: 'github-token',
    label: 'GitHub token',
    pattern: /\bgh[pousr]_[A-Za-z0-9]{36,255}\b/g
  },
  {
    id: 'github-pat-fine-grained',
    label: 'GitHub fine-grained personal access token',
    pattern: /\bgithub_pat_[A-Za-z0-9_]{50,}\b/g
  },
  {
    id: 'private-key-block',
    label: 'private key block',
    pattern: /-----BEGIN (?:RSA |DSA |EC |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY(?: BLOCK)?-----/g
  }
];

/**
 * Hardcoded credential assignments — a credential-ish name assigned a quoted
 * literal. Handled separately from DETECTORS so the captured value can be
 * checked against obvious placeholders and environment lookups before denying.
 */
const CRED_ASSIGNMENT =
  /\b(passwords?|passwd|pwd|secrets?|secret[_-]?key|api[_-]?keys?|apikey|access[_-]?token|auth[_-]?token|refresh[_-]?token|bearer[_-]?token|client[_-]?secret|private[_-]?key|credentials?|token)\b\s*[:=]{1,2}\s*(['"`])([^'"`\n]{6,})\2/gi;

/** Values that look like credentials but are not. */
const PLACEHOLDER = /^(?:\s*|x{3,}|\*{3,}|\.{3,}|-+|<.*>|\$\{.*\}|%[sd]|\{\{.*\}\}|null|none|nil|true|false|changeme|change[_-]?me|placeholder|redacted|example|examples?[_-].*|your[_-].*|my[_-]?(?:secret|token|password|key)|dummy|fake|sample|test|testing|secret|password|token|apikey|api[_-]?key|todo|tbd|unset|empty)$/i;

/** Indirection — reading from the environment or a secret store is fine. */
const INDIRECTION =
  /(process\.env|os\.environ|ENV\[|System\.getenv|Deno\.env|getenv\(|secrets?\.|vault|keyring|\$\{?[A-Z_][A-Z0-9_]*\}?|%[A-Z_][A-Z0-9_]*%)/;

function isBenignValue(value) {
  const v = value.trim();
  if (PLACEHOLDER.test(v)) return true;
  if (INDIRECTION.test(v)) return true;
  // A value with no character-class variety is almost certainly not a real key.
  if (!/[0-9]/.test(v) && !/[^A-Za-z]/.test(v) && v.length < 12) return true;
  return false;
}

function lineOf(text, index) {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i++) {
    if (text.charCodeAt(i) === 10) line++;
  }
  return line;
}

/** Scan one string; return an array of {label, line} findings. */
function scanText(text) {
  const findings = [];
  if (typeof text !== 'string' || text.length === 0) return findings;

  for (const det of DETECTORS) {
    det.pattern.lastIndex = 0;
    let m;
    while ((m = det.pattern.exec(text)) !== null) {
      findings.push({ label: det.label, line: lineOf(text, m.index) });
      if (m[0].length === 0) det.pattern.lastIndex++;
    }
  }

  CRED_ASSIGNMENT.lastIndex = 0;
  let m;
  while ((m = CRED_ASSIGNMENT.exec(text)) !== null) {
    const name = m[1];
    const value = m[3];
    if (!isBenignValue(value)) {
      findings.push({
        label: `hardcoded credential assignment (${name})`,
        line: lineOf(text, m.index)
      });
    }
    if (m[0].length === 0) CRED_ASSIGNMENT.lastIndex++;
  }

  return findings;
}

/** Collect every string in the tool arguments, whatever their shape. */
function collectStrings(value, out, depth) {
  if (depth > 12 || out.length > 500) return out;
  if (typeof value === 'string') {
    out.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out, depth + 1);
  } else if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) collectStrings(value[key], out, depth + 1);
  }
  return out;
}

function readStdin() {
  const fs = require('fs');
  try {
    return fs.readFileSync(0, 'utf8');
  } catch (err) {
    if (err && err.code === 'EAGAIN') {
      // Non-blocking stdin: retry synchronously in small chunks.
      const buf = Buffer.alloc(65536);
      const chunks = [];
      for (;;) {
        let bytes;
        try {
          bytes = fs.readSync(0, buf, 0, buf.length, null);
        } catch (e) {
          if (e && (e.code === 'EAGAIN' || e.code === 'EWOULDBLOCK')) continue;
          if (e && e.code === 'EOF') break;
          throw e;
        }
        if (bytes === 0) break;
        chunks.push(Buffer.from(buf.subarray(0, bytes)));
      }
      return Buffer.concat(chunks).toString('utf8');
    }
    throw err;
  }
}

// --- Main ------------------------------------------------------------------

function main() {
  let raw;
  try {
    raw = readStdin();
  } catch (err) {
    deny(`secret-guard: could not read the hook payload from stdin (${err && err.message}). Denying because the credential guard cannot verify this tool call.`);
    return;
  }

  if (typeof raw !== 'string' || raw.trim() === '') {
    deny('secret-guard: the hook payload was empty. Denying because the credential guard cannot verify this tool call.');
    return;
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (err) {
    deny('secret-guard: the hook payload was not valid JSON. Denying because a malformed payload must not silently disable the credential guard.');
    return;
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    deny('secret-guard: the hook payload was not a JSON object. Denying because the credential guard cannot verify this tool call.');
    return;
  }

  // Support both the camelCase and the VS Code compatible payload shapes.
  const toolName = payload.toolName || payload.tool_name || 'unknown';
  let toolArgs = payload.toolArgs !== undefined ? payload.toolArgs : payload.tool_input;

  if (typeof toolArgs === 'string') {
    try {
      toolArgs = JSON.parse(toolArgs);
    } catch (err) {
      // Not JSON — scan it as raw text.
    }
  }

  const strings = collectStrings(toolArgs, [], 0);
  const findings = [];
  for (const s of strings) {
    const text = s.length > MAX_SCAN_BYTES ? s.slice(0, MAX_SCAN_BYTES) : s;
    for (const f of scanText(text)) {
      if (!findings.some((existing) => existing.label === f.label && existing.line === f.line)) {
        findings.push(f);
      }
    }
  }

  if (findings.length === 0) {
    allow();
    return;
  }

  // Never echo the matched value — that would put the credential in the transcript.
  const summary = findings
    .slice(0, 10)
    .map((f) => `  - ${f.label} (line ${f.line})`)
    .join('\n');
  const more = findings.length > 10 ? `\n  ...and ${findings.length - 10} more` : '';

  deny(
    `secret-guard blocked this \`${toolName}\` call: it would write credentials into the repository.\n\n` +
      `Detected:\n${summary}${more}\n\n` +
      `The matched values are intentionally not repeated here. Do not commit credentials to tracked files. ` +
      `Read secrets from an environment variable or the CI secret store instead, and keep any file that may ` +
      `contain real secrets out of version control. If this is a false positive, use an obvious placeholder ` +
      `(for example "<your-token>") or reference the value indirectly.`
  );
}

try {
  main();
} catch (err) {
  decide(
    'deny',
    `secret-guard: the credential guard failed to run (${err && err.message}). Denying because the tool call could not be verified.`
  );
}
