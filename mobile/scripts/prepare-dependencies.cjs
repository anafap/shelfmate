const { createHash } = require('node:crypto');
const { readFileSync, writeFileSync } = require('node:fs');
const { dirname, join } = require('node:path');

function save(path, value) {
  if (process.argv.includes('--check')) {
    if (readFileSync(path, 'utf8') !== value) throw new Error(`Dependency patch is missing: ${path}`);
  } else writeFileSync(path, value);
}

// SDK 57's query-string requires a callable CommonJS export. Keep the patched
// upstream decoder algorithm intact and change only its module format.
const entry = require.resolve('decode-uri-component');
const manifestPath = join(dirname(entry), 'package.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (manifest.version !== '0.5.1') throw new Error('Review decoder compatibility before changing its pinned version.');
const upstreamHash = '6a86ac891edf15c5efa0841ebb31935e3669d58b98318b57d7b08a4530317cb0';
const esm = 'export default function decodeUriComponent';
const cjs = 'module.exports = function decodeUriComponent';
const source = readFileSync(entry, 'utf8');
const upstream = source.replace(cjs, esm);
if (createHash('sha256').update(upstream).digest('hex') !== upstreamHash) throw new Error('Unexpected decoder source; refusing to alter it.');
save(entry, upstream.replace(esm, cjs));
manifest.type = 'commonjs';
save(manifestPath, `${JSON.stringify(manifest, null, '\t')}\n`);

function checkedPatch(path, hash, apply, undo) {
  const source = readFileSync(path, 'utf8');
  const upstream = undo(source);
  if (createHash('sha256').update(upstream).digest('hex') !== hash) throw new Error(`Unexpected dependency source: ${path}`);
  save(path, apply(upstream));
}

// Preserve the callable API used by glob 7/ESLint while newer consumers retain
// the named exports of the patched minimatch 11 implementation.
const minimatchFooter = '\nmodule.exports = Object.assign(exports.minimatch, exports);\n';
checkedPatch(require.resolve('minimatch'), '235c5458355f1449cc100f1cea1a43d45f788a4feb524a83497aa146bea88f32',
  source => source + minimatchFooter, source => source.endsWith(minimatchFooter) ? source.slice(0, -minimatchFooter.length) : source);

// No upstream deepmerge release fixes prototype poisoning yet. Defining own
// data properties preserves keys without invoking Object.prototype.__proto__.
const mergeDir = dirname(require.resolve('deepmerge'));
for (const [file, hash] of [
  ['cjs.js', '2e5160f84a1141bd927264afe4d15766f1e6cf07daef182b37ff53fea121de7d'],
  ['umd.js', 'f33e6596482d1fb5c7c427f8ef92f2aa849eea9223acd974176b2fb27ddbf73a'],
]) checkedPatch(join(mergeDir, file), hash,
  source => source.replace(/destination\[key\] = (.*);/g, 'Object.defineProperty(destination, key, { value: $1, enumerable: true, configurable: true, writable: true });'),
  source => source.replace(/Object\.defineProperty\(destination, key, \{ value: (.*), enumerable: true, configurable: true, writable: true \}\);/g, 'destination[key] = $1;'));
