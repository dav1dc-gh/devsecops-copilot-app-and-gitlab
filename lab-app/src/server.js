const http = require('node:http');
const { buildConfig } = require('./config');

const config = buildConfig(process.argv.slice(2));

const server = http.createServer((req, res) => {
  if (req.url === '/healthz' && config.features.healthcheck) {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(
    JSON.stringify({
      service: 'lab-app',
      port: config.port,
      logging: config.logging
    })
  );
});

if (require.main === module) {
  server.listen(config.port, config.host, () => {
    console.log(JSON.stringify({ msg: 'listening', host: config.host, port: config.port }));
  });
}

module.exports = { server, config };
