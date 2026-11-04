import { execFileSync } from 'node:child_process';

// These are CommonJS consumers in Expo SDK 57 and must remain callable.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const queryString = require('query-string') as { parse: (value: string) => Record<string, unknown>; stringify: (value: object) => string };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const minimatch = require('minimatch') as typeof import('minimatch').minimatch & typeof import('minimatch');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const merge = require('deepmerge') as (target: object, source: object) => Record<string, unknown>;

test('patched URL decoding preserves existing router query parsing and encoding', () => {
  expect(queryString.parse('name=Milk%20bottle&tag=a&tag=b&note=%E0%A4%A')).toEqual({ name: 'Milk bottle', tag: ['a', 'b'], note: '%E0%A4%A' });
  expect(queryString.stringify({ name: 'Milk bottle', count: 2 })).toBe('count=2&name=Milk%20bottle');
});

test('malformed URI input cannot indefinitely block router query decoding', () => {
  const script = `const q = require('query-string'); let payload = ''; for (let i=0; i<32000; i++) payload += '%' + Math.floor(i/256).toString(16).padStart(2,'0') + '%' + (i%256).toString(16).padStart(2,'0') + 'x'; q.parse('value=' + payload + '%zz'); process.stdout.write('decoded');`;
  expect(execFileSync(process.execPath, ['-e', script], { cwd: process.cwd(), timeout: 5000, encoding: 'utf8' })).toBe('decoded');
});

test('patched minimatch supports legacy callable and modern named APIs', () => {
  expect(minimatch('src/app/index.tsx', 'src/**/*.tsx')).toBe(true);
  expect(minimatch.minimatch('src/app/index.tsx', 'src/**/*.tsx')).toBe(true);
  expect(new minimatch.Minimatch('**/*.{ts,tsx}').match('src/item.ts')).toBe(true);
  expect(minimatch('node_modules/package/index.js', 'src/**/*.tsx')).toBe(false);
});

test.each([{}, Object.create(null)])('deepmerge keeps untrusted proto keys from changing the returned prototype', target => {
  const poison = JSON.parse('{"__proto__":{"admin":true},"name":"Milk"}');
  for (const result of [merge(poison, target), merge(target, poison)]) {
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(result.admin).toBeUndefined();
    expect(result.name).toBe('Milk');
  }
  expect(merge({ items: ['Milk'], nested: { first: 1 } }, { items: ['Bread'], nested: { second: 2 } })).toEqual({ items: ['Milk', 'Bread'], nested: { first: 1, second: 2 } });
});
