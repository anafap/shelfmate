const { execFileSync, spawnSync } = require('node:child_process');
const { join } = require('node:path');

// An exception is valid only while every hash-checked local patch is present.
execFileSync(process.execPath, [join(__dirname, 'prepare-dependencies.cjs'), '--check'], { stdio: 'inherit' });
const result = spawnSync('npm', ['audit', '--json'], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
if (result.error || ![0, 1].includes(result.status)) throw new Error('Dependency audit could not complete.');
const report = JSON.parse(result.stdout);
if (report.error) throw new Error('Dependency audit returned an error.');
const vulnerabilities = Object.values(report.vulnerabilities ?? {});
const advisories = vulnerabilities.flatMap(item => item.via.filter(via => typeof via !== 'string'));
const unreviewed = advisories.filter(advisory => advisory.name !== 'deepmerge' || advisory.severity !== 'low' || advisory.url !== 'https://github.com/advisories/GHSA-gcqx-w48m-w2h4');
if (unreviewed.length || vulnerabilities.some(item => item.severity !== 'low') || (vulnerabilities.length && !advisories.length)) {
  console.error('Unreviewed dependency advisories:', unreviewed.map(item => item.url));
  process.exit(1);
}
console.log(`Dependency audit passed: ${vulnerabilities.length} package entries relate to the verified local deepmerge patch; no unreviewed advisories.`);
