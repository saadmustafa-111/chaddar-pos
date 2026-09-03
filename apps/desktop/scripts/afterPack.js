const path = require('path');
const fs = require('fs');

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

exports.default = async function afterPack(context) {
  const destPath = path.join(
    context.appOutDir,
    'resources',
    'api',
    'node_modules'
  );
  const srcPath = path.join(
    context.appOutDir,
    '..',
    '..',
    '..',
    '..',
    'apps',
    'api',
    'deploy',
    'node_modules'
  );

  console.log(`[afterPack] context.appOutDir: ${context.appOutDir}`);
  console.log(`[afterPack] Copying node_modules from:\n  ${srcPath}\nto:\n  ${destPath}`);

  if (!fs.existsSync(srcPath)) {
    console.error('[afterPack] Source node_modules does not exist!');
    return;
  }

  copyDir(srcPath, destPath);
  console.log('[afterPack] node_modules copied successfully');
};
