// The REA capability: a pinned reverse-engineering engine, the skill that teaches an agent when to
// use it, a user-owned tool folder that proves the connection, and an evidence workspace.
//
// Registration is delegated to `rea setup --skill=false`: REA owns the per-client configuration
// dialects, backups, atomic publication and read-back verification. This module never writes a
// user-level client config itself, and it never executes a target.
import { chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { REA_INVOCATION } from './brand.js';
import { reconcileDeepseekPatch } from '../../targets/deepseek-bridge.js';

/** The REA release this harness pins. `REA_VERSION` and the registration command must agree. */
export const REA_VERSION = '6.7.0';
/** npm package that provides the `rea` CLI and the stdio MCP server. */
export const REA_PACKAGE = 'rea-agents';
/** Pinned package spec used when no local `rea` binary is on PATH. */
export const REA_SPEC = `${REA_PACKAGE}@${REA_VERSION}`;

/** rsc assistant ids mapped to REA's supported client ids. Absence means "CLI fallback only". */
export const REA_CLIENTS = Object.freeze({
  claude: 'claude_code',
  codex: 'codex',
  cursor: 'cursor',
  gemini: 'gemini_cli',
  windsurf: 'windsurf',
  opencode: 'opencode',
  copilot: 'copilot_cli',
  deepseek: 'dsh',
  antigravity: 'antigravity',
});

/** Relative files the harness owns under `01-TOOLS/rea/` and `02-DOCS/wiki/rea/`. */
export const REA_SCAFFOLD_PATHS = Object.freeze([
  '01-TOOLS/rea/README.md',
  '01-TOOLS/rea/CREDENTIALS.md',
  '01-TOOLS/rea/.env.example',
  '01-TOOLS/rea/test_connection.mjs',
  '02-DOCS/wiki/rea/index.md',
  '02-DOCS/wiki/rea/evidence-ledger.md',
  '02-DOCS/wiki/rea/targets/_template.md',
]);

/** The directories the readiness floor requires when REA is selected. */
export const REA_FLOOR_PATHS = Object.freeze(['01-TOOLS/rea/', '02-DOCS/wiki/rea/']);

/** The files a plan preview lists as scaffolded-once, in display order. */
export function reaScaffoldPathsForPlan() {
  return [...REA_SCAFFOLD_PATHS].sort();
}

const SUPPORTED_CLIENT_SET = new Set(Object.values(REA_CLIENTS));

/** Map rsc target ids to REA client ids, keeping the target order out of the result. */
export function reaClientsForTargets(targets = []) {
  const clients = new Set();
  const unsupported = [];
  for (const target of targets) {
    const client = REA_CLIENTS[target];
    if (client) clients.add(client);
    else unsupported.push(target);
  }
  return { clients: [...clients].sort(), unsupported: unsupported.sort() };
}

/**
 * Resolve the command that runs REA without executing an analysis.
 *
 * A local `rea` on PATH wins so an operator-pinned installation is used. Otherwise the pinned npm
 * package is fetched with `npx -y`, exactly as REA's own installer does. `REA_BIN` overrides both
 * and is the documented test seam.
 */
export function reaInvocation({ env = process.env } = {}) {
  const explicit = String(env.REA_BIN || '').trim();
  if (explicit) return { command: explicit, prefix: [], source: 'REA_BIN', display: explicit };
  const probe = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['rea'], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true,
  });
  if (probe.status === 0) return { command: 'rea', prefix: [], source: 'path', display: 'rea' };
  return {
    command: 'npx',
    prefix: ['-y', REA_SPEC],
    source: 'npx',
    display: `npx -y ${REA_SPEC}`,
  };
}

function run(command, args, { cwd, env = process.env, timeout = 180000 } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    encoding: 'utf8',
    timeout,
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  });
  return {
    status: typeof result.status === 'number' ? result.status : 1,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    error: result.error ? String(result.error.message || result.error) : null,
    command: [command, ...args].join(' '),
  };
}

/** Parse REA's `--json` output, tolerating a leading log line or ANSI colour. */
export function parseReaJson(stdout) {
  const text = String(stdout || '').replace(/\u001b\[[0-9;]*m/g, '').trim();
  if (!text) return null;
  try { return JSON.parse(text); } catch { /* a wrapper may print before the record */ }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(text.slice(start, end + 1)); } catch { return null; }
}

/** Args for `rea setup`; `--skill=false` keeps the harness's adapted skill as the only copy. */
export function reaSetupArgs(clients, { dryRun = false } = {}) {
  const ids = [...new Set(clients)].sort().filter((client) => SUPPORTED_CLIENT_SET.has(client));
  return [
    'setup',
    ...ids.flatMap((client) => ['--client', client]),
    '--skill=false',
    ...(dryRun ? ['--dry-run'] : ['--yes']),
    '--json',
  ];
}

/**
 * Register or repair the REA MCP server for the selected assistants.
 *
 * This is the only operation that writes outside the project. It is never attempted from `doctor`,
 * `status` or a plan preview; the caller decides when consent exists.
 */
export function runReaSetup({ targets = [], cwd, dryRun = false, env = process.env, timeout } = {}) {
  const { clients, unsupported } = reaClientsForTargets(targets);
  if (!clients.length) {
    return { ran: false, ok: false, clients, unsupported, reason: 'no-supported-clients' };
  }
  // Offline installs and the test suite use this seam. It is explicit, never inferred from a failure.
  if (env.REA_HARNESS_SKIP_REGISTRATION === '1') {
    return { ran: false, ok: false, clients, unsupported, reason: 'skipped' };
  }
  const invocation = reaInvocation({ env });
  const args = [...invocation.prefix, ...reaSetupArgs(clients, { dryRun })];
  const result = run(invocation.command, args, { cwd, env, timeout });
  const report = parseReaJson(result.stdout);
  const status = report?.status || (result.status === 0 ? 'ok' : 'failed');
  const ok = result.status === 0 && status !== 'failed' && status !== 'needs_human';
  // REA's YAML writer can place its insert inside the harness block. Move it out now, so a later
  // `rsc sync` reads a document whose markers delimit only the harness entry.
  let reconciled = null;
  if (ok && !dryRun && clients.includes('dsh')) {
    try { reconciled = reconcileDeepseekPatch(env); } catch (error) {
      reconciled = { changed: false, error: String(error?.message || error).slice(0, 200) };
    }
  }
  return {
    ran: true,
    ok,
    clients,
    unsupported,
    status,
    dryRun,
    reconciled,
    report,
    stdout: result.stdout,
    stderr: result.stderr,
    error: result.error,
    command: invocation.display,
  };
}

/** Read-only readiness probe for the clients this project registered. */
export function runReaDoctor({ targets = [], cwd, env = process.env, timeout = 120000 } = {}) {
  const { clients, unsupported } = reaClientsForTargets(targets);
  if (!clients.length) return { ran: false, ok: false, clients, unsupported, reason: 'no-supported-clients' };
  const invocation = reaInvocation({ env });
  const args = [...invocation.prefix, 'doctor', ...clients.flatMap((client) => ['--client', client]), '--json'];
  const result = run(invocation.command, args, { cwd, env, timeout });
  const report = parseReaJson(result.stdout);
  return {
    ran: true,
    ok: result.status === 0 && report?.healthy === true,
    clients,
    unsupported,
    report,
    stdout: result.stdout,
    stderr: result.stderr,
    error: result.error,
    command: invocation.display,
  };
}

/**
 * Run REA with inherited stdio for analysis commands whose output belongs to the user.
 *
 * @param {string[]} args Arguments after the launcher (for example `['analyze', '/path']`).
 * @param {{cwd?: string, env?: NodeJS.ProcessEnv}} [options] Process context.
 * @returns {{status: number, command: string}} Exit status and the command that ran.
 */
export function runReaPassthrough(args, { cwd, env = process.env } = {}) {
  const invocation = reaInvocation({ env });
  const command = [invocation.command, ...invocation.prefix, ...args];
  const result = spawnSync(command[0], command.slice(1), {
    cwd, env, stdio: 'inherit', windowsHide: true,
  });
  return { status: typeof result.status === 'number' ? result.status : 1, command: command.join(' ') };
}

function readManifestSafe(root) {
  try { return JSON.parse(readFileSync(join(root, '.rsc.json'), 'utf8')); } catch { return null; }
}

/** What this project declared about REA, without executing anything. */
export function reaStatus(root = process.cwd()) {
  const manifest = readManifestSafe(root);
  const plan = manifest?.onboarding?.plan;
  const selected = plan?.policy?.rea === true;
  const targets = plan?.policy?.targets || manifest?.targets || [];
  const { clients, unsupported } = reaClientsForTargets(targets);
  const scaffold = REA_SCAFFOLD_PATHS.map((path) => ({ path, exists: existsSync(join(root, path)) }));
  const missing = scaffold.filter((entry) => !entry.exists).map((entry) => entry.path);
  return {
    selected,
    version: REA_VERSION,
    package: REA_SPEC,
    clients,
    unsupported,
    invocation: reaInvocation(),
    scaffold: { ready: missing.length === 0, missing },
    evidenceIndex: existsSync(join(root, '02-DOCS', 'wiki', 'rea', 'index.md')),
  };
}

function assertSafeWrite(root, rel) {
  const absoluteRoot = resolve(root);
  const absolute = resolve(absoluteRoot, rel);
  if (absolute !== absoluteRoot && !absolute.startsWith(`${absoluteRoot}${sep}`)) {
    throw new Error(`REA_SCAFFOLD_ESCAPE: ${rel} leaves the project root`);
  }
  const segments = relative(absoluteRoot, absolute).split(sep).filter(Boolean);
  let cursor = absoluteRoot;
  for (const segment of segments.slice(0, -1)) {
    cursor = join(cursor, segment);
    if (!existsSync(cursor)) break;
    if (lstatSync(cursor).isSymbolicLink()) {
      throw new Error(`REA_SCAFFOLD_ESCAPE: ${rel} follows a symlink outside the project root`);
    }
  }
  return absolute;
}

function writeOnce(root, rel, content, mode) {
  const absolute = assertSafeWrite(root, rel);
  mkdirSync(dirname(absolute), { recursive: true });
  try {
    writeFileSync(absolute, content, { flag: 'wx', mode: mode || 0o644 });
    if (mode) chmodSync(absolute, mode);
    return true;
  } catch (error) {
    if (error?.code === 'EEXIST') return false;
    throw error;
  }
}

const toolReadme = (clients) => `# REA — artifact evidence

REA explains shipped artifacts: native binaries, Electron/JS bundles, APKs, firmware, browser
sessions and the runtime behavior a source checkout cannot establish. rea-harness installs the
\`rea\` skill and this folder; the MCP server is registered in your assistant's user configuration.

## When to use

A claim depends on the artifact the user runs, not only on the source in this repository: a
release behaves differently, a dependency was patched in the bundle, an old version must be
compared, or a feature is only visible at runtime.

## Setup

1. Node.js 22.19+, 24.11+ or 26+ (REA's engine range; this harness supports Node 18+ for its own CLI).
2. Prove the registration, read-only:

   \`\`\`bash
   node 01-TOOLS/rea/test_connection.mjs
   \`\`\`

3. If it fails, register or repair for the assistants this project declares:

   \`\`\`bash
   npx github:igutiez/rea-harness rea setup
   npx github:igutiez/rea-harness rea doctor
   \`\`\`

The harness delegates to \`rea setup --skill=false --yes\`, so REA owns the client formats, backups
and read-back verification while the harness owns the skill in \`.rsc/skills/rea/\`.

## Registered assistants

${clients.length ? clients.map((client) => `- \`${client}\``).join('\n') : '- none: REA is supported here only through its CLI fallback.'}

Assistants without a REA client definition still get the skill and the CLI fallback:

\`\`\`bash
npx -y ${REA_SPEC} analyze-javascript-application /absolute/path/to/app --json
\`\`\`

## Evidence

Write findings to \`02-DOCS/wiki/rea/\`, never only into the chat:

- \`index.md\` — targets, authorization, status and open questions.
- \`evidence-ledger.md\` — one row per conclusion with its Evidence ID.
- \`targets/<slug>.md\` — artifact identity, observations, inferences, unknowns and coverage.

A conclusion without an Evidence ID is an inference. Never present static analysis as observed
runtime behavior.

## Operational notes

- Registration writes user-level config, not project files. REA uninstalls only what it owns:
  \`npx -y ${REA_SPEC} uninstall\` (optionally \`--purge-data\`).
- The JavaScript/ASAR lane needs no native engine. Hopper, Ghidra, IDA, JADX, Kuna, tshark and the
  other providers are bring-your-own and stay behind their own approval.
- Never commit \`.env\`, credentials, extracted proprietary code or target artifacts here.
`;

const credentials = `# Credentials and prerequisites — REA

REA needs **no account and no API key**. This folder has no credential to fill in.

## Required

| Requirement | Why | How to check |
| --- | --- | --- |
| Node.js 22.19+, 24.11+ or 26+ | Runs the REA CLI and MCP server. The harness itself supports Node 18+, but REA does not. | \`node --version\` |
| A supported assistant (optional) | MCP registration for the clients listed in \`README.md\`. | \`npx github:igutiez/rea-harness rea status\` |

## Optional providers

Each provider is an external engine with its own license. Install one only when the investigation
needs it, and record that decision in \`02-DOCS/wiki/rea/index.md\`.

| Provider | License / prerequisite | Environment |
| --- | --- | --- |
| Hopper | Commercial; REA's setup can install it only with explicit approval. | \`HOPPER_LAUNCHER_PATH\` |
| Ghidra | Apache-2.0; bring your own installation. | \`GHIDRA_INSTALL_DIR\`, \`JAVA_HOME\` |
| IDA Pro | Commercial; use the existing MCP configuration. | \`REA_IDA_MCP_CONFIG\` |
| JADX / Java | Apache-2.0; needed for Android bytecode. | \`REA_JADX_*\` |
| Kuna | Commercial. | \`REA_KUNA_COMMAND\` |
| tshark / binwalk / unblob | Installed by the operator; used for captures and firmware. | \`REA_TSHARK_COMMAND\` |

The JavaScript/ASAR lane needs none of them.

## Rules

- Least privilege: analyze a copy, never the only copy of a production artifact.
- No credentials in this folder. \`.env\` is ignored by \`01-TOOLS/.gitignore\`.
- The boundary is the user's authorization, not the tool's capability. Record the target and the
  authorization before a runtime action; do not execute untrusted code or bypass licensing.
`;

const envExample = (clients) => `# Copy to .env only when you need to override the defaults.
# 01-TOOLS/.gitignore ignores .env; never commit it.

# Use an existing REA installation instead of the pinned npx fallback.
# REA_BIN=/absolute/path/to/rea

# Comma-separated REA client ids used by test_connection.mjs.
REA_MCP_CLIENTS=${clients.join(',')}

# Optional native providers (see CREDENTIALS.md). Leave unset when unused.
# HOPPER_LAUNCHER_PATH=
# GHIDRA_INSTALL_DIR=
# JAVA_HOME=
`;

function testConnectionSource(clients) {
  return `#!/usr/bin/env node
// Read-only proof that REA is installed and its MCP registration is aligned.
// It runs \`rea doctor\` for the clients this project selected and prints the exact remediation on
// failure. It never writes a configuration file and never opens an analysis target.
import { spawnSync } from 'node:child_process';

const DEFAULT_CLIENTS = ${JSON.stringify(clients)};
const clients = (process.env.REA_MCP_CLIENTS || DEFAULT_CLIENTS.join(','))
  .split(',').map((value) => value.trim()).filter(Boolean);
const pinned = '${REA_SPEC}';
const bin = String(process.env.REA_BIN || '').trim();

function run(command, args) {
  return spawnSync(command, args, { encoding: 'utf8', timeout: 120000, maxBuffer: 16 * 1024 * 1024 });
}

function parse(stdout) {
  const text = String(stdout || '').trim();
  try { return JSON.parse(text); } catch { /* fall through */ }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(text.slice(start, end + 1)); } catch { return null; }
}

if (!clients.length) {
  console.error('FAIL — no REA clients selected. Set REA_MCP_CLIENTS or rerun onboarding with --with-rea.');
  process.exit(1);
}

let command = bin || 'rea';
let prefix = [];
if (!bin) {
  const probe = run('rea', ['--version']);
  if (probe.status !== 0) {
    command = 'npx';
    prefix = ['-y', pinned];
  }
}

const args = [...prefix, 'doctor', ...clients.flatMap((client) => ['--client', client]), '--json'];
const result = run(command, args);
const report = parse(result.stdout);
const registrations = (report?.identity?.registrations || []).filter((entry) => clients.includes(entry.client));
const misaligned = registrations.filter((entry) => entry.state !== 'aligned');

if (result.status === 0 && report?.healthy === true && misaligned.length === 0) {
  console.log(\`OK — REA \${report?.identity?.cli_package_version || 'unknown version'} is ready for \${clients.join(', ')}.\`);
  process.exit(0);
}

console.error('FAIL — REA is not ready for: ' + clients.join(', '));
if (result.error) console.error('  ' + result.error.message);
for (const entry of misaligned) {
  console.error(\`  \${entry.client}: \${entry.state}\${entry.remediation ? ' — ' + entry.remediation : ''}\`);
}
if (!registrations.length) console.error('  no registration reported; the MCP server may not be registered.');
if (result.stderr.trim()) console.error(result.stderr.trim().split('\\n').slice(-8).join('\\n'));
console.error('  Repair: npx github:igutiez/rea-harness rea setup');
process.exit(1);
`;
}

const evidenceIndex = (clients) => `---
title: REA evidence
type: index
status: active
clients: [${clients.join(', ')}]
---

# REA evidence

What this project knows from artifacts and runtime behavior. Read this page before a new
investigation; reuse matching evidence instead of repeating an analysis.

## Targets

| Target | Artifact | SHA-256 | Provider | Status | Page |
| --- | --- | --- | --- | --- | --- |
| — | — | — | — | — | — |

## Authorized scope

Record what the user authorized here: which artifacts, which versions, which runtime actions and
whether the target may be executed. An empty scope authorizes static inspection only.

## Open questions

- —

## How this page stays useful

- One target page per artifact: \`targets/<slug>.md\`.
- One ledger row per conclusion: \`evidence-ledger.md\`.
- Keep observations, inferences and unknowns separate. Cite Evidence IDs.
`;

const ledger = `---
title: REA evidence ledger
type: ledger
status: active
---

# Evidence ledger

One row per conclusion. \`Type\` is **observation** (read from the artifact or a declared runtime
action), **inference** (reasoned from observations) or **unknown** (bounded negative result).

| Evidence ID | Target | Claim | Type | Confidence | Search boundary | Page |
| --- | --- | --- | --- | --- | --- | --- |
| — | — | — | — | — | — | — |

A conclusion without an Evidence ID is an inference. Preserve the limitations and coverage the tool
reported; do not describe a bounded search as complete.
`;

const targetTemplate = `---
title: Target — replace with the artifact name
type: target
status: open
artifact: /absolute/path/to/artifact
sha256: replace-with-the-digest
provider: js | native | android | runtime | other
authorized: static-only
---

# Target — name

## Identity

| Field | Value |
| --- | --- |
| Artifact | \`/absolute/path\` |
| SHA-256 | \`…\` |
| Version / build | … |
| Platform | … |
| Provider | … |

## Authorization

What the user allowed: static inspection, a specific runtime action, or both. Do not widen it.

## Observations

Facts read from the artifact or a declared runtime action, each with its Evidence ID.

## Inferences

Conclusions derived from observations. State the reasoning and what would falsify them.

## Unknowns and coverage

What the analysis did not cover, which searches were bounded, and which provider was unavailable.

## Next questions

- —
`;

/**
 * Write the user-owned REA workspace once.
 *
 * Existing files are kept byte for byte: this is the layer the user edits while investigating. A
 * symlinked path is refused rather than followed.
 */
export function writeReaScaffold(root = process.cwd()) {
  const manifest = readManifestSafe(root);
  const targets = manifest?.onboarding?.plan?.policy?.targets || manifest?.targets || [];
  const { clients } = reaClientsForTargets(targets);
  const contents = {
    '01-TOOLS/rea/README.md': toolReadme(clients),
    '01-TOOLS/rea/CREDENTIALS.md': credentials,
    '01-TOOLS/rea/.env.example': envExample(clients),
    '01-TOOLS/rea/test_connection.mjs': testConnectionSource(clients),
    '02-DOCS/wiki/rea/index.md': evidenceIndex(clients),
    '02-DOCS/wiki/rea/evidence-ledger.md': ledger,
    '02-DOCS/wiki/rea/targets/_template.md': targetTemplate,
  };
  const created = [];
  const kept = [];
  for (const [path, content] of Object.entries(contents)) {
    const mode = path.endsWith('.mjs') ? 0o755 : 0o644;
    if (writeOnce(root, path, content, mode)) created.push(path);
    else kept.push(path);
  }
  return { created, kept, clients };
}

/** A short, human-readable registration outcome for the CLI. */
export function describeReaSetup(result) {
  if (result.reason === 'skipped') {
    return `REA registration skipped by REA_HARNESS_SKIP_REGISTRATION. Register later with: ${REA_INVOCATION} setup`;
  }
  if (!result.ran) {
    return `REA: no supported assistant to register (${result.unsupported.join(', ') || 'none selected'}). The skill and CLI fallback are still installed.`;
  }
  const clients = result.clients.join(', ');
  if (result.ok) {
    return result.dryRun
      ? `REA plan (${clients}): ${result.status}. Nothing written; run without --dry-run to apply.`
      : `REA ready (${clients}).`;
  }
  return `REA_REGISTRATION_INCOMPLETE (${clients}): ${result.status}. Retry with: ${REA_INVOCATION} setup`;
}
