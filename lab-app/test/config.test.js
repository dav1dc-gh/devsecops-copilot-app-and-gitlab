const test = require('node:test');
const assert = require('node:assert');
const { DEFAULTS, buildConfig, parseArgs } = require('../src/config');

test('returns defaults when no arguments are supplied', () => {
  const config = buildConfig([]);
  assert.strictEqual(config.port, 3000);
  assert.strictEqual(config.host, '127.0.0.1');
  assert.strictEqual(config.logging.level, 'info');
});

test('command line arguments override defaults', () => {
  const config = buildConfig(['--port', '8080', '--host', '0.0.0.0']);
  assert.strictEqual(config.port, 8080);
  assert.strictEqual(config.host, '0.0.0.0');
});

test('overrides take precedence over command line arguments', () => {
  const config = buildConfig(['--port', '8080'], { port: 9090 });
  assert.strictEqual(config.port, 9090);
});

test('nested logging config merges rather than replaces', () => {
  const config = buildConfig(['--log-level', 'debug']);
  assert.strictEqual(config.logging.level, 'debug');
  assert.strictEqual(config.logging.format, 'json');
});

test('building a config does not mutate DEFAULTS', () => {
  buildConfig(['--port', '8080'], { logging: { level: 'trace' } });
  assert.strictEqual(DEFAULTS.port, 3000);
  assert.strictEqual(DEFAULTS.logging.level, 'info');
});

test('parseArgs keeps host as a string', () => {
  const args = parseArgs(['--host', '10.0.0.1']);
  assert.strictEqual(typeof args.host, 'string');
});
