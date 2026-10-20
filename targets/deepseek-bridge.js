// DeepSeek Harness (dsh) has no project-level hook or plugin config: plugins are per machine, and
// its Codex-hooks bridge reads one file named at boot. So the deepseek target needs one machine-level
// step besides the project files: put rsc's bridge in $DSH_HOME/rsc/ and add one insert to the
// home patch layer ($DSH_HOME/cordis.patch.yml, applied over every profile). Idempotent, and it only
// ever touches the block between its own markers. It is never removed on uninstall: other projects on
// the machine may use it, and with no `.dsh/hooks.json` in a project it does nothing at all.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BEGIN = '# rsc-deepseek-bridge:begin';
const END = '# rsc-deepseek-bridge:end';
// The points rsc uses. PreToolUse is left out: nothing of rsc's runs there yet, and every tool call
// would pay a process spawn for nothing.
const EVENTS = ['SessionStart', 'UserPromptSubmit', 'PostToolUse', 'Stop'];

export function dshHome(env = process.env) {
  const value = (env.DSH_HOME || '').trim();
  return value || join(homedir(), '.dsh');
}

export function deepseekBridgePaths(env = process.env) {
  const home = dshHome(env);
  return {
    home,
    bridge: join(home, 'rsc', 'bridge.mjs'),
    hooks: join(home, 'rsc', 'hooks.json'),
    patch: join(home, 'cordis.patch.yml'),
  };
}

const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;

function block(hooksPath) {
  return [
    `${BEGIN} — rsc hooks for DeepSeek Harness (delete this block to turn them off)`,
    '- insert:',
    '    - id: rsc-hooks',
    "      name: '@deepseek-ai/dsh-hooks-codex'",
    '      config:',
    `        configPath: ${quote(hooksPath)}`,
    END,
  ].join('\n');
}

/**
 * Top-level YAML entries inside the block that this project does not own.
 *
 * The patch file is shared: REA appends its `- insert:` entry when `rea setup` runs, and its YAML
 * writer can place that entry before the block's closing comment. Preserving foreign entries here is
 * what makes `rsc sync` safe to run after a REA registration.
 */
function foreignEntries(body, start, stop) {
  const entries = [];
  let current = null;
  for (const line of body.slice(start, stop).split('\n')) {
    if (line.startsWith('# ')) continue;
    if (line.startsWith('- ')) {
      if (current) entries.push(current.join('\n'));
      current = [line];
      continue;
    }
    if (current) current.push(line);
  }
  if (current) entries.push(current.join('\n'));
  return entries
    .map((entry) => entry.replace(/\n+$/, ''))
    .filter((entry) => entry && !entry.includes('id: rsc-hooks'));
}

/** Where the block goes, or null when the file is in a shape we must not guess at. */
export function patchWithBlock(body, hooksPath) {
  const ours = block(hooksPath);
  const start = body.indexOf(BEGIN);
  const stop = body.indexOf(END);
  if (start !== -1 && stop > start) {
    const before = body.slice(0, start);
    const after = body.slice(stop + END.length);
    const preserved = foreignEntries(body, start, stop);
    // Foreign entries move outside the markers: the next rewrite only owns this block, so it can no
    // longer capture them. With nothing to preserve the document is rewritten byte for byte.
    if (!preserved.length) return before + ours + after;
    const tail = `${preserved.join('\n')}\n`;
    return `${before}${ours}\n${tail}${after.replace(/^\n/, '')}`;
  }
  const lines = body.split('\n');
  const content = lines.filter((line) => line.trim() && !line.trim().startsWith('#'));
  if (content.length === 1 && content[0].trim() === '[]') {
    const kept = lines.filter((line) => line.trim() !== '[]').join('\n').replace(/\n*$/, '');
    return `${kept ? `${kept}\n` : ''}${ours}\n`;
  }
  if (!content.length) return `${body.replace(/\n*$/, '')}${body.trim() ? '\n' : ''}${ours}\n`;
  if (content[0].startsWith('- ')) return `${body.replace(/\n*$/, '')}\n${ours}\n`;
  return null;
}

/**
 * Move entries another writer placed inside the harness block back outside it.
 *
 * `rea setup` is the known writer: run this after it registers for DSH, so a later `rsc sync` reads
 * an already-clean document. Returns whether the file changed.
 */
export function reconcileDeepseekPatch(env = process.env) {
  const paths = deepseekBridgePaths(env);
  if (!existsSync(paths.patch)) return { changed: false, path: paths.patch };
  const body = readFileSync(paths.patch, 'utf8');
  if (!body.includes(BEGIN)) return { changed: false, path: paths.patch };
  const next = patchWithBlock(body, paths.hooks);
  if (next === null || next === body) return { changed: false, path: paths.patch };
  writeFileSync(paths.patch, next);
  return { changed: true, path: paths.patch };
}

export function wireDeepseekBridge(env = process.env) {
  const paths = deepseekBridgePaths(env);
  mkdirSync(dirname(paths.bridge), { recursive: true });
  copyFileSync(join(HERE, 'deepseek-bridge.mjs'), paths.bridge);
  const hooks = {};
  for (const event of EVENTS) {
    hooks[event] = [{ hooks: [{ type: 'command', command: `node "${paths.bridge}" ${event}`, timeout: 30 }] }];
  }
  writeFileSync(paths.hooks, `${JSON.stringify({ hooks }, null, 2)}\n`);
  const body = existsSync(paths.patch) ? readFileSync(paths.patch, 'utf8') : '';
  const next = patchWithBlock(body, paths.hooks);
  if (next === null) return { mode: 'manual', reason: 'patch-shape-unknown', paths: [paths.bridge, paths.hooks] };
  if (next !== body) writeFileSync(paths.patch, next);
  return { mode: 'wired', paths: [paths.bridge, paths.hooks, paths.patch] };
}

export function inspectDeepseekBridge(env = process.env) {
  const paths = deepseekBridgePaths(env);
  const patched = existsSync(paths.patch) && readFileSync(paths.patch, 'utf8').includes(BEGIN);
  const ready = patched && existsSync(paths.bridge) && existsSync(paths.hooks);
  return { status: ready ? 'ready' : 'missing', ...paths };
}
