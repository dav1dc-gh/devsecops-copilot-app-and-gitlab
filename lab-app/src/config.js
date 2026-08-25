const _ = require('lodash');
const minimist = require('minimist');

const DEFAULTS = {
  port: 3000,
  host: '127.0.0.1',
  logging: {
    level: 'info',
    format: 'json'
  },
  features: {
    healthcheck: true,
    verboseErrors: false
  }
};

function parseArgs(argv) {
  return minimist(argv, {
    string: ['host', 'log-level'],
    default: {}
  });
}

function buildConfig(argv = [], overrides = {}) {
  const args = parseArgs(argv);

  const fromArgs = {};
  if (args.port !== undefined) fromArgs.port = Number(args.port);
  if (args.host !== undefined) fromArgs.host = args.host;
  if (args['log-level'] !== undefined) {
    fromArgs.logging = { level: args['log-level'] };
  }

  return _.merge({}, DEFAULTS, fromArgs, overrides);
}

module.exports = { DEFAULTS, buildConfig, parseArgs };
