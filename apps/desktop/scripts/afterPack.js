const path = require('node:path');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const { pathToFileURL } = require('node:url');
const { spawnSync } = require('node:child_process');
const { smokeTestApi } = require('./smoke-api');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32' || context.arch !== 1 || process.platform !== 'win32' || process.arch !== 'x64' || context.packager.info.framework.version !== '33.4.11') {
    throw new Error('API native packaging requires Electron 33.4.11 / win32 x64 (ABI 130). Run the Windows CI build.');
  }
  const apiPath = path.join(context.appOutDir, 'resources', 'api');
  const sourcePath = path.resolve(context.packager.projectDir, '../api/deploy');
  for (const relative of ['dist/main.js', 'package.json', 'node_modules/better-sqlite3/package.json']) {
    if (!fs.existsSync(path.join(sourcePath, relative))) {
      throw new Error(`API staging is incomplete: ${path.join(sourcePath, relative)}`);
    }
  }
  // extraResources is outside ASAR. Replace stale files and materialize links.
  console.log(`[afterPack] Replacing ${apiPath} from ${sourcePath}`);
  fs.rmSync(apiPath, { recursive: true, force: true });
  fs.mkdirSync(apiPath, { recursive: true });
  for (const relative of ['dist', 'package.json', 'node_modules']) {
    fs.cpSync(path.join(sourcePath, relative), path.join(apiPath, relative), { recursive: true, dereference: true });
  }
  // Use electron-builder's own rebuild dependency and actual target version.
  const builderRequire = createRequire(require.resolve('electron-builder'));
  const appBuilderRequire = createRequire(builderRequire.resolve('app-builder-lib'));
  const { rebuild } = await import(pathToFileURL(appBuilderRequire.resolve('@electron/rebuild')).href);
  const arch = 'x64';
  console.log(`[afterPack] Rebuilding better-sqlite3 for Electron ${context.packager.info.framework.version}, ${arch}`);
  await rebuild({
    buildPath: apiPath,
    electronVersion: context.packager.info.framework.version,
    platform: 'win32',
    arch,
    onlyModules: ['better-sqlite3'],
    force: true,
    buildFromSource: true,
  });
  const executable = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.exe`);
  const check = spawnSync(executable, ['-e', `
    const assert = require('node:assert/strict');
    assert.equal(process.versions.electron, '33.4.11');
    assert.equal(process.versions.modules, '130');
    assert.equal(process.platform, 'win32');
    assert.equal(process.arch, 'x64');
    const Database = require('./node_modules/better-sqlite3');
    const db = new Database(':memory:');
    assert.equal(db.prepare('SELECT 1 AS value').get().value, 1);
    db.close();
    console.log('Packaged SQLite loaded: Electron 33.4.11 / ABI 130 / win32 x64');
  `], { cwd: apiPath, env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, windowsHide: true, encoding: 'utf8', timeout: 15000 });
  if (check.error || check.status !== 0) throw new Error(`Packaged SQLite ABI check failed: ${check.error || check.stderr || check.stdout}`);
  console.log(check.stdout.trim());
  console.log(`[afterPack] Testing packaged API with ${executable}`);
  await smokeTestApi(executable, apiPath);
};
