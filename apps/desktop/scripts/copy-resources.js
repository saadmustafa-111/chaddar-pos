const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const resourcesDir = path.join(root, 'resources');
const apiSource = path.join(root, '..', 'api', 'dist');
const apiNodeModules = path.join(root, '..', 'api', 'node_modules');
const webSource = path.join(root, '..', 'web', '.next');
const webPublic = path.join(root, '..', 'web', 'public');
const webPackage = path.join(root, '..', 'web', 'package.json');

function copyDir(src, dest, includeNodeModules = false) {
  if (!fs.existsSync(src)) {
    console.warn(`Source not found: ${src} — skipping`);
    return;
  }
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    try {
      if (entry.isDirectory()) {
        if (entry.name === 'dev') continue;
        if (entry.name === 'cache') continue;
        if (entry.name === '.next') continue;
        if (entry.isSymbolicLink()) continue;
        if (entry.name === 'node_modules') {
          if (includeNodeModules) {
            copyDir(srcPath, destPath, false);
          }
          continue;
        }
        copyDir(srcPath, destPath, includeNodeModules);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    } catch (e) {
      if (e.code === 'EPERM' || e.code === 'EBUSY') {
        console.warn(`Skipped (${e.code}): ${srcPath}`);
      } else {
        throw e;
      }
    }
  }
}

function copyFile(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`File not found: ${src} — skipping`);
    return;
  }
  const destDir = path.dirname(dest);
  fs.mkdirSync(destDir, { recursive: true });
  try {
    fs.copyFileSync(src, dest);
  } catch (e) {
    if (e.code !== 'EPERM' && e.code !== 'EBUSY') throw e;
    console.warn(`Skipped file: ${src}`);
  }
}

console.log('Copying build resources for Electron...');

copyDir(apiSource, path.join(resourcesDir, 'api'));
const apiNodeModulesSrc = path.join(root, '..', 'api', 'node_modules');
if (fs.existsSync(apiNodeModulesSrc)) {
  console.log('Copying API node_modules...');
  copyDir(apiNodeModulesSrc, path.join(resourcesDir, 'api', 'node_modules'));
} else {
  console.warn('API node_modules not found at:', apiNodeModulesSrc);
}
copyDir(webSource, path.join(resourcesDir, 'web', '.next'));
if (fs.existsSync(webPublic)) {
  copyDir(webPublic, path.join(resourcesDir, 'web', 'public'));
}
copyFile(webPackage, path.join(resourcesDir, 'web', 'package.json'));

console.log('Done copying resources.');
