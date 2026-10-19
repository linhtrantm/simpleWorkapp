// Mỗi lần build: tăng số build (build/build-number.json), ghi vào src/build-info.json cho cửa sổ About,
// và đưa vào CFBundleVersion của app để Finder > Get Info hiện "Version 1.2.0 (123)".
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const counterFile = path.join(root, 'build', 'build-number.json');

let build = 0;
try {
  build = JSON.parse(fs.readFileSync(counterFile, 'utf8')).build || 0;
} catch {}
build += 1;

fs.writeFileSync(counterFile, JSON.stringify({ build }, null, 2) + '\n');
fs.writeFileSync(
  path.join(root, 'src', 'build-info.json'),
  JSON.stringify({ build, builtAt: new Date().toISOString() }, null, 2) + '\n'
);

const version = require(path.join(root, 'package.json')).version;
console.log(`\n>>> simpleWork ${version} (build ${build})\n`);

const result = spawnSync(
  'npx',
  ['electron-builder', '--mac', 'dmg', '--arm64', `-c.buildVersion=${build}`],
  { cwd: root, stdio: 'inherit' }
);
process.exit(result.status === null ? 1 : result.status);
