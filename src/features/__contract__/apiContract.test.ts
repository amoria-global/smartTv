import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * CONN-TEST-4 for the TV app: every backend path it calls must exist.
 *
 * The SmartTV epic's defects were in pairing and sign-out. This is the static
 * counterpart to api.test.ts: rather than what the pairing client SENDS, it
 * checks that every route the app targets is one the backend actually serves,
 * the same guard CONN-ONB-1 showed the whole product needed.
 *
 * contract/api-contract.json is generated from the backend's controllers by
 * ApiContractTest in amoria-connect and copied here by that repo's
 * scripts/sync-api-contract.sh.
 *
 * Sources are read, not imported: the api client pulls in fetch and storage
 * wiring a plain test should not load. Every path reaches the wire under
 * env.apiBaseUrl, which ends in /api/remote, so that prefix is added here.
 */

const ROOT = path.resolve(__dirname, '../../..');
const CONTRACT = path.join(ROOT, 'contract/api-contract.json');
const routes: { method: string; path: string }[] = JSON.parse(readFileSync(CONTRACT, 'utf8')).routes;

const templates = routes.map((r) => ({
  method: r.method,
  regex: new RegExp('^' + r.path.split(/\{[^}]*\}/).map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^/]+') + '$'),
}));

const VERB: Record<string, string> = { get: 'GET', post: 'POST', put: 'PUT', patch: 'PATCH', delete: 'DELETE' };
type Call = { method: string; path: string; source: string };

function calls(): Call[] {
  const files = sourceFiles(path.join(ROOT, 'src')).map((f) => path.relative(ROOT, f))
    .filter((f) => !/\.test\.tsx?$/.test(f) && !f.includes('__contract__'));
  const re = /\bapi\.(get|post|put|patch|delete)\s*(?:<[^()]*>)?\s*\(\s*([`'"])([^`'"]+)\2/g;
  const out: Call[] = [];
  for (const f of files) {
    const src = readFileSync(path.join(ROOT, f), 'utf8');
    for (let m = re.exec(src); m; m = re.exec(src)) {
      const bare = m[3].split('?')[0].replace(/\$\{[^}]*\}/g, 'X');
      out.push({ method: VERB[m[1]], path: '/api/remote' + bare, source: f });
    }
  }
  return out;
}

function sourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (name === 'node_modules' || name.startsWith('.')) return [];
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

const all = calls();
const matches = (c: Call) => templates.some((t) => (t.method === c.method || t.method === 'ANY') && t.regex.test(c.path));

describe('TV requests against the backend contract', () => {
  it('finds the calls it is meant to check', () => {
    const paths = all.map((c) => `${c.method} ${c.path}`);
    expect(paths).toContain('POST /api/remote/auth/login');
    expect(paths).toContain('POST /api/remote/tv/pairing/initiate');
    expect(all.length).toBeGreaterThanOrEqual(10);
  });

  it('every backend path the app calls exists', () => {
    const missing = all.filter((c) => !matches(c)).map((c) => `${c.method} ${c.path}  (${c.source})`);
    expect(missing).toEqual([]);
  });

  it('the pairing routes it depends on exist', () => {
    for (const p of ['POST /api/remote/tv/pairing/initiate']) {
      const [method, pth] = p.split(' ');
      expect(matches({ method, path: pth, source: 'pin' })).toBe(true);
    }
    // status carries the code as a path segment.
    expect(templates.some((t) => t.method === 'GET' && t.regex.test('/api/remote/tv/pairing/status/ABC123'))).toBe(true);
  });

  const backendContract = path.join(ROOT, '../amoria-connect/src/test/resources/contract/api-contract.json');
  (existsSync(backendContract) ? it : it.skip)('this copy matches the backend checked out next to it', () => {
    expect(readFileSync(CONTRACT, 'utf8')).toEqual(readFileSync(backendContract, 'utf8'));
  });
});
