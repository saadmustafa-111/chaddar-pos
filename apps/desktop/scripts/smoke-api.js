const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const http = require('node:http');

async function smokeTestApi(executable, apiPath) {
  // Do not accept a response from an already running application.
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(4555, '127.0.0.1', () => server.close(resolve));
  });
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'steelchaddar-api-smoke-'));
  let output = '';
  let failure;
  const child = spawn(executable, [path.join(apiPath, 'dist/main.js')], {
    cwd: apiPath, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1', NODE_ENV: 'production', PORT: '4555',
      DATABASE_PATH: path.join(temp, 'data', 'test.db'),
      ATTACHMENTS_DIR: path.join(temp, 'attachments'),
      SESSION_SECRET: 'packaging-smoke-test', DESKTOP_MODE: 'true',
      INITIAL_ADMIN_PASSWORD: 'PackagingSmokeTest123!',
    },
  });
  const closed = new Promise(resolve => child.once('close', resolve));
  child.on('error', err => { failure = err; });
  child.on('exit', (code, signal) => { failure = new Error(`API exited: code=${code}, signal=${signal}`); });
  for (const stream of [child.stdout, child.stderr]) {
    stream.on('data', data => { output = (output + data).slice(-24000); });
  }
  try {
    const deadline = Date.now() + 45000;
    while (Date.now() < deadline) {
      if (failure) throw failure;
      const healthy = await new Promise(resolve => {
        const req = http.get('http://127.0.0.1:4555/api/v1/health', res => {
          let body = '';
          res.on('data', chunk => { body += chunk; });
          res.on('end', () => {
            try {
              const result = JSON.parse(body);
              resolve(res.statusCode === 200 && result.status === 'ok' && result.database === 'connected');
            } catch { resolve(false); }
          });
          res.on('error', () => resolve(false));
        });
        req.on('error', () => resolve(false));
        req.setTimeout(1000, () => req.destroy());
      });
      if (failure) throw failure;
      if (healthy) {
        console.log('[API smoke] Packaged runtime: health 200, database connected on port 4555');
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    throw new Error('API health check timed out on port 4555');
  } catch (err) {
    throw new Error(`${err.message}\n${output}`);
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill();
    await closed;
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

exports.smokeTestApi = smokeTestApi;
if (require.main === module) {
  const [executable, apiPath] = process.argv.slice(2);
  if (!executable || !apiPath) throw new Error('Usage: node smoke-api.js <packaged exe> <resources/api>');
  smokeTestApi(path.resolve(executable), path.resolve(apiPath)).catch(err => {
    console.error(err);
    process.exitCode = 1;
  });
}
