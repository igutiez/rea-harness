import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  REA_VERSION, REA_SPEC, REA_SCAFFOLD_PATHS, REA_FLOOR_PATHS,
  reaClientsForTargets, reaSetupArgs, runReaSetup, runReaDoctor, parseReaJson,
  writeReaScaffold, reaStatus,
} from '../scripts/lib/rea-integration.js';
import { normalizeOnboarding, scanProject, buildOnboardingPlan, identifyPlan } from '../scripts/lib/onboarding.js';
import { patchWithBlock } from '../targets/deepseek-bridge.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = join(REPO, 'scripts', 'rsc.js');

const root = () => mkdtempSync(join(tmpdir(), 'rea-harness-'));
const write = (dir, rel, body) => {
  const path = join(dir, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body);
  return path;
};

function fakeRea(dir, { setupStatus = 'ready', healthy = true, registration = 'aligned' } = {}) {
  const log = join(dir, 'rea-args.log');
  const bin = join(dir, 'rea');
  const output = JSON.stringify({
    status: setupStatus,
    healthy,
    identity: {
      cli_package_version: REA_VERSION,
      registrations: [{ client: 'dsh', state: registration }],
    },
  });
  writeFileSync(bin, `#!/usr/bin/env bash\nprintf '%s\\n' "$*" >> ${JSON.stringify(log)}\nprintf '%s' ${JSON.stringify(output)}\n`);
  chmodSync(bin, 0o755);
  return { bin, log };
}

const answers = (overrides = {}) => ({
  schemaVersion: 1,
  technicalLevel: 'technical',
  projectKind: 'software',
  goal: 'reverse engineer the shipped desktop app to compare its update protocol',
  softwareScope: 'growing',
  targets: ['deepseek'],
  rea: true,
  ...overrides,
});

test('maps rsc assistants to REA clients and keeps unsupported ones explicit', () => {
  assert.deepEqual(reaClientsForTargets(['deepseek', 'claude', 'codex']), {
    clients: ['claude_code', 'codex', 'dsh'],
    unsupported: [],
  });
  const mixed = reaClientsForTargets(['deepseek', 'aider', 'claude']);
  assert.deepEqual(mixed.clients, ['claude_code', 'dsh']);
  assert.deepEqual(mixed.unsupported, ['aider']);
});

test('setup args pin the engine and never let REA replace the harness skill', () => {
  const args = reaSetupArgs(['dsh', 'claude_code', 'dsh'], { dryRun: true });
  assert.deepEqual(args, [
    'setup', '--client', 'claude_code', '--client', 'dsh', '--skill=false', '--dry-run', '--json',
  ]);
  assert.ok(!args.includes('--yes'));
  assert.ok(reaSetupArgs(['dsh']).includes('--yes'));
  assert.equal(REA_SPEC, `rea-agents@${REA_VERSION}`);
});

test('the plan selects REA only with explicit consent and adds its floor', () => {
  const dir = root();
  const plan = buildOnboardingPlan(normalizeOnboarding(answers()), scanProject(dir));
  assert.equal(plan.policy.rea, true);
  assert.ok(plan.policy.skills.includes('rea'));
  assert.ok(plan.floorPaths.includes('01-TOOLS/rea/'));
  assert.ok(plan.floorPaths.includes('02-DOCS/wiki/rea/'));
  assert.equal(plan.decisions.find((d) => d.kind === 'integration' && d.id === 'rea').state, 'selected');

  const without = buildOnboardingPlan(normalizeOnboarding(answers({ rea: false })), scanProject(dir));
  assert.equal(without.policy.rea, false);
  assert.ok(!without.policy.skills.includes('rea'));
  assert.ok(!without.floorPaths.includes('01-TOOLS/rea/'));
  const deferred = without.decisions.find((d) => d.kind === 'integration' && d.id === 'rea');
  assert.equal(deferred.state, 'deferred');
  assert.match(deferred.reason, /--with-rea/);
});

test('a goal that names artifacts explains the consent boundary without installing', () => {
  const plan = buildOnboardingPlan(normalizeOnboarding(answers({ rea: false, goal: 'decompile this APK' })), scanProject(root()));
  const rea = plan.decisions.find((d) => d.kind === 'integration' && d.id === 'rea');
  assert.equal(rea.state, 'deferred');
  assert.match(rea.reason, /user-level assistant configuration/);
  assert.ok(!plan.policy.skills.includes('rea'));
});

test('consent changes the plan identity, so it cannot be accepted silently', () => {
  const dir = root();
  const withRea = buildOnboardingPlan(normalizeOnboarding(answers()), scanProject(dir));
  const without = buildOnboardingPlan(normalizeOnboarding(answers({ rea: false })), scanProject(dir));
  assert.notEqual(identifyPlan(withRea), identifyPlan(without));
});

test('the scaffold is created once, never overwrites an edit, and refuses a symlink escape', () => {
  const dir = root();
  writeFileSync(join(dir, '.rsc.json'), JSON.stringify({
    version: 1,
    targets: ['deepseek'],
    skills: ['rea'],
    onboarding: { plan: { policy: { targets: ['deepseek'], rea: true } } },
  }));
  const first = writeReaScaffold(dir);
  assert.deepEqual([...first.created].sort(), [...REA_SCAFFOLD_PATHS].sort());
  assert.ok(first.kept.length === 0);
  assert.ok(existsSync(join(dir, '01-TOOLS/rea/test_connection.mjs')));

  writeFileSync(join(dir, '01-TOOLS/rea/README.md'), 'mine\n');
  const second = writeReaScaffold(dir);
  assert.ok(second.kept.includes('01-TOOLS/rea/README.md'));
  assert.equal(readFileSync(join(dir, '01-TOOLS/rea/README.md'), 'utf8'), 'mine\n');

  const outside = root();
  const escaped = root();
  mkdirSync(join(escaped, '01-TOOLS'), { recursive: true });
  symlinkSync(outside, join(escaped, '01-TOOLS/rea'), 'dir');
  assert.throws(() => writeReaScaffold(escaped), /REA_SCAFFOLD_ESCAPE/);
  assert.deepEqual(REA_FLOOR_PATHS, ['01-TOOLS/rea/', '02-DOCS/wiki/rea/']);
});

test('setup delegates to REA and reports a structured ready result', () => {
  const dir = root();
  const { bin, log } = fakeRea(dir);
  const result = runReaSetup({ targets: ['deepseek'], cwd: dir, env: { ...process.env, REA_BIN: bin, DSH_HOME: join(dir, 'dsh') } });
  assert.equal(result.ok, true);
  assert.equal(result.status, 'ready');
  assert.deepEqual(result.clients, ['dsh']);
  assert.match(readFileSync(log, 'utf8'), /setup --client dsh --skill=false --yes --json/);
});

test('a failed setup is reported, not thrown, with the exact repair command', () => {
  const dir = root();
  const { bin } = fakeRea(dir, { setupStatus: 'needs_human', healthy: false, registration: 'missing' });
  const result = runReaSetup({ targets: ['deepseek'], cwd: dir, env: { ...process.env, REA_BIN: bin } });
  assert.equal(result.ok, false);
  assert.equal(result.status, 'needs_human');
  const doctor = runReaDoctor({ targets: ['deepseek'], cwd: dir, env: { ...process.env, REA_BIN: bin } });
  assert.equal(doctor.ok, false);
  assert.equal(doctor.report.identity.registrations[0].state, 'missing');
});

test('the test suite can skip the only user-level write explicitly', () => {
  const result = runReaSetup({ targets: ['deepseek'], cwd: root(), env: { ...process.env, REA_HARNESS_SKIP_REGISTRATION: '1' } });
  assert.equal(result.reason, 'skipped');
});

test('no supported client is a successful no-op, not a crash', () => {
  const result = runReaSetup({ targets: ['aider'], cwd: root(), env: { ...process.env } });
  assert.equal(result.ran, false);
  assert.equal(result.reason, 'no-supported-clients');
  assert.deepEqual(result.unsupported, ['aider']);
});

test('REA output parsing tolerates a leading log line and ANSI colour', () => {
  assert.deepEqual(parseReaJson('log line\n\u001b[36m{"status":"ready"}\u001b[0m\n'), { status: 'ready' });
  assert.equal(parseReaJson('not json'), null);
});

test('the generated proof is read-only and turns a missing registration into a failure', () => {
  const dir = root();
  const aligned = fakeRea(dir, { healthy: true, registration: 'aligned' });
  const brokenDir = root();
  const broken = fakeRea(brokenDir, { healthy: false, registration: 'missing' });
  writeFileSync(join(dir, '.rsc.json'), JSON.stringify({ version: 1, targets: ['deepseek'], skills: ['rea'] }));
  writeReaScaffold(dir);
  const script = join(dir, '01-TOOLS/rea/test_connection.mjs');
  const ok = spawnSync(process.execPath, [script], { env: { ...process.env, REA_BIN: aligned.bin, REA_MCP_CLIENTS: 'dsh' }, encoding: 'utf8' });
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /^OK — REA 6\.7\.0 is ready for dsh\./);
  const bad = spawnSync(process.execPath, [script], { env: { ...process.env, REA_BIN: broken.bin, REA_MCP_CLIENTS: 'dsh' }, encoding: 'utf8' });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /dsh: missing/);
  assert.match(bad.stderr, /rea-harness rea setup/);
});

test('the DSH patch keeps a REA entry that another writer put inside the block', () => {  const begin = '# rsc-deepseek-bridge:begin — rsc hooks';
  const end = '# rsc-deepseek-bridge:end';
  const body = [
    begin,
    '- insert:',
    '    - id: rsc-hooks',
    "      name: '@deepseek-ai/dsh-hooks-codex'",
    '      config:',
    "        configPath: '/home/me/.dsh/rsc/hooks.json'",
    '- insert:',
    '    - id: rea-mcp',
    '      name: "@deepseek-ai/dsh-mcp-client"',
    '      config:',
    '        serverName: rea',
    end,
    '',
  ].join('\n');
  const out = patchWithBlock(body, '/home/me/.dsh/rsc/hooks.json');
  assert.ok(out.includes('id: rea-mcp'), 'the foreign entry survives');
  assert.ok(out.indexOf(end) < out.indexOf('id: rea-mcp'), 'it moves outside the harness block');
  assert.ok(out.includes('id: rsc-hooks'));
  const again = patchWithBlock(out, '/home/me/.dsh/rsc/hooks.json');
  assert.equal(again, out, 'the rewrite is stable');
});

test('onboarding with --with-rea installs the skill and workspace, then reports READY', { timeout: 120000 }, () => {
  const dir = root();
  const home = join(dir, 'home');
  const dsh = join(dir, 'dsh');
  mkdirSync(home, { recursive: true });
  mkdirSync(dsh, { recursive: true });
  const env = {
    ...process.env,
    HOME: home,
    DSH_HOME: dsh,
    REA_HARNESS_SKIP_REGISTRATION: '1',
  };
  const base = [
    'onboard', '--technical-level', 'technical', '--project-kind', 'software',
    '--goal', 'reverse engineer the shipped desktop app', '--software-scope', 'growing',
    '--target', 'deepseek', '--with-rea',
  ];
  const preview = spawnSync(process.execPath, [CLI, ...base], { cwd: dir, env, encoding: 'utf8' });
  assert.equal(preview.status, 0, preview.stderr);
  const planId = /^Plan id: ([0-9a-f]{64})$/m.exec(preview.stdout)?.[1];
  assert.ok(planId, preview.stdout);
  const apply = spawnSync(process.execPath, [CLI, ...base, '--accept-plan', planId], { cwd: dir, env, encoding: 'utf8', timeout: 110000 });
  assert.equal(apply.status, 0, apply.stderr);
  assert.match(apply.stdout, new RegExp(`RSC_ONBOARDING_READY ${planId}`));
  assert.ok(existsSync(join(dir, '01-TOOLS/rea/test_connection.mjs')));
  assert.ok(existsSync(join(dir, '02-DOCS/wiki/rea/evidence-ledger.md')));
  assert.ok(existsSync(join(dir, '.dsh/skills/rea/SKILL.md')));
  const doctor = spawnSync(process.execPath, [CLI, 'rea', 'status', '--json'], { cwd: dir, env, encoding: 'utf8' });
  assert.equal(doctor.status, 0, doctor.stderr);
  const status = JSON.parse(doctor.stdout);
  assert.equal(status.selected, true);
  assert.deepEqual(status.clients, ['dsh']);
  assert.equal(status.scaffold.ready, true);
});
