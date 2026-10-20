import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// What the project PROMISES in public is a claim like any other. The private fork has one public
// surface, the README; this guard keeps its claims true and keeps the catalog count derived from the
// manifest instead of typed by hand.
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

const SURFACES = ['README.md'];
const ALL = SURFACES.filter((p) => existsSync(join(ROOT, p))).map((p) => ({ p, text: read(p) }));

test('1 · every public surface this guard names actually exists', () => {
  assert.deepEqual(ALL.map((s) => s.p), SURFACES, 'a guard that silently skips a file guards nothing');
});

// ── claims the upstream harness retired ─────────────────────────────────────────────────────

const RETIRED = [
  { what: 'routing every feature request through the spec phase', re: /routes? through `?specify`?/i },
  { what: 'the spec-first new-feature gate', re: /new-feature gate|spec-first/i },
  { what: 'a profile to choose at install time', re: /--profile\s+(minimal|core|full)/i },
  { what: 'the chain needs an accepted proposal', re: /accepted proposal|never enters? (?:it|the chain) (?:alone|on its own)/i },
];

for (const claim of RETIRED) {
  test(`2 · no surface still claims: ${claim.what}`, () => {
    const guilty = ALL.filter((s) => claim.re.test(s.text)).map((s) => s.p);
    assert.deepEqual(guilty, [], `the engine retired this; it is still published in: ${guilty.join(', ')}`);
  });
}

// ── claims the harness makes, and that must stay stated ─────────────────────────────────────

const REQUIRED = [
  { what: 'the default lane has a name', re: /\bFTD\b/ },
  { what: 'the agent picks the lane and the person approves the spec', re: /enters it on its own[\s\S]*approve the spec/i },
  { what: 'a request for information writes nothing', re: /read-only|writes nothing/i },
  { what: 'isolation is retired automatically once work lands', re: /post-merge|retire[sd]? .*worktree|worktree.*retire/i },
];

for (const claim of REQUIRED) {
  test(`3 · stated where it matters: ${claim.what}`, () => {
    const missing = ALL.filter((s) => !claim.re.test(s.text)).map((s) => s.p);
    assert.deepEqual(missing, [], `true since the engine shipped and unstated in: ${missing.join(', ')}`);
  });
}

test('4 · the own-skills promise is still made, because it is true', () => {
  const readme = read('README.md');
  assert.match(readme, /own skills|tus skills/i, 'the boundary between yours and the catalog must be documented');
  assert.match(readme, /never installs, updates or overwrites/i,
    'the promise predates the mechanism that keeps it; while it holds, it stays');
});

test('5 · the REA consent boundary is stated, not implied', () => {
  const readme = read('README.md');
  assert.match(readme, /--with-rea/, 'the opt-in flag must be named');
  assert.match(readme, /user-level assistant configuration|configuración de usuario/i,
    'the write outside the project must be disclosed');
  assert.match(readme, /Evidence ID/, 'the evidence discipline must be stated');
});

// ── counts are derived, never typed ──────────────────────────────────────────────────────────

test('6 · no surface carries a skill count the catalog would contradict', () => {
  const manifest = JSON.parse(read('manifest.json'));
  const real = manifest.skills.length;
  const wrong = [];
  for (const { p, text } of ALL) {
    for (const m of text.matchAll(/(\d{2,4})\s*(?:quality-gated\s+)?skills/gi)) {
      if (Number(m[1]) !== real) wrong.push(`${p}: says ${m[1]}, catalog has ${real}`);
    }
  }
  assert.deepEqual(wrong, [], wrong.join(' · '));
});
